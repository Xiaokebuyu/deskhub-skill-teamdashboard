/**
 * 飞书 LLM 机器人入口
 *
 * 卡片流式生命周期（CardKit v2 场景包版）：
 *   1. 用户发消息 → detectScene() 按关键词预判场景（5 种）
 *   2. createCardEntity + sendCardById 预发场景化空卡
 *   3. thinking chunks → append 思考胶囊 thinking_pill_r{round}
 *   4. 首个 text chunk → delete 当前胶囊，streamCardText 到 main_text_0
 *   5. 下一轮 thinking chunks → append 新胶囊（在 main_text_0 之后）
 *   6. complete → card.update 切完成态 header（绿勾 + 随机完成 subtitle · 耗时）
 *
 * 跟旧版的 3 处关键差异：
 *   - 思考胶囊"每轮独立，瞬态"（text 一到就 delete，不折叠）
 *   - 跳过工具面板 UI（工具调用淡化，不再展示 ⏳/✅ 列表）
 *   - 主文本跨轮累积到同一 main_text_0，不清零
 *
 * 节流：per-element 300ms 或 30 字符强制 flush
 */

import {
  initFeishu,
  createAndSendCard,
  createCardEntity,
  sendCardById,
  streamCardText,
  insertCardElements,
  deleteCardElement,
  updateCardEntity,
  closeStreamingMode,
} from './feishu.js';
import { chat } from './llm.js';
import { getSession, updateSession, startSessionCleanup } from './session.js';
import { startChangeDetector } from './change-detector.js';
import { startPatrol } from './patrol.js';
import { enqueueMessage } from './concurrency.js';
import { getUserByOpenId, bindFeishuUser } from '../mcp/db-ops.js';
import {
  buildChatCardInitial,
  buildThinkingPill,
  buildCompletionCard,
  buildErrorCard,
  buildSimpleCard,
} from './card-templates.js';

const THROTTLE_MS = 300;
const FLUSH_AT_CHARS = 30;

/**
 * 启动飞书机器人
 */
export async function startBot() {
  if (process.env.BOT_ENABLED !== 'true') {
    console.log('[Bot] BOT_ENABLED !== true，跳过启动');
    return;
  }

  startSessionCleanup();

  const feishuReady = await initFeishu(handleMessage);

  startChangeDetector();
  startPatrol();

  if (feishuReady) {
    console.log('[Bot] 飞书机器人已启动');
  } else {
    console.log('[Bot] 变更检测已启动（飞书未配置，消息功能不可用）');
  }
}

// ============================================================
//  场景检测（规则预判）
// ============================================================

/**
 * 按用户消息关键词判断场景包，决定 header icon/color/文案池
 * 优先级：error（保留，仅在真错误时触发）> plan > data > deepthink > default
 */
function detectScene(text) {
  const t = text || '';

  // 工单关键词：具体 ID 或 工单/方案 相关词（最强信号）
  if (/\b[PM]-\d+/.test(t)) return 'plan';
  if (/工单|方案|定稿|评分|评测|维度/.test(t)) return 'plan';

  // 深度思考：分析/对比/判断类动词优先于 data 查询
  if (/为什么|怎么看|分析|对比|建议|怎么办|思考|评价|判断/.test(t)) return 'deepthink';

  // 数据查询关键词
  if (/列表|有哪些|多少|统计|最近|热门|下载|排行|访问量|调用|数据/.test(t)) return 'data';

  // 超长消息（≥50 字）也走深度思考
  if (t.length > 50) return 'deepthink';

  return 'default';
}

// ============================================================
//  ChatCardStreamer — 单条消息处理过程中的卡片状态机
// ============================================================

class ChatCardStreamer {
  /**
   * @param {string} receiveId
   * @param {string} receiveIdType
   * @param {object} [opts]
   * @param {string} [opts.scene='default']
   * @param {string} [opts.presetCardId]
   * @param {string} [opts.presetMessageId]
   */
  constructor(receiveId, receiveIdType, { scene = 'default', presetCardId = null, presetMessageId = null } = {}) {
    this.receiveId = receiveId;
    this.receiveIdType = receiveIdType;
    this.scene = scene;
    this.startTime = Date.now();
    this.cardId = presetCardId;
    this.messageId = presetMessageId;

    this.runningText = '';         // 跨轮累积（不清零）
    this.runningThinkingByRound = new Map();   // round → 该轮思考累积

    // ── Promise 备忘锁 ──
    this._cardPromise = presetCardId ? Promise.resolve() : null;
    this._pillPromises = new Map();   // round → insert pill promise
    this._currentPillRound = null;    // 当前屏幕上存在的思考胶囊的 round，无则 null

    // ── per-card FIFO op queue ──
    this._opQueue = Promise.resolve();

    // per-element 节流
    this.flushState = new Map();
  }

  _enqueue(label, fn) {
    const next = this._opQueue.then(fn);
    this._opQueue = next.catch(() => {});
    next.catch(() => {});
    return next;
  }

  _memoize(map, key, factory) {
    if (map.has(key)) return map.get(key);
    const p = factory().catch(err => {
      if (map.get(key) === p) map.delete(key);
      throw err;
    });
    map.set(key, p);
    return p;
  }

  /**
   * card 创建：不进队列（队列内任务会 await 它，进队列死锁）
   */
  ensureCardCreated() {
    if (this._cardPromise) return this._cardPromise;
    this._cardPromise = (async () => {
      const cid = await createCardEntity(buildChatCardInitial(this.scene));
      if (!cid) throw new Error('createCardEntity 返回 null');
      this.cardId = cid;
      this.messageId = await sendCardById(this.receiveId, this.receiveIdType, cid);
      console.log(`[Bot/Stream] 卡片已创建 cardId=${cid} scene=${this.scene}`);
    })().catch(err => {
      this._cardPromise = null;
      throw err;
    });
    return this._cardPromise;
  }

  /**
   * 为 round 插入思考胶囊 — **同步** enqueue 保证排在后续 stream 之前
   */
  ensureThinkingPillForRound(round) {
    return this._memoize(this._pillPromises, round, () =>
      this._enqueue(`insert thinking_pill_r${round}`, async () => {
        await this.ensureCardCreated();
        const ok = await insertCardElements(this.cardId, buildThinkingPill(round), {
          type: 'append',
        });
        if (!ok) throw new Error(`insertCardElements(thinking_pill_r${round}) 返回 false`);
        console.log(`[Bot/Stream] thinking_pill_r${round} 已插入`);
      })
    );
  }

  /**
   * 删除某 round 的思考胶囊（text 首 chunk 到来触发）
   */
  deleteThinkingPill(round) {
    if (round === null || round === undefined) return Promise.resolve();
    const pillPromise = this._pillPromises.get(round);
    if (!pillPromise) return Promise.resolve();   // 该轮从未创建胶囊
    return this._enqueue(`delete thinking_pill_r${round}`, async () => {
      await pillPromise;   // 等胶囊真正存在
      await deleteCardElement(this.cardId, `thinking_pill_r${round}`);
      console.log(`[Bot/Stream] thinking_pill_r${round} 已删除`);
    });
  }

  // ── 节流推送 ──
  _state(elementId) {
    let st = this.flushState.get(elementId);
    if (!st) {
      st = { lastFlushTime: 0, lastFlushedLen: 0, timer: null };
      this.flushState.set(elementId, st);
    }
    return st;
  }

  scheduleFlush(elementId, getContent) {
    const st = this._state(elementId);
    const content = getContent();
    const newChars = content.length - st.lastFlushedLen;
    const elapsed = Date.now() - st.lastFlushTime;

    if (elapsed >= THROTTLE_MS || newChars >= FLUSH_AT_CHARS) {
      this.flushElement(elementId, content);
      return;
    }

    if (!st.timer) {
      const wait = Math.max(0, THROTTLE_MS - elapsed);
      st.timer = setTimeout(() => {
        st.timer = null;
        this.flushElement(elementId, getContent());
      }, wait);
    }
  }

  flushElement(elementId, content) {
    const st = this._state(elementId);
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    st.lastFlushTime = Date.now();
    st.lastFlushedLen = content.length;

    return this._enqueue(`stream ${elementId}`, async () => {
      await this.ensureCardCreated();
      if (!this.cardId) return;
      await streamCardText(this.cardId, elementId, content);
    });
  }

  cancelAllPending() {
    for (const st of this.flushState.values()) {
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    }
  }

  // ── 事件处理 ──

  onThinkingChunk(delta, round = 0) {
    // 累积到该轮的 thinking 池
    const cur = this.runningThinkingByRound.get(round) || '';
    this.runningThinkingByRound.set(round, cur + delta);

    // 如果当前屏幕上没有胶囊（或者是不同 round 的残留），建立新胶囊
    if (this._currentPillRound !== round) {
      // 清理任何残留的旧胶囊（比如前一轮只有 thinking 没有 text，胶囊还留着）
      if (this._currentPillRound !== null && this._currentPillRound !== round) {
        this.deleteThinkingPill(this._currentPillRound);
      }
      this.ensureThinkingPillForRound(round).catch(() => {});
      this._currentPillRound = round;
    }

    this.scheduleFlush(`thinking_text_r${round}`, () => this.runningThinkingByRound.get(round));
  }

  onTextChunk(delta, round = 0) {
    this.runningText += delta;
    this.ensureCardCreated().catch(() => {});

    // 首个 text chunk 到来，删掉当前胶囊（如果有）
    if (this._currentPillRound !== null) {
      const toDelete = this._currentPillRound;
      this._currentPillRound = null;
      this.deleteThinkingPill(toDelete);
    }

    this.scheduleFlush('main_text_0', () => this.runningText);
  }

  async onToolStart(_toolSteps) {
    // 工具调用淡化：不插任何 UI，只确保卡片已创建
    this.ensureCardCreated().catch(() => {});
  }

  async onToolDone(_toolSteps) {
    // 下一轮文本接续：给累积文本加段落间隙（如果已有内容）
    if (this.runningText && !this.runningText.endsWith('\n\n')) {
      this.runningText += '\n\n';
    }
  }

  async onComplete(finalText) {
    this.cancelAllPending();
    if (!this.cardId) {
      // 整个流式过程没产生任何 chunks，降级一次性发
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    // 清理残留胶囊（比如最后一轮只有 thinking 没有 text 就完成）
    if (this._currentPillRound !== null) {
      this.deleteThinkingPill(this._currentPillRound);
      this._currentPillRound = null;
    }
    // 先流式把最终文本推完（保留打字机效果）
    this.flushElement('main_text_0', finalText);

    // 等队列全部排完（insert/delete/stream 全部落地）
    await this._opQueue;

    // card.update 整体切到完成态（header 变绿勾 + 完成 subtitle，body 保留 main_text_0）
    const durationMs = Date.now() - this.startTime;
    const finalCard = buildCompletionCard(this.scene, durationMs, finalText);
    await this._enqueue('final card.update', () => updateCardEntity(this.cardId, finalCard));
    await this._opQueue;
    console.log(`[Bot/Stream] 已切到完成态 scene=${this.scene} duration=${(durationMs/1000).toFixed(1)}s`);
  }

  async onDirectReply(finalText) {
    this.cancelAllPending();
    if (!this.cardId) {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    if (this._currentPillRound !== null) {
      this.deleteThinkingPill(this._currentPillRound);
      this._currentPillRound = null;
    }
    this.flushElement('main_text_0', finalText);
    await this._opQueue;

    const durationMs = Date.now() - this.startTime;
    const finalCard = buildCompletionCard(this.scene, durationMs, finalText);
    await this._enqueue('final card.update', () => updateCardEntity(this.cardId, finalCard));
    await this._opQueue;
  }

  async onError(text) {
    this.cancelAllPending();
    if (!this.cardId) {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(text, { level: 'error' }));
      return;
    }
    // 清理胶囊 + 切错误态整卡
    if (this._currentPillRound !== null) {
      this.deleteThinkingPill(this._currentPillRound);
      this._currentPillRound = null;
    }
    await this._opQueue;
    const errorCard = buildErrorCard(text);
    await this._enqueue('final card.update(error)', () => updateCardEntity(this.cardId, errorCard));
    await this._opQueue;
  }
}

// ============================================================
//  消息处理
// ============================================================

async function handleMessage(text, chatId, userId, chatType) {
  const receiveId = chatType === 'p2p' ? userId : chatId;
  const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';

  // ── 绑定指令（不经过 LLM）──
  const bindMatch = text.match(/^绑定\s+(\S+)\s+(\S+)$/);
  if (bindMatch) {
    if (chatType !== 'p2p') {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard('请私聊我来绑定账号，避免密码泄露~', { level: 'warn' }));
      return;
    }
    const [, username, password] = bindMatch;
    const result = bindFeishuUser(username, password, userId);
    if (result.ok) {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard(`绑定成功！你好 ${result.displayName}，以后工单有动态我会通知你。`,
          { level: 'success' }));
    } else {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard(`绑定失败：${result.reason}。\n\n格式：\`绑定 用户名 密码\``,
          { level: 'warn' }));
    }
    return;
  }

  const { status } = await enqueueMessage(userId, async () => {
    const boundUser = getUserByOpenId(userId);

    // ── 场景预判 + TTFP 预创建 ──
    const scene = detectScene(text);
    console.log(`[Bot/Stream] scene=${scene} text=${text.slice(0, 40)}`);

    let presetCardId = null;
    let presetMessageId = null;
    try {
      const { cardId, messageId } = await createAndSendCard(
        receiveId, receiveIdType, buildChatCardInitial(scene)
      );
      presetCardId = cardId;
      presetMessageId = messageId;
      if (cardId) console.log(`[Bot/Stream] 卡片预创建 cardId=${cardId} scene=${scene}`);
    } catch (err) {
      console.warn('[Bot] 卡片预创建失败，降级到首个 chunk 触发:', err.message);
    }

    const streamer = new ChatCardStreamer(receiveId, receiveIdType, {
      scene,
      presetCardId,
      presetMessageId,
    });

    const onProgress = async (event) => {
      try {
        switch (event.type) {
          case 'text_chunk':
            if (event.delta) streamer.onTextChunk(event.delta, event.round || 0);
            break;
          case 'thinking_chunk':
            if (event.delta) streamer.onThinkingChunk(event.delta, event.round || 0);
            break;
          case 'tool_start':
            await streamer.onToolStart(event.toolSteps);
            break;
          case 'tool_done':
            await streamer.onToolDone(event.toolSteps);
            break;
          case 'complete':
            await streamer.onComplete(event.text);
            break;
          case 'direct_reply':
            await streamer.onDirectReply(event.text);
            break;
          case 'error':
            await streamer.onError(event.text);
            break;
        }
      } catch (err) {
        console.error(`[Bot] onProgress(${event.type}) 错误:`, err.message);
      }
    };

    try {
      const { messages, toolLog } = getSession(userId);
      const { text: reply, toolSummaries } = await chat(text, messages, onProgress, boundUser, toolLog);
      updateSession(userId, text, reply, toolSummaries);
    } catch (err) {
      console.error('[Bot] 消息处理错误:', err);
      await streamer.onError('抱歉，我暂时无法处理请求，请稍后再试。').catch(() => {});
    }
  });

  if (status === 'backpressure') {
    await createAndSendCard(receiveId, receiveIdType,
      buildSimpleCard('我还在处理你之前的消息，稍等一下~', { level: 'info' }));
  }
}
