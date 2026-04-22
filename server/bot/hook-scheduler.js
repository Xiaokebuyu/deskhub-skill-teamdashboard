/**
 * 钩子调度器
 *
 * 职责：
 *   1. 启动时从 DB 重建所有 active 钩子的 timer（setTimeout）
 *   2. 每分钟 tick：
 *      - 扫已到 fire_at 的 active 钩子 → 发 DM → markFired
 *      - 扫 pending_confirm 且 24h 无反应的 → DM admin 重提 → reminder_count++
 *      - 扫 reminder_count >= 3 的 pending_confirm → markExpired
 *
 * 所有 DM 都走 feishu.js 的 createAndSendCard；依赖 users.feishu_open_id 反查 openId。
 * 关闭时 clearInterval + clearTimeout 所有挂钩。
 */

import db from '../db/init.js';
import {
  listPendingFire, listDueActive, listPendingNeedingReminder,
  markFired, markExpired, bumpReminder, getHookById,
} from '../mcp/hooks-ops.js';
import { createAndSendCard } from './feishu.js';
import { buildPersonalCard, buildSimpleCard } from './card-templates.js';

const TICK_MS = 60_000;           // 每分钟 tick
const MAX_REMINDERS = 3;          // pending_confirm 最多重提 3 次后 expired

let tickTimer = null;
const activeTimers = new Map();   // hookId → Timeout

// ============================================================
//  工具：按 username 查 feishu_open_id
// ============================================================

function getOpenId(username) {
  if (!username) return null;
  const row = db.prepare(
    'SELECT feishu_open_id FROM users WHERE username = ? AND feishu_open_id != ?'
  ).get(username, '');
  return row?.feishu_open_id || null;
}

/** 查唯一 admin 的 openId（目前团队只 1 个 admin；多 admin 再扩广播） */
function getAdminOpenIds() {
  const rows = db.prepare(
    "SELECT username, feishu_open_id FROM users WHERE role = 'admin' AND feishu_open_id != ''"
  ).all();
  return rows.map(r => ({ username: r.username, openId: r.feishu_open_id }));
}

// ============================================================
//  触发：发 DM
// ============================================================

async function fireHook(hook) {
  const openId = getOpenId(hook.target_user);
  if (!openId) {
    console.warn(`[Hook] ${hook.id} target=${hook.target_user} 无飞书绑定，跳过触发但仍 markFired`);
    markFired(hook.id);
    return;
  }
  try {
    const card = buildPersonalCard(hook.message);
    await createAndSendCard(openId, 'open_id', card);
    markFired(hook.id);
    console.log(`[Hook] ${hook.id} fired → ${hook.target_user}`);
  } catch (err) {
    console.error(`[Hook] ${hook.id} 发送失败:`, err.message);
    // 不 markFired，下次 tick 仍会扫到（status 仍 active），自动重试
  }
}

// ============================================================
//  重提：给 admin DM
// ============================================================

async function remindAdmin(hook) {
  const admins = getAdminOpenIds();
  if (admins.length === 0) {
    console.warn(`[Hook] ${hook.id} 无 admin 可重提，markExpired`);
    markExpired(hook.id);
    return;
  }

  const attempt = hook.reminder_count + 1;  // 本次是第几次重提
  const content = `钩子 ${hook.id} 还等你确认（第 ${attempt}/${MAX_REMINDERS} 次提醒）：\n` +
    `• 给 ${hook.target_user}\n` +
    `• 时间 ${hook.fire_at}\n` +
    `• 内容 ${hook.message}\n\n` +
    `回复"${hook.id} 行"/"${hook.id} 改 xxx"/"${hook.id} 否"。${MAX_REMINDERS - attempt === 0 ? '这是最后一次提醒，再不回就自动丢弃。' : ''}`;
  const card = buildSimpleCard(content, { level: 'warn', title: '钩子待确认', subtitle: `第 ${attempt} 次提醒` });

  for (const { openId } of admins) {
    try {
      await createAndSendCard(openId, 'open_id', card);
    } catch (err) {
      console.error(`[Hook] ${hook.id} 重提给 ${openId} 失败:`, err.message);
    }
  }

  bumpReminder(hook.id);
  if (attempt >= MAX_REMINDERS) {
    markExpired(hook.id);
    console.log(`[Hook] ${hook.id} 已重提 ${attempt} 次，markExpired`);
  } else {
    console.log(`[Hook] ${hook.id} 重提第 ${attempt} 次`);
  }
}

// ============================================================
//  重建：启动时把 active 钩子挂 setTimeout
// ============================================================

function scheduleOne(hook) {
  if (activeTimers.has(hook.id)) return;
  const fireAt = new Date(hook.fire_at).getTime();
  const delay = fireAt - Date.now();

  // 已过期的 active（服务挂掉错过的）→ 立刻发
  if (delay <= 0) {
    setImmediate(() => fireHook(hook));
    return;
  }

  // 距触发 > 25 天 不挂 setTimeout（32-bit 限制 ≈ 24.85 天），让 tick 持续检查
  if (delay > 24 * 24 * 3600 * 1000) return;

  const t = setTimeout(async () => {
    activeTimers.delete(hook.id);
    const fresh = getHookById(hook.id);
    if (fresh?.status === 'active') {
      await fireHook(fresh);
    }
  }, delay);
  t.unref?.();
  activeTimers.set(hook.id, t);
}

export function addHookToScheduler(hookId) {
  const h = getHookById(hookId);
  if (!h || h.status !== 'active') return;
  scheduleOne(h);
}

/** 取消已挂的 timer（cancelHook / modifyHook 时调用） */
export function removeHookFromScheduler(hookId) {
  const t = activeTimers.get(hookId);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(hookId);
  }
}

// ============================================================
//  tick：每分钟扫
// ============================================================

async function tick() {
  try {
    // 1. 已到 fire_at 的 active（兜底，timer 失效时也会扫到）
    for (const hook of listDueActive()) {
      if (!activeTimers.has(hook.id)) {
        await fireHook(hook);
      }
    }

    // 2. 需要重提的 pending_confirm
    for (const hook of listPendingNeedingReminder()) {
      await remindAdmin(hook);
    }

    // 3. 新出现的远期 active（> 24 天的进入 setTimeout 窗口）
    for (const hook of listPendingFire()) {
      const delay = new Date(hook.fire_at).getTime() - Date.now();
      if (delay > 0 && delay <= 24 * 24 * 3600 * 1000) {
        scheduleOne(hook);
      }
    }
  } catch (err) {
    console.error('[Hook/Tick] 异常:', err);
  }
}

// ============================================================
//  生命周期
// ============================================================

export function startHookScheduler() {
  const actives = listPendingFire();
  for (const hook of actives) scheduleOne(hook);

  tickTimer = setInterval(tick, TICK_MS);
  tickTimer.unref?.();

  console.log(`[Hook] scheduler 启动，已重建 ${actives.length} 条 active timer，tick 间隔 ${TICK_MS / 1000}s`);

  // 启动时立刻 tick 一次（处理停机期间错过的）
  setImmediate(tick);
}

export function stopHookScheduler() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  for (const t of activeTimers.values()) clearTimeout(t);
  activeTimers.clear();
}

/** 测试用：立刻触发某钩子 */
export async function forceFire(hookId) {
  const h = getHookById(hookId);
  if (!h) throw new Error(`钩子 ${hookId} 不存在`);
  if (h.status !== 'active') throw new Error(`钩子 ${hookId} 状态 ${h.status} 不是 active`);
  await fireHook(h);
}
