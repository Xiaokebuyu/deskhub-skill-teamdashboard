/**
 * 5 分钟短期会话记忆
 * 按飞书 user open_id 维护对话上下文
 */

const SESSION_TTL = 5 * 60 * 1000;     // 5 分钟
const MAX_ROUNDS = 10;                  // 最多保留 10 轮（20 条 messages）
const CLEANUP_INTERVAL = 60 * 1000;     // 每分钟清理一次

/** @type {Map<string, {messages: Array, lastActive: number}>} */
const sessions = new Map();

// 定时清理过期 session
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
  // 允许进程退出
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
 * @returns {Array} messages 数组（可直接传给 LLM）
 */
export function getSession(userId) {
  const session = sessions.get(userId);
  if (!session || Date.now() - session.lastActive > SESSION_TTL) {
    return [];
  }
  return session.messages;
}

/**
 * 更新用户会话（追加一轮对话）
 * @param {string} userId
 * @param {string} userText - 用户输入
 * @param {string} assistantText - 机器人回复
 */
export function updateSession(userId, userText, assistantText) {
  let session = sessions.get(userId);
  if (!session || Date.now() - session.lastActive > SESSION_TTL) {
    session = { messages: [], lastActive: Date.now() };
    sessions.set(userId, session);
  }

  session.messages.push(
    { role: 'user', content: userText },
    { role: 'assistant', content: [{ type: 'text', text: assistantText }] },
  );

  // 保留最近 MAX_ROUNDS 轮
  if (session.messages.length > MAX_ROUNDS * 2) {
    session.messages = session.messages.slice(-MAX_ROUNDS * 2);
  }

  session.lastActive = Date.now();
}
