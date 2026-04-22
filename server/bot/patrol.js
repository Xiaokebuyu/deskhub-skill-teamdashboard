/**
 * 定时巡检
 * 每天在配置时间扫描平台状态，发现异常则通知
 */

import { runPatrol } from './notify-llm.js';
import { createAndSendCard, getFeishuOpenIds } from './feishu.js';
import { buildPatrolCard, buildPersonalCard } from './card-templates.js';
import { logDegrade } from './degrade.js';
import { getPatrolConfigValue } from '../mcp/db-ops.js';

let checkTimer = null;
let lastPatrolDate = '';

/**
 * 启动巡检定时器
 */
export function startPatrol() {
  // 每分钟检查是否到巡检时间（每次都读 DB 以支持 patrol_hour/enabled 热更新）
  checkTimer = setInterval(checkPatrolTime, 60_000);
  checkTimer.unref?.();
  const hour = getPatrolConfigValue('patrol_hour');
  const enabled = getPatrolConfigValue('patrol_enabled');
  console.log(`[Patrol] 巡检定时器已启动（patrol_hour=${hour}, enabled=${enabled}，热读 DB）`);
}

export function stopPatrol() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

async function checkPatrolTime() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 每次都读 DB，支持 patrol_hour / patrol_enabled 热更新
  const enabled = getPatrolConfigValue('patrol_enabled');
  if (enabled !== 1) return;
  const patrolHour = getPatrolConfigValue('patrol_hour');
  if (now.getHours() !== patrolHour) return;
  if (lastPatrolDate === today) return;
  lastPatrolDate = today;

  console.log(`[Patrol] 开始每日巡检（hour=${patrolHour}）...`);

  try {
    const decision = await runPatrol();

    // 群聊通知
    if (decision.group?.send && decision.group.message) {
      const card = buildPatrolCard(decision.group.message, {
        attentionCount: decision.individuals?.length || 0,
      });
      await sendToGroups(card);
    }

    // 个性化私聊
    if (decision.individuals?.length > 0) {
      const usernames = decision.individuals.map(i => i.username);
      const mappings = getFeishuOpenIds(usernames);
      const openIdMap = Object.fromEntries(mappings.map(m => [m.username, m.openId]));

      for (const { username, message } of decision.individuals) {
        const openId = openIdMap[username];
        if (!openId) continue;
        const card = buildPersonalCard(message);
        await createAndSendCard(openId, 'open_id', card);
      }
    }

    console.log(`[Patrol] 巡检完成: group=${decision.group?.send}, individuals=${decision.individuals?.length || 0}`);
  } catch (err) {
    logDegrade('patrol', 'run_failed', err);
  }
}

async function sendToGroups(card) {
  const raw = getPatrolConfigValue('notify_chat_ids') || '';
  const chatIds = raw.split(',').map(s => s.trim()).filter(Boolean);

  for (const chatId of chatIds) {
    await createAndSendCard(chatId, 'chat_id', card);
  }
}
