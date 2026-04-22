/**
 * 变更检测 + LLM 驱动推送
 *
 * 不再轮询 —— 由 event-bus 的 EventEmitter 驱动：
 *   logChange() → bus.emit('change') → 缓冲区收集 → flush → 本模块处理
 *
 * 本模块职责：
 *   1. 注册 flush 回调
 *   2. 调用 LLM 分析变更 → 获得通知决策
 *   3. 按决策发送群聊/私聊通知
 *   4. 标记 change_log 已推送
 *   5. 每日汇总（定时检查，复用巡检）
 */

import db from '../db/init.js';
import { createAndSendCard, getFeishuOpenIds } from './feishu.js';
import { setFlushHandler } from './event-bus.js';
import { analyzeChanges, fallbackNotify } from './notify-llm.js';
import {
  buildNotificationCard,
  buildPersonalCard,
} from './card-templates.js';
import { logDegrade } from './degrade.js';
import { getPatrolConfigValue } from '../mcp/db-ops.js';

/**
 * 启动变更检测
 */
export function startChangeDetector() {
  // 启动时把所有历史未推送记录标记为已推送，避免推送风暴
  const stale = db.prepare('SELECT COUNT(*) AS c FROM change_log WHERE notified = 0').get();
  if (stale.c > 0) {
    db.prepare('UPDATE change_log SET notified = 1 WHERE notified = 0').run();
    console.log(`[Detector] 跳过 ${stale.c} 条历史未推送记录（避免启动推送风暴）`);
  }

  // 注册 EventBus flush 回调
  setFlushHandler(handleBatch);

  console.log('[Detector] 变更检测已启动（EventEmitter 模式）');
}

/**
 * 处理一批变更（由 EventBus flush 触发）
 */
async function handleBatch(batch) {
  console.log(`[Detector] 处理 ${batch.length} 条变更`);

  let decision;
  try {
    decision = await analyzeChanges(batch);
  } catch (err) {
    logDegrade('change-detector', 'analyze_failed', err);
    decision = fallbackNotify(batch);
  }

  // 群聊通知
  if (decision.group?.send && decision.group.message) {
    const card = buildNotificationCard(decision.group.message, {
      changeCount: batch.length,
      changes: batch,
    });
    await sendToGroups(card);
  }

  // 个性化私聊
  if (decision.individuals?.length > 0) {
    await sendToIndividuals(decision.individuals);
  }

  // 标记 change_log 已推送（用 entity_id 匹配最近记录）
  markNotifiedByBatch(batch);
}

/**
 * 推送到配置的群聊
 */
async function sendToGroups(card) {
  const raw = getPatrolConfigValue('notify_chat_ids') || '';
  const chatIds = raw.split(',').map(s => s.trim()).filter(Boolean);

  for (const chatId of chatIds) {
    await createAndSendCard(chatId, 'chat_id', card);
  }
}

/**
 * 发送个性化私聊通知
 */
async function sendToIndividuals(individuals) {
  const usernames = individuals.map(i => i.username);
  const mappings = getFeishuOpenIds(usernames);
  const openIdMap = Object.fromEntries(mappings.map(m => [m.username, m.openId]));

  for (const { username, message } of individuals) {
    const openId = openIdMap[username];
    if (!openId) {
      console.warn(`[Detector] 用户 ${username} 无飞书绑定，跳过私聊`);
      continue;
    }
    const card = buildPersonalCard(message);
    await createAndSendCard(openId, 'open_id', card);
  }
}

/**
 * 标记 change_log 记录为已推送
 * EventBus 传来的 batch 没有 DB id，用最近的未推送记录匹配
 */
function markNotifiedByBatch(batch) {
  // 标记最近 N 条未推送的记录
  const count = batch.length;
  const rows = db.prepare(
    'SELECT id FROM change_log WHERE notified = 0 ORDER BY created_at ASC LIMIT ?'
  ).all(count);

  if (rows.length > 0) {
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE change_log SET notified = 1 WHERE id IN (${placeholders})`).run(...ids);
  }
}
