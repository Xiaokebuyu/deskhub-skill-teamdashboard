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
  patchCardElement,
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
  buildChatCardInitialFromHeader,
  buildLLMHeader,
  buildThinkingPill,
  buildPillCollapsePatch,
  buildCompletionCard,
  buildErrorCard,
  buildSimpleCard,
} from './card-templates.js';
import { summarizeThinking } from './summary-model.js';
import { MarkupStream } from './markup-parser.js';
import { renderMarkup } from './markup-renderers.js';
import { getUserByUsername } from '../mcp/db-ops.js';
import {
  buildIconProbeCard,
  buildColorProbeCard,
  buildHeaderTemplateProbeCard,
  HEADER_TEMPLATES,
} from './_probe-cards.js';

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
  constructor(receiveId, receiveIdType, { scene = 'default', presetCardId = null, presetMessageId = null, llmHeaderMode = false } = {}) {
    this.receiveId = receiveId;
    this.receiveIdType = receiveIdType;
    this.scene = scene;
    this.startTime = Date.now();
    this.cardId = presetCardId;
    this.messageId = presetMessageId;

    // ── LLM header 控制（Stage C） ──
    // llmHeaderMode=true：不预创建卡片，buffer 所有 chunks，等 LLM 在首个 text chunk 里
    // 输出 [[header:title|subtitle|template]] 指令后才 createCard。2s 兜底用 default header。
    this._llmHeaderMode = llmHeaderMode;
    this._headerResolved = !llmHeaderMode;   // preset 模式一开始就 resolved
    this._pendingEvents = [];
    this._bufferedText = '';
    this._headerTimer = null;
    if (llmHeaderMode) {
      this._headerTimer = setTimeout(() => {
        if (!this._headerResolved) {
          console.log('[Bot/Stream] header 2s timeout，fallback 到 default');
          this._resolveHeader(null);
        }
      }, 2000);
    }

    // ── 多段 main_text 状态 ──
    // _segments 和 _bodyElements 同步维护：每段对应一个 markdown element
    // block markup 会在 _bodyElements 里插入一个"非段"元素（interactive_container/hr/...）
    // onComplete 时直接用 _bodyElements 重建 final card body，保留所有嵌入组件
    this._segments = [{ id: 'main_text_0', text: '' }];
    this._bodyElements = [{ tag: 'markdown', element_id: 'main_text_0', content: '' }];
    this._currentSegmentId = 'main_text_0';
    this._markupStream = new MarkupStream();
    this._blockMarkupCounter = 0;

    // LLM 回答里任何位置 emit [[header:title|subtitle|template]] 会被捕获到这里
    // onComplete/onDirectReply 的 card.update 用它覆盖预判的完成态 header
    this._llmHeader = null;

    this.runningThinkingByRound = new Map();   // round → 该轮思考累积
    this._thinkingStartByRound = new Map();    // round → 首 thinking chunk 时间戳

    // ── Promise 备忘锁 ──
    this._cardPromise = presetCardId ? Promise.resolve() : null;
    this._pillPromises = new Map();   // round → insert pill promise
    this._pillCollapsedRounds = new Set();  // 已触发收起的 round（防重复 patch）
    this._currentPillRound = null;    // 当前屏幕上存在（未收起）的思考胶囊 round，无则 null

    // ── per-card FIFO op queue ──
    this._opQueue = Promise.resolve();

    // per-element 节流
    this.flushState = new Map();

    // ── 失败 element 黑名单 ──
    // 当 insertCardElements 返 false（schema 错/权限错），block 或段从未真正存在，
    // 但乐观状态机已经同步往 _bodyElements / _currentSegmentId 推进。
    // 把失败 ID 记在这里，用来：
    //   1. _aliveAnchor() 把后续 insert/stream 的 target 重定向到最近活 element
    //   2. flushElement 对失败段直接 skip，不打 API（避 300313 连环噪音）
    //   3. _finalBodyElements() 在 onComplete 的 card.update 前过滤掉，不让坏 schema 再犯
    this._failedElementIds = new Set();
  }

  /**
   * 把 anchor ID 映射到"一定存在"的 element ID。
   * targetId 在黑名单里 → 从 _bodyElements 反向找第一个非占位非黑名单的 element。
   * 兜底永远是 main_text_0（首段，创建卡片时一并存在）。
   */
  _aliveAnchor(targetId) {
    if (!this._failedElementIds.has(targetId)) return targetId;
    for (let i = this._bodyElements.length - 1; i >= 0; i--) {
      const el = this._bodyElements[i];
      if (!el || el._markupPlaceholder) continue;
      const eid = el.element_id;
      if (!eid) continue;
      if (this._failedElementIds.has(eid)) continue;
      return eid;
    }
    return 'main_text_0';
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
   * llmHeaderMode 下，由 _resolveHeader 调用 _createCardWithHeader，此处直接返 _cardPromise
   */
  ensureCardCreated() {
    if (this._cardPromise) return this._cardPromise;
    if (this._llmHeaderMode) {
      // 未 resolve 时不应被调到（event handlers 会 guard），兜底返 reject 以防万一
      return Promise.reject(new Error('ensureCardCreated called before header resolved'));
    }
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

  /** 扫一段文本里首个完整的 [[header:title|subtitle|template]] markup */
  _scanHeaderMarkup(text) {
    const m = text.match(/\[\[header:([^\]]+)\]\]/);
    if (!m) return null;
    const args = m[1].split('|').map(s => s.trim());
    return {
      title: args[0] || '小合',
      subtitle: args[1] || '',
      template: args[2] || 'default',
      consumed: m[0],
    };
  }

  /** 用 LLM 给的 header 建卡，或没 markup 时走 default */
  _createCardWithHeader(headerObj) {
    return (async () => {
      const cid = await createCardEntity(buildChatCardInitialFromHeader(headerObj));
      if (!cid) throw new Error('createCardEntity 返回 null');
      this.cardId = cid;
      this.messageId = await sendCardById(this.receiveId, this.receiveIdType, cid);
      console.log(`[Bot/Stream] 卡片已创建（LLM header） cardId=${cid} title=${headerObj.title.content} tpl=${headerObj.template}`);
    })();
  }

  /**
   * 解析 buffer 里的 header markup（或用 default），createCard，replay 所有缓冲事件
   * 只能调一次（_headerResolved 保护）
   */
  _resolveHeader(bufferedText) {
    if (this._headerResolved) return;
    this._headerResolved = true;
    if (this._headerTimer) { clearTimeout(this._headerTimer); this._headerTimer = null; }

    const parsed = bufferedText ? this._scanHeaderMarkup(bufferedText) : null;
    const headerObj = parsed
      ? buildLLMHeader(parsed)
      : buildLLMHeader({ title: '小合', subtitle: '我在', template: 'default' });

    this._cardPromise = this._createCardWithHeader(headerObj).catch(err => {
      this._cardPromise = null;
      throw err;
    });

    // ── Replay buffered events ──
    const pending = this._pendingEvents;
    this._pendingEvents = [];
    const bufText = this._bufferedText;
    this._bufferedText = '';

    // 把 header markup 从文本里去掉，其余照常喂 onTextChunk（会经过 markup parser）
    const strippedText = parsed
      ? bufText.replace(parsed.consumed, '').replace(/^\s*\n+/, '')
      : bufText;

    // 按事件类型分组 squash（假设 pending 事件都是 round 0，order: thinking* → text* → tool_start*）
    const thinkingByRound = new Map();
    const toolEvents = [];
    for (const evt of pending) {
      if (evt.type === 'thinking') {
        const cur = thinkingByRound.get(evt.round || 0) || '';
        thinkingByRound.set(evt.round || 0, cur + evt.delta);
      } else if (evt.type === 'tool_start') {
        toolEvents.push(evt);
      }
      // text 事件通过 strippedText 一次性回放
    }
    // 先 thinking
    for (const [round, text] of thinkingByRound) {
      if (text) this.onThinkingChunk(text, round);
    }
    // 再 tool_start（少见）
    for (const evt of toolEvents) {
      this.onToolStart(evt.toolSteps);
    }
    // 最后 text
    if (strippedText) {
      this.onTextChunk(strippedText, 0);
    }
  }

  /**
   * 为 round 插入思考胶囊 — 插在当前段上方（insert_before 当前 segment）
   * 也同步登记到 _bodyElements，便于 collapse 时更新 + onComplete 时保留
   */
  ensureThinkingPillForRound(round) {
    return this._memoize(this._pillPromises, round, () => {
      // 同步登记到 _bodyElements：找到当前段位置，把胶囊元素 splice 到它前面
      const pillElement = buildThinkingPill(round)[0];   // 返回数组，取第一个
      const targetSegId = this._currentSegmentId;
      const targetIdx = this._bodyElements.findIndex(e => e.element_id === targetSegId);
      if (targetIdx >= 0) {
        this._bodyElements.splice(targetIdx, 0, pillElement);
      } else {
        // 兜底（不应发生）：push 到末尾
        this._bodyElements.push(pillElement);
      }
      return this._enqueue(`insert thinking_pill_r${round}`, async () => {
        await this.ensureCardCreated();
        const anchor = this._aliveAnchor(targetSegId);
        const ok = await insertCardElements(this.cardId, [pillElement], {
          type: 'insert_before',
          targetElementId: anchor,
        });
        if (!ok) {
          this._failedElementIds.add(`thinking_pill_r${round}`);
          throw new Error(`insertCardElements(thinking_pill_r${round}) 返回 false`);
        }
        console.log(`[Bot/Stream] thinking_pill_r${round} 已插入 before=${anchor}`);
      });
    });
  }

  /**
   * 把某 round 的思考胶囊收起并填摘要（替代旧的 deleteThinkingPill）
   * 双轨：
   *   - 立即 enqueue 兜底 patch（仅含耗时），同时 mutate _bodyElements 的 pill 条目
   *   - 异步跑摘要，回来后 enqueue 二次 patch 用摘要覆盖，同步 mutate _bodyElements
   * 最终 onComplete 的 card.update 用 _bodyElements 重建 body，胶囊作为收起态保留
   */
  collapsePillWithSummary(round) {
    if (round === null || round === undefined) return;
    if (this._pillCollapsedRounds.has(round)) return;   // 已收起过，不重复
    const pillPromise = this._pillPromises.get(round);
    if (!pillPromise) return;   // 该轮根本没创建过胶囊
    this._pillCollapsedRounds.add(round);

    const capturedCardId = this.cardId;
    const pillId = `thinking_pill_r${round}`;
    const startTs = this._thinkingStartByRound.get(round) || this.startTime;
    const durationSec = (Date.now() - startTs) / 1000;
    const rawThinking = this.runningThinkingByRound.get(round) || '';

    console.log(`[Bot/Stream] collapsePillWithSummary round=${round} thinking_len=${rawThinking.length} duration=${durationSec.toFixed(1)}s`);

    // 先同步 mutate _bodyElements 的胶囊条目（兜底无摘要版本），保证 onComplete 时有收起态
    this._mutatePillInBody(pillId, null, durationSec);

    // 立即 enqueue 兜底 patch
    this._enqueue(`collapse pill fallback r${round}`, async () => {
      await pillPromise;
      if (!capturedCardId) return;
      await patchCardElement(capturedCardId, pillId, buildPillCollapsePatch(null, durationSec));
      console.log(`[Bot/Stream] ${pillId} 已收起（兜底 duration=${durationSec.toFixed(1)}s）`);
    });

    // 异步跑摘要模型
    console.log(`[Bot/Summary] 发起摘要请求 round=${round} input=${rawThinking.length}字`);
    summarizeThinking(rawThinking).then(summary => {
      console.log(`[Bot/Summary] round=${round} 返回 result=${summary ? `"${summary}"` : 'null'}`);
      if (!summary) return;
      // 同步 mutate _bodyElements（用摘要覆盖）
      this._mutatePillInBody(pillId, summary, durationSec);
      this._enqueue(`patch pill summary r${round}`, async () => {
        if (!capturedCardId) {
          console.warn(`[Bot/Stream] patch pill summary r${round} 跳过（cardId 为空）`);
          return;
        }
        if (this.cardId !== capturedCardId) {
          console.warn(`[Bot/Stream] patch pill summary r${round} 跳过（cardId 已换）`);
          return;
        }
        await patchCardElement(capturedCardId, pillId, buildPillCollapsePatch(summary, durationSec));
        console.log(`[Bot/Stream] ${pillId} 摘要已填充 → "${summary}"`);
      });
    }).catch(err => {
      console.warn(`[Bot/Summary] round=${round} .then 异常:`, err?.message || err);
    });
  }

  /** 就地 mutate _bodyElements 中指定胶囊的 expanded + title，保 onComplete 时 card.update 带正确状态 */
  _mutatePillInBody(pillId, summary, durationSec) {
    const el = this._bodyElements.find(e => e.element_id === pillId);
    if (!el) return;
    el.expanded = false;
    const dur = Number(durationSec).toFixed(1);
    const title = summary ? `● 思考 ${dur}s · ${summary}` : `● 思考 ${dur}s`;
    if (el.header && el.header.title) {
      el.header.title.content = title;
    }
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

    // 段在黑名单 → 本地 skip，不打 API、不刷日志（避免 code=300313 not find elementID 刷屏）
    if (this._failedElementIds.has(elementId)) {
      return Promise.resolve();
    }

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
    // Stage C：header 未 resolve 时先 buffer
    if (!this._headerResolved) {
      this._pendingEvents.push({ type: 'thinking', delta, round });
      return;
    }
    // 记录该轮起始时间（首 chunk）
    if (!this._thinkingStartByRound.has(round)) {
      this._thinkingStartByRound.set(round, Date.now());
    }
    // 累积到该轮的 thinking 池
    const cur = this.runningThinkingByRound.get(round) || '';
    const full = cur + delta;
    this.runningThinkingByRound.set(round, full);

    // 同步到 _bodyElements 的胶囊嵌套 thinking_text 元素，保 onComplete 的 card.update
    // 能把完整 thinking 内容带进去（否则 body 重建时只剩空字符串，用户展开胶囊啥也看不到）
    const pillEl = this._bodyElements.find(e => e.element_id === `thinking_pill_r${round}`);
    if (pillEl && pillEl.elements && pillEl.elements[0]) {
      pillEl.elements[0].content = full;
    }

    // 如果当前屏幕上没有胶囊（或者是不同 round 的残留），建立新胶囊
    if (this._currentPillRound !== round) {
      // 清理任何残留的旧胶囊（比如前一轮只有 thinking 没有 text，胶囊还留着）
      if (this._currentPillRound !== null && this._currentPillRound !== round) {
        this.collapsePillWithSummary(this._currentPillRound);
      }
      this.ensureThinkingPillForRound(round).catch(() => {});
      this._currentPillRound = round;
    }

    this.scheduleFlush(`thinking_text_r${round}`, () => this.runningThinkingByRound.get(round));
  }

  onTextChunk(delta, round = 0) {
    // Stage C：header 未 resolve 时 buffer 并尝试解析
    if (!this._headerResolved) {
      this._bufferedText += delta;
      this._pendingEvents.push({ type: 'text', delta, round });
      const trimmed = this._bufferedText.replace(/^\s+/, '');
      // 快失败：LLM 首文本不是 `[` 开头 → 不遵守 header 规约，立即 fallback 不等 2s
      if (trimmed.length >= 2 && !trimmed.startsWith('[')) {
        console.log(`[Bot/Stream] 首文本非 [[ 开头（"${trimmed.slice(0, 20)}..."），立即 fallback default`);
        this._resolveHeader(null);
        return;
      }
      // 一旦 buffer 里出现 `]]` 说明至少一个 markup 闭合，或 100 字后兜底
      if (this._bufferedText.includes(']]') || this._bufferedText.length >= 100) {
        this._resolveHeader(this._bufferedText);
      }
      return;
    }
    this.ensureCardCreated().catch(() => {});

    // 首个 text chunk 到来，收起当前胶囊（异步填摘要）
    if (this._currentPillRound !== null) {
      const toCollapse = this._currentPillRound;
      this._currentPillRound = null;
      this.collapsePillWithSummary(toCollapse);
    }

    // 流式喂入 markup parser，拿回已定稿的 parts
    const parts = this._markupStream.feed(delta);
    for (const part of parts) {
      if (part.kind === 'text') {
        this._appendToCurrentSegment(part.text);
      } else if (part.kind === 'markup' && part.placement === 'inline') {
        this._appendToCurrentSegment(this._renderInlineSync(part.tag, part.args));
      } else if (part.kind === 'markup' && part.placement === 'block') {
        this._handleBlockMarkup(part.tag, part.args, part.body);
      }
    }
  }

  /** 把 text 追加到当前段，更新 body 镜像，调度 flush */
  _appendToCurrentSegment(text) {
    if (!text) return;
    const seg = this._segments.find(s => s.id === this._currentSegmentId);
    if (!seg) return;
    seg.text += text;
    // 镜像到 _bodyElements（最终 card.update 用）
    const el = this._bodyElements.find(e => e.element_id === this._currentSegmentId);
    if (el) el.content = seg.text;
    // 流式推到飞书
    this.scheduleFlush(seg.id, () => seg.text);
  }

  /** 内联 markup 同步渲染（user / link），返回拼进文本的字符串 */
  _renderInlineSync(tag, args) {
    if (tag === 'user') {
      const name = args[0] || '';
      const u = name ? getUserByUsername(name) : null;
      if (u && u.feishuOpenId) return `<person id='${u.feishuOpenId}'>${u.displayName}</person>`;
      return `**${u ? u.displayName : name}**`;
    }
    if (tag === 'link') {
      const url = args[0] || '#';
      const label = args[1] || url;
      return `[${label}](${url})`;
    }
    return '';
  }

  /**
   * 处理 block markup：异步 kick off 数据拉取 + enqueue 插入 + 开新段
   * 关键：renderMarkup 立刻调用（数据 fetch 并行进行），insert 操作进队列等数据回来
   */
  _handleBlockMarkup(tag, args, body) {
    // header markup 特殊：捕获参数但不插 body，onComplete 时用来 card.update 覆盖完成态 header
    if (tag === 'header') {
      const [title, subtitle, template] = args;
      this._llmHeader = { title, subtitle, template };
      console.log(`[Bot/Stream] LLM header 捕获: title="${title}" subtitle="${subtitle}" tpl="${template}"`);
      return;
    }

    const counter = ++this._blockMarkupCounter;
    const prevSegId = this._currentSegmentId;

    // 立即 kick off 数据拉取（不进队列）—— chart/table 的 body 同步传入，不 fetch 外部
    const renderPromise = renderMarkup(tag, args, counter, body);

    // 生成新段的 element_id 并先在 _segments/_bodyElements 里占位
    const newSegId = `main_text_${this._segments.length}`;

    this._enqueue(`markup block ${tag}#${counter}`, async () => {
      await this.ensureCardCreated();
      if (!this.cardId) return;
      const result = await renderPromise;
      if (!result || result.placement !== 'block' || !result.elements) {
        // renderer 失败：block 和新段都不会创建
        this._failedElementIds.add(newSegId);
        return;
      }

      // 先插 block 组件。prevSegId 可能已是黑名单（前一个 block 挂了），重定向到活 anchor
      const anchor1 = this._aliveAnchor(prevSegId);
      const ok1 = await insertCardElements(this.cardId, result.elements, {
        type: 'insert_after', targetElementId: anchor1,
      });
      if (!ok1) {
        // block 本体插失败（schema 错等）：block 和依赖它作 anchor 的新段都废
        this._failedElementIds.add(result.elementId);
        this._failedElementIds.add(newSegId);
        console.warn(`[Bot/Stream] block markup ${tag}#${counter} 插入失败 → 进黑名单 (elementId=${result.elementId}, seg=${newSegId})，后续 anchor 会重定向`);
        return;
      }
      // 再插空的新段 markdown（text 流将往这里推）
      const ok2 = await insertCardElements(this.cardId,
        [{ tag: 'markdown', element_id: newSegId, content: '' }],
        { type: 'insert_after', targetElementId: result.elementId }
      );
      if (!ok2) {
        // block 插成功但新段没建上 → block 保留，段进黑名单（后续文本会 skip 这段）
        this._failedElementIds.add(newSegId);
        console.warn(`[Bot/Stream] block markup ${tag}#${counter} 新段 ${newSegId} 插入失败 → 进黑名单`);
        return;
      }
      console.log(`[Bot/Stream] block markup ${tag}#${counter} 已插入（新段 ${newSegId}）`);
    });

    // 同步更新内部状态：_bodyElements 加 block + new segment，切 _currentSegmentId
    // 注意：此时卡片上 block 和 newSeg 还没创建，但后续 scheduleFlush(newSegId) 的 stream op 会
    //      在 _opQueue 里排在 block insert 任务之后，等它完成才执行，顺序正确
    const newSeg = { id: newSegId, text: '' };
    this._segments.push(newSeg);
    this._currentSegmentId = newSegId;

    // 先 push 一个占位 element 到 bodyElements（真 element_id 将在 render 后补）
    this._bodyElements.push({ _markupPlaceholder: true, tag, args, counter });
    this._bodyElements.push({ tag: 'markdown', element_id: newSegId, content: '' });

    // render 完成后把占位换成真 element，用于 onComplete 重建 body
    renderPromise.then(result => {
      if (!result || result.placement !== 'block' || !result.elements) return;
      const idx = this._bodyElements.findIndex(
        e => e._markupPlaceholder && e.tag === tag && e.counter === counter
      );
      if (idx >= 0) this._bodyElements.splice(idx, 1, ...result.elements);
    }).catch(() => {});
  }

  async onToolStart(toolSteps) {
    // Stage C：tool_use 先于任何 text 说明 LLM 跳过了 header markup（违规），用 default 兜底
    if (this._llmHeaderMode && !this._headerResolved) {
      console.log('[Bot/Stream] tool_start 前未见 header markup，fallback default');
      this._resolveHeader(null);
    }
    // 工具调用淡化：不插任何 UI，只确保卡片已创建
    this.ensureCardCreated().catch(() => {});
  }

  async onToolDone(_toolSteps) {
    // 每轮 tool 跑完就开一个新 main_text 段，下一轮的 pill 和 text 都走新段
    // 这样多轮对话的 layout 变成：text_0 / pill_r1 / text_1 / pill_r2 / text_2 ...
    // 而不是全部 pill 堆在顶部挤爆 text_0
    const prevSegId = this._currentSegmentId;
    const newSegId = `main_text_${this._segments.length}`;
    const newSeg = { id: newSegId, text: '' };
    this._segments.push(newSeg);
    this._currentSegmentId = newSegId;

    // 在 _bodyElements 里 prevSeg 后面 splice 新段
    const idx = this._bodyElements.findIndex(e => e.element_id === prevSegId);
    const newSegEl = { tag: 'markdown', element_id: newSegId, content: '' };
    if (idx >= 0) this._bodyElements.splice(idx + 1, 0, newSegEl);
    else this._bodyElements.push(newSegEl);

    // enqueue insert_after 创建新段元素
    this._enqueue(`open seg ${newSegId} after tool`, async () => {
      await this.ensureCardCreated();
      if (!this.cardId) return;
      const anchor = this._aliveAnchor(prevSegId);
      const ok = await insertCardElements(this.cardId, [newSegEl], {
        type: 'insert_after', targetElementId: anchor,
      });
      if (!ok) {
        this._failedElementIds.add(newSegId);
        console.warn(`[Bot/Stream] 新段 ${newSegId} 插入失败 after=${anchor} → 进黑名单`);
        return;
      }
      console.log(`[Bot/Stream] 新段 ${newSegId} 已插入 after=${anchor}`);
    });
  }

  async onComplete(finalText) {
    this.cancelAllPending();
    // Stage C：若 complete 时 header 仍未 resolve（极罕见：整个流无 text 无 tool），用 finalText 兜底扫一遍
    if (this._llmHeaderMode && !this._headerResolved) {
      this._resolveHeader(finalText || null);
      if (this._cardPromise) await this._cardPromise.catch(() => {});
    }
    if (!this.cardId) {
      // 整个流式过程没产生任何 chunks，降级一次性发
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    // 收起残留胶囊（比如最后一轮只有 thinking 没有 text 就完成）
    if (this._currentPillRound !== null) {
      this.collapsePillWithSummary(this._currentPillRound);
      this._currentPillRound = null;
    }
    // flush parser 尾 buffer（未闭合的 `[[` 当普通文本）
    for (const part of this._markupStream.flush()) {
      if (part.kind === 'text') this._appendToCurrentSegment(part.text);
    }
    // 每段都 flush 一次最终状态（throttle 可能还在待推）
    for (const seg of this._segments) {
      this.flushElement(seg.id, seg.text);
    }
    // 等队列全部排完
    await this._opQueue;

    // card.update 整体切完成态。body 用重建好的 _bodyElements（含 markup 组件），
    // 而不是 finalText 裸文本（裸文本含 [[markup]] 语法，会被当普通字符显示）
    const durationMs = Date.now() - this.startTime;
    const bodyElements = this._finalBodyElements();
    const finalCard = buildCompletionCard(this.scene, durationMs, bodyElements);
    // LLM 在回答里自己选了 header？用它覆盖预判的完成态 header
    if (this._llmHeader) {
      finalCard.header = buildLLMHeader(this._llmHeader);
      console.log(`[Bot/Stream] 用 LLM 选的 header 覆盖完成态 title="${this._llmHeader.title}"`);
    }
    await this._enqueue('final card.update', () => updateCardEntity(this.cardId, finalCard));
    await this._opQueue;
    console.log(`[Bot/Stream] 已切到完成态 scene=${this.scene} duration=${(durationMs/1000).toFixed(1)}s segments=${this._segments.length} llmHeader=${this._llmHeader ? 'yes' : 'no'}`);
  }

  /**
   * 重建最终 body：
   *   - 过滤未 resolve 的 markup placeholder（fetch 失败的情况）
   *   - 过滤黑名单里的失败 element（带坏 schema 会让 card.update 整张挂掉）
   *   - 过滤空白 markdown 段（空段 streamCardText 返 code=99992402；留着也是视觉噪音）
   *   - 兜底：空 body 时放一个占位 markdown，避免 card.update body=[] 被拒
   */
  _finalBodyElements() {
    const filtered = this._bodyElements.filter(e => {
      if (!e) return false;
      if (e._markupPlaceholder) return false;
      if (e.element_id && this._failedElementIds.has(e.element_id)) return false;
      if (e.tag === 'markdown' && typeof e.content === 'string' && !e.content.trim()) return false;
      return true;
    });
    if (filtered.length === 0) {
      return [{ tag: 'markdown', element_id: 'main_text_0', content: '（内容为空）' }];
    }
    return filtered;
  }

  async onDirectReply(finalText) {
    this.cancelAllPending();
    if (this._llmHeaderMode && !this._headerResolved) {
      this._resolveHeader(finalText || null);
      if (this._cardPromise) await this._cardPromise.catch(() => {});
    }
    if (!this.cardId) {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    if (this._currentPillRound !== null) {
      this.collapsePillWithSummary(this._currentPillRound);
      this._currentPillRound = null;
    }
    for (const part of this._markupStream.flush()) {
      if (part.kind === 'text') this._appendToCurrentSegment(part.text);
    }
    for (const seg of this._segments) {
      this.flushElement(seg.id, seg.text);
    }
    await this._opQueue;

    const durationMs = Date.now() - this.startTime;
    const bodyElements = this._finalBodyElements();
    const finalCard = buildCompletionCard(this.scene, durationMs, bodyElements);
    if (this._llmHeader) {
      finalCard.header = buildLLMHeader(this._llmHeader);
    }
    await this._enqueue('final card.update', () => updateCardEntity(this.cardId, finalCard));
    await this._opQueue;
  }

  async onError(text) {
    this.cancelAllPending();
    // Stage C：若 header 未 resolve，直接发一次性错误卡（不用 LLM header）
    if (this._llmHeaderMode && this._headerTimer) {
      clearTimeout(this._headerTimer);
      this._headerTimer = null;
    }
    if (!this.cardId) {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(text, { level: 'error' }));
      return;
    }
    // 收起残留胶囊 + 切错误态整卡
    if (this._currentPillRound !== null) {
      this.collapsePillWithSummary(this._currentPillRound);
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

  // ── 探测指令（dev-only，仅 p2p）──
  // /probe icons   - 测 icon token 可用性
  // /probe colors  - 测 icon color 值
  // /probe templates - 逐张发 header template 测试卡（13 张）
  // /probe all     - icons + colors（不含 templates 避免刷屏）
  const probeMatch = text.trim().match(/^\/probe(?:\s+(icons|colors|templates|all))?$/i);
  if (probeMatch) {
    if (chatType !== 'p2p') {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard('/probe 命令仅限私聊，群里刷屏了不好看~', { level: 'warn' }));
      return;
    }
    const target = (probeMatch[1] || 'all').toLowerCase();
    if (target === 'icons' || target === 'all') {
      await createAndSendCard(receiveId, receiveIdType, buildIconProbeCard());
    }
    if (target === 'colors' || target === 'all') {
      await createAndSendCard(receiveId, receiveIdType, buildColorProbeCard());
    }
    if (target === 'templates') {
      for (const tpl of HEADER_TEMPLATES) {
        await createAndSendCard(receiveId, receiveIdType, buildHeaderTemplateProbeCard(tpl));
      }
    }
    return;
  }

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

    // ── Header 模式分支 ──
    // BOT_HEADER_MODE=preset（默认）：关键词预判场景包 + 预创建卡片保 TTFP
    // BOT_HEADER_MODE=llm           ：LLM 用 [[header:...]] markup 自选（实验性，MiniMax 遵循度低）
    const headerMode = (process.env.BOT_HEADER_MODE || 'preset').toLowerCase();
    let streamer;

    if (headerMode === 'preset') {
      // Stage A/B 路径
      const scene = detectScene(text);
      console.log(`[Bot/Stream] preset mode scene=${scene} text=${text.slice(0, 40)}`);
      let presetCardId = null;
      let presetMessageId = null;
      try {
        const { cardId, messageId } = await createAndSendCard(
          receiveId, receiveIdType, buildChatCardInitial(scene)
        );
        presetCardId = cardId;
        presetMessageId = messageId;
        if (cardId) console.log(`[Bot/Stream] 卡片预创建 cardId=${cardId}`);
      } catch (err) {
        console.warn('[Bot] 卡片预创建失败，降级到首个 chunk 触发:', err.message);
      }
      // 飞书偶发 bug：createCardEntity 返回 cardId 后立即 sendCardById 命中
      // `code=230099 cardid is invalid`（服务端一致性延迟）。后台一切正常但用户收不到卡片，
      // streamer 会继续往 orphan cardId 打 2000 次 API + 跑摘要烧 token。
      // 规约：sendCardById 失败（messageId 为空）直接发错误卡告知 + 中止本轮，不跑 LLM。
      if (presetCardId && !presetMessageId) {
        console.error(`[Bot] sendCardById 失败（飞书侧一致性延迟/230099），orphan cardId=${presetCardId}，中止本轮`);
        await createAndSendCard(receiveId, receiveIdType,
          buildSimpleCard('飞书卡片服务暂时异常（错误在飞书侧，cardid is invalid），这一条没发出去。请稍后再发一次。', { level: 'error' }));
        return;   // 不 new streamer，不跑 LLM，直接退出本次 task
      }
      if (!presetCardId) {
        // createCardEntity 就失败了：cardId 都没有，连降级也不一定发得出。尽力一试。
        console.error('[Bot] createCardEntity 失败，中止本轮');
        await createAndSendCard(receiveId, receiveIdType,
          buildSimpleCard('飞书卡片服务暂时异常（create 失败），请稍后再试。', { level: 'error' })).catch(() => {});
        return;
      }
      streamer = new ChatCardStreamer(receiveId, receiveIdType, {
        scene, presetCardId, presetMessageId,
      });
    } else {
      // Stage C 路径
      console.log(`[Bot/Stream] llm header mode text=${text.slice(0, 40)}`);
      streamer = new ChatCardStreamer(receiveId, receiveIdType, { llmHeaderMode: true });
    }

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
      const { text: reply, toolSummaries } = await chat(text, messages, onProgress, boundUser, toolLog, { openId: userId });
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
