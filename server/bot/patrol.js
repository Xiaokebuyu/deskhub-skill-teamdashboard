/**
 * 每日巡检 → 钩子工厂
 *
 * 每天到 patrol_config.patrol_hour 时自动跑：
 *   1. runPatrol() → LLM 扫异常产钩子草案 JSON
 *   2. 逐条 proposeHook（source='patrol', pending_confirm, createdBy='ai'）
 *   3. DM 唯一 admin 一条汇总卡，列清单 + 操作引导
 *
 * 不再发群通知、不再直接 DM individuals。admin 审批钩子后 scheduler 触发真正的 DM。
 */

import { runPatrol } from './notify-llm.js';
import { createAndSendCard } from './feishu.js';
import { buildSimpleCard } from './card-templates.js';
import { logDegrade } from './degrade.js';
import { getPatrolConfigValue } from '../mcp/db-ops.js';
import { proposeHook } from '../mcp/hooks-ops.js';
import db from '../db/init.js';

let checkTimer = null;
let lastPatrolDate = '';

/** 启动巡检定时器 */
export function startPatrol() {
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

  const enabled = getPatrolConfigValue('patrol_enabled');
  if (enabled !== 1) return;
  const patrolHour = getPatrolConfigValue('patrol_hour');
  if (now.getHours() !== patrolHour) return;
  if (lastPatrolDate === today) return;
  lastPatrolDate = today;

  console.log(`[Patrol] 开始每日巡检（hour=${patrolHour}）...`);

  try {
    const { hooks, reasoning } = await runPatrol();

    if (hooks.length === 0) {
      console.log(`[Patrol] 无异常：${reasoning}`);
      return;  // 无异常不骚扰 admin
    }

    // 逐条写 pending_confirm 钩子
    const created = [];
    for (const h of hooks) {
      try {
        const hook = proposeHook({
          planId: h.plan_id || null,
          targetUser: h.target_user,
          fireAt: h.fire_at,
          message: h.message,
          source: 'patrol',
          createdBy: 'ai',
          initialStatus: 'pending_confirm',
        });
        created.push(hook);
      } catch (err) {
        console.warn(`[Patrol] proposeHook 失败:`, err.message, h);
      }
    }

    if (created.length === 0) {
      console.log(`[Patrol] LLM 产了 ${hooks.length} 条草案但全部 proposeHook 失败`);
      return;
    }

    // DM 唯一 admin 一条汇总卡
    await sendSummaryToAdmin(created, reasoning);
    console.log(`[Patrol] 完成：产 ${created.length}/${hooks.length} 条 pending_confirm 钩子`);
  } catch (err) {
    logDegrade('patrol', 'run_failed', err);
  }
}

async function sendSummaryToAdmin(hooks, reasoning) {
  const admins = db.prepare(
    "SELECT username, feishu_open_id FROM users WHERE role = 'admin' AND feishu_open_id != ''"
  ).all();
  if (admins.length === 0) {
    console.warn('[Patrol] 无可通知 admin（role=admin 且有 feishu 绑定）');
    return;
  }

  const lines = hooks.map(h =>
    `• **${h.id}** → ${h.target_user}（${h.fire_at.slice(0, 16).replace('T', ' ')}）\n  ${h.message}`
  ).join('\n\n');
  const content = `今日巡检产出 ${hooks.length} 条钩子草案${reasoning ? `：${reasoning}` : ''}\n\n${lines}\n\n` +
    `回复「h00x 行」逐条确认，「h00x 改 xxx」调整，「h00x 否」取消，「全部确认」一次性通过。`;
  const card = buildSimpleCard(content, { level: 'info', title: '小合·巡检草案', subtitle: `${hooks.length} 条待确认` });

  for (const { feishu_open_id } of admins) {
    try {
      await createAndSendCard(feishu_open_id, 'open_id', card);
    } catch (err) {
      console.error(`[Patrol] 发送巡检汇总给 ${feishu_open_id} 失败:`, err.message);
    }
  }
}
