/**
 * 变更检测 + 推送
 * 三级策略：高优即推 / 中低累积 3 条 / 每天 11:00 兜底
 */

import db from '../db/init.js';
import { sendCard, getFeishuOpenIds } from './feishu.js';
import { buildNotificationCard, buildDailySummaryCard } from './card-templates.js';

const POLL_INTERVAL = Number(process.env.BOT_POLL_INTERVAL) || 30000;
const BATCH_THRESHOLD = Number(process.env.BOT_BATCH_THRESHOLD) || 3;
const DAILY_HOUR = Number(process.env.BOT_DAILY_SUMMARY_HOUR) || 11;

let pollTimer = null;
let dailyCheckTimer = null;
let lastDailySummaryDate = '';

/**
 * 启动变更检测
 */
export function startChangeDetector() {
  // 启动时把所有历史未推送记录标记为已推送，避免推送风暴
  const stale = db.prepare('SELECT COUNT(*) AS c FROM change_log WHERE notified = 0').get();
  if (stale.c > 0) {
    db.prepare('UPDATE change_log SET notified = 1 WHERE notified = 0').run();
    console.log(`[Bot/Detector] 跳过 ${stale.c} 条历史未推送记录（避免启动推送风暴）`);
  }

  pollTimer = setInterval(poll, POLL_INTERVAL);
  pollTimer.unref?.();

  // 每分钟检查是否到每日汇总时间
  dailyCheckTimer = setInterval(checkDailySummary, 60000);
  dailyCheckTimer.unref?.();

  console.log(`[Bot/Detector] 变更检测已启动 (轮询 ${POLL_INTERVAL / 1000}s, 每日汇总 ${DAILY_HOUR}:00)`);
}

export function stopChangeDetector() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (dailyCheckTimer) { clearInterval(dailyCheckTimer); dailyCheckTimer = null; }
}

/**
 * 轮询变更
 */
async function poll() {
  try {
    const pending = db.prepare(
      'SELECT * FROM change_log WHERE notified = 0 ORDER BY created_at ASC'
    ).all();

    if (pending.length === 0) return;

    const high = pending.filter(c => c.priority === 'high');
    const rest = pending.filter(c => c.priority !== 'high');

    // 高优先级立即推送
    if (high.length > 0) {
      await pushChanges(high);
    }

    // 中低优先级累积到阈值
    if (rest.length >= BATCH_THRESHOLD) {
      await pushChanges(rest);
    }
  } catch (err) {
    console.error('[Bot/Detector] 轮询错误:', err.message);
  }
}

/**
 * 每日汇总检查
 */
async function checkDailySummary() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (now.getHours() !== DAILY_HOUR) return;
  if (lastDailySummaryDate === today) return;
  lastDailySummaryDate = today;

  try {
    const pending = db.prepare(
      'SELECT * FROM change_log WHERE notified = 0 ORDER BY created_at ASC'
    ).all();

    if (pending.length === 0) return;

    // 用每日汇总卡片
    const card = buildDailySummaryCard(pending);
    await sendToGroups(card);

    // 标记已推送
    markNotified(pending.map(c => c.id));
    console.log(`[Bot/Detector] 每日汇总已推送 (${pending.length} 条)`);
  } catch (err) {
    console.error('[Bot/Detector] 每日汇总错误:', err.message);
  }
}

/**
 * 推送变更（群聊 + 私聊）
 */
async function pushChanges(changes) {
  const card = buildNotificationCard(changes);

  // 推送到群聊
  await sendToGroups(card);

  // 推送到相关人私聊
  await sendToRelatedUsers(changes, card);

  // 标记已推送
  markNotified(changes.map(c => c.id));
  console.log(`[Bot/Detector] 已推送 ${changes.length} 条变更`);
}

/**
 * 推送到配置的群聊
 */
async function sendToGroups(card) {
  const chatIds = (process.env.FEISHU_NOTIFY_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const chatId of chatIds) {
    await sendCard(chatId, 'chat_id', card);
  }
}

/**
 * 推送私聊通知给相关用户
 */
async function sendToRelatedUsers(changes, card) {
  // 收集所有需通知的 username（去重）
  const usernameSet = new Set();
  for (const c of changes) {
    try {
      const users = JSON.parse(c.related_users || '[]');
      for (const u of users) usernameSet.add(u);
    } catch { /* ignore */ }
  }

  if (usernameSet.size === 0) return;

  const mappings = getFeishuOpenIds([...usernameSet]);
  for (const { openId } of mappings) {
    await sendCard(openId, 'open_id', card);
  }
}

/**
 * 标记 change_log 记录为已推送
 */
function markNotified(ids) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE change_log SET notified = 1 WHERE id IN (${placeholders})`).run(...ids);
}
