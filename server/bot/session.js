/**
 * 会话记忆
 * 对话记忆与工具记忆分离：
 *   messages — 干净的 user/assistant 文本对（50 轮）
 *   toolLog  — 工具调用摘要滑动窗口（最近 20 条）
 *
 * 工具数据用完即弃：当前轮内 toolUseLoop 保持完整（API 要求），
 * 生成最终回复后只保留文本 + 工具摘要。
 */

const SESSION_TTL = 5 * 60 * 1000;     // 5 分钟
const MAX_ROUNDS = 50;                  // 50 轮对话（100 条消息）
const MAX_TOOL_LOG = 20;               // 工具日志保留最近 20 条
const CLEANUP_INTERVAL = 60 * 1000;

/** @type {Map<string, {messages: Array, toolLog: Array<string>, lastActive: number}>} */
const sessions = new Map();

let cleanupTimer = null;

export function startSessionCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions) {
      if (now - session.lastActive > SESSION_TTL) {
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
