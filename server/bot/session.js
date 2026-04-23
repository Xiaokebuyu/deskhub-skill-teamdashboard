/**
 * 会话记忆
 * 对话记忆与工具记忆分离：
 *   messages — 干净的 user/assistant 文本对（50 轮）
 *   toolLog  — 工具调用摘要滑动窗口（最近 20 条）
 *
 * 工具数据用完即弃：当前轮内 toolUseLoop 保持完整（API 要求），
 * 生成最终回复后只保留文本 + 工具摘要。
 *
 * Session 过期（TTL 30min 无动静）时触发蒸馏：
 *   - 独立 LLM 调用，把本轮对话的软信息写进 per-user memory
 *   - per-user 独立 queue，防并发
 *   - 蒸馏完成后 session 删除（下次进来是全新 session + 更新后的 memory 注入）
 */

import { distillSession } from './memory/distill.js';

const SESSION_TTL = Number(process.env.BOT_SESSION_TTL_MS) || 30 * 60 * 1000;   // 30 分钟
const MAX_ROUNDS = 50;                  // 50 轮对话（100 条消息）
const MAX_TOOL_LOG = 20;               // 工具日志保留最近 20 条
const CLEANUP_INTERVAL = 60 * 1000;

/** @type {Map<string, {messages: Array, toolLog: Array<string>, lastActive: number}>} */
const sessions = new Map();

/** per-user 蒸馏队列（Promise 串） */
const distillQueue = new Map();

let cleanupTimer = null;

export function startSessionCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (now - session.lastActive > SESSION_TTL) {
        // 触发蒸馏 + 切上下文
        enqueueDistill(key, session.messages);
        sessions.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  cleanupTimer.unref?.();
}

export function stopSessionCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * 入队一次蒸馏（per-user 串行）
 * 失败只记日志，不 rethrow；memory 是尽力而为
 */
function enqueueDistill(openId, messagesSnapshot) {
  if (!Array.isArray(messagesSnapshot) || messagesSnapshot.length < 2) return;

  const prev = distillQueue.get(openId) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      const started = Date.now();
      const result = await distillSession(openId, messagesSnapshot);
      const ms = Date.now() - started;
      const summary = (result?.text || '').slice(0, 80).replace(/\n/g, ' ');
      console.log(`[Bot/Distill] ${openId} done in ${ms}ms — ${summary}`);
    } catch (err) {
      console.error(`[Bot/Distill] ${openId} failed:`, err.message);
    } finally {
      // 自己是最后一个 → 清 queue
      if (distillQueue.get(openId) === next) distillQueue.delete(openId);
    }
  });
  distillQueue.set(openId, next);
  return next;
}

/**
 * 获取用户的会话历史
 * @param {string} userId - 飞书 user open_id
 * @returns {{ messages: Array, toolLog: string[] }}
 */
export function getSession(userId) {
  const session = sessions.get(userId);
  if (!session || Date.now() - session.lastActive > SESSION_TTL) {
    return { messages: [], toolLog: [] };
  }
  return { messages: session.messages, toolLog: session.toolLog };
}

/**
 * 更新用户会话：存干净文本 + 工具摘要
 * @param {string} userId
 * @param {string} userText - 用户输入
 * @param {string} replyText - 助手最终回复文本
 * @param {string[]} toolSummaries - 本轮工具调用摘要
 */
export function updateSession(userId, userText, replyText, toolSummaries = []) {
  let session = sessions.get(userId);
  if (!session || Date.now() - session.lastActive > SESSION_TTL) {
    session = { messages: [], toolLog: [], lastActive: Date.now() };
    sessions.set(userId, session);
  }

  // 对话历史：只存文本对
  session.messages.push(
    { role: 'user', content: userText },
    { role: 'assistant', content: [{ type: 'text', text: replyText }] },
  );
  if (session.messages.length > MAX_ROUNDS * 2) {
    session.messages = session.messages.slice(-MAX_ROUNDS * 2);
  }

  // 工具日志：追加摘要，滑动窗口
  if (toolSummaries.length > 0) {
    session.toolLog.push(...toolSummaries);
    if (session.toolLog.length > MAX_TOOL_LOG) {
      session.toolLog = session.toolLog.slice(-MAX_TOOL_LOG);
    }
  }

  session.lastActive = Date.now();
}

/**
 * 给 get_system_health 工具用：返回当前 session 数
 */
export function getActiveSessionCount() {
  return sessions.size;
}

/**
 * 测试/调试用：手动强制蒸馏某个 session（不等 TTL）
 */
export function forceDistill(userId) {
  const session = sessions.get(userId);
  if (!session) return Promise.resolve();
  const snapshot = session.messages.slice();
  sessions.delete(userId);
  return enqueueDistill(userId, snapshot);
}
