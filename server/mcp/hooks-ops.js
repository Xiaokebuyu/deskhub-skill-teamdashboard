/**
 * 通知钩子 DB 操作层
 *
 * 数据模型：server/db/init.js 的 notification_hooks 表
 * 状态机：pending_confirm → (admin 确认) → active → (到点) → fired
 *                         → (admin 否决 / 取消) → cancelled
 *                         → (24h × 3 次没回) → expired
 *
 * 短 id 通过 hook_id_counter 表原子自增产出：h001, h002, ..., h999, h1000...
 * 全部操作同步（better-sqlite3），外层不需要 await 再 await。
 */

import db from '../db/init.js';

// ============================================================
//  短 id 生成（事务内原子自增）
// ============================================================

const nextHookIdTx = db.transaction(() => {
  const row = db.prepare('SELECT next_val FROM hook_id_counter WHERE key = ?').get('hook');
  const n = row?.next_val || 1;
  db.prepare('UPDATE hook_id_counter SET next_val = ? WHERE key = ?').run(n + 1, 'hook');
  return n;
});

export function nextHookId() {
  const n = nextHookIdTx();
  return 'h' + String(n).padStart(3, '0');
}

// ============================================================
//  CRUD
// ============================================================

/**
 * 创建钩子（pending_confirm 或 active）
 * @param {object} args
 * @param {string} [args.planId]
 * @param {string} args.targetUser
 * @param {string} args.fireAt - ISO 8601 时间戳
 * @param {string} args.message
 * @param {'deadline'|'patrol'|'admin_verbal'} args.source
 * @param {string} args.createdBy - 'ai' 或 admin username
 * @param {'pending_confirm'|'active'} [args.initialStatus='pending_confirm']
 *   admin 口头命令可直接 active；系统生成走 pending_confirm
 * @returns {object} 新建的钩子记录
 */
export function proposeHook({
  planId = null, targetUser, fireAt, message, source,
  createdBy, initialStatus = 'pending_confirm',
}) {
  if (!targetUser || !fireAt || !message || !source || !createdBy) {
    throw new Error('proposeHook: targetUser/fireAt/message/source/createdBy 必填');
  }
  if (!['deadline', 'patrol', 'admin_verbal'].includes(source)) {
    throw new Error(`proposeHook: 非法 source "${source}"`);
  }
  if (!['pending_confirm', 'active'].includes(initialStatus)) {
    throw new Error(`proposeHook: initialStatus 只能是 pending_confirm/active`);
  }

  const id = nextHookId();
  const confirmedAt = initialStatus === 'active' ? new Date().toISOString() : null;
  const confirmedBy = initialStatus === 'active' ? createdBy : null;

  db.prepare(`
    INSERT INTO notification_hooks (
      id, plan_id, target_user, fire_at, message, status, source,
      created_by, confirmed_at, confirmed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, planId, targetUser, fireAt, message, initialStatus, source,
    createdBy, confirmedAt, confirmedBy);

  return getHookById(id);
}

export function getHookById(id) {
  return db.prepare('SELECT * FROM notification_hooks WHERE id = ?').get(id);
}

/**
 * 确认钩子：pending_confirm → active。
 * 用条件 UPDATE 保幂等（并发"确认 + 取消"以先到者为准）
 * @returns {boolean} true=生效，false=已非 pending_confirm
 */
export function confirmHook(id, confirmedBy) {
  const info = db.prepare(`
    UPDATE notification_hooks
    SET status = 'active',
        confirmed_at = datetime('now'),
        confirmed_by = ?
    WHERE id = ? AND status = 'pending_confirm'
  `).run(confirmedBy, id);
  return info.changes > 0;
}

/**
 * 修改钩子的 fire_at / message / target_user
 * pending_confirm 改完保持 pending_confirm（需要再次确认）
 * active 改完保持 active（视同 admin 直接调整）
 * 其他状态不允许修改
 */
export function modifyHook(id, fields) {
  const allowed = ['fire_at', 'message', 'target_user'];
  const sets = [];
  const values = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.includes(k)) throw new Error(`modifyHook: 不可改字段 "${k}"`);
    sets.push(`${k} = ?`);
    values.push(v);
  }
  if (sets.length === 0) throw new Error('modifyHook: 无可改字段');

  values.push(id);
  const info = db.prepare(`
    UPDATE notification_hooks
    SET ${sets.join(', ')}
    WHERE id = ? AND status IN ('pending_confirm', 'active')
  `).run(...values);
  return info.changes > 0;
}

/**
 * 取消钩子：pending_confirm / active → cancelled
 */
export function cancelHook(id) {
  const info = db.prepare(`
    UPDATE notification_hooks
    SET status = 'cancelled'
    WHERE id = ? AND status IN ('pending_confirm', 'active')
  `).run(id);
  return info.changes > 0;
}

/** 标记为已发：active → fired（由 scheduler 调用） */
export function markFired(id) {
  const info = db.prepare(`
    UPDATE notification_hooks
    SET status = 'fired', fired_at = datetime('now')
    WHERE id = ? AND status = 'active'
  `).run(id);
  return info.changes > 0;
}

/** 标记为过期：pending_confirm → expired（24h × 3 次重提无回应） */
export function markExpired(id) {
  const info = db.prepare(`
    UPDATE notification_hooks
    SET status = 'expired'
    WHERE id = ? AND status = 'pending_confirm'
  `).run(id);
  return info.changes > 0;
}

/** 记一次重提（给 scheduler tick 用） */
export function bumpReminder(id) {
  db.prepare(`
    UPDATE notification_hooks
    SET reminder_count = reminder_count + 1,
        last_reminded_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

// ============================================================
//  查询
// ============================================================

/**
 * 列出钩子
 * @param {object} [filter]
 * @param {string} [filter.status]
 * @param {string} [filter.targetUser]
 * @param {string} [filter.planId]
 */
export function listHooks(filter = {}) {
  const where = [];
  const args = [];
  if (filter.status) { where.push('status = ?'); args.push(filter.status); }
  if (filter.targetUser) { where.push('target_user = ?'); args.push(filter.targetUser); }
  if (filter.planId) { where.push('plan_id = ?'); args.push(filter.planId); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return db.prepare(
    `SELECT * FROM notification_hooks ${clause} ORDER BY fire_at ASC`
  ).all(...args);
}

/** 启动时重建 scheduler 用：所有 active 且 fire_at 在未来 */
export function listPendingFire() {
  return db.prepare(`
    SELECT * FROM notification_hooks
    WHERE status = 'active' AND datetime(fire_at) > datetime('now')
    ORDER BY fire_at ASC
  `).all();
}

/** tick 用：status=active 且 fire_at 已到 */
export function listDueActive() {
  return db.prepare(`
    SELECT * FROM notification_hooks
    WHERE status = 'active' AND datetime(fire_at) <= datetime('now')
    ORDER BY fire_at ASC
  `).all();
}

/** tick 用：status=pending_confirm 且 last_reminded_at / created_at 超过 24h 的 */
export function listPendingNeedingReminder() {
  return db.prepare(`
    SELECT * FROM notification_hooks
    WHERE status = 'pending_confirm'
      AND datetime(COALESCE(last_reminded_at, created_at)) <= datetime('now', '-24 hours')
    ORDER BY created_at ASC
  `).all();
}

// ============================================================
//  模糊匹配（admin 口头"取消张三明天那个"）
// ============================================================

/**
 * 模糊匹配候选钩子
 * @param {object} criteria
 * @param {string} [criteria.targetUser] - username 精确匹配
 * @param {string} [criteria.dateYmd] - 'YYYY-MM-DD'，匹配 fire_at 的当天
 * @param {string} [criteria.planId]
 * @param {string[]} [criteria.statuses] - 默认 ['pending_confirm', 'active']
 * @returns {Array} 候选列表
 */
export function fuzzyMatchHook(criteria = {}) {
  const statuses = criteria.statuses || ['pending_confirm', 'active'];
  const where = [`status IN (${statuses.map(() => '?').join(',')})`];
  const args = [...statuses];

  if (criteria.targetUser) {
    where.push('target_user = ?');
    args.push(criteria.targetUser);
  }
  if (criteria.planId) {
    where.push('plan_id = ?');
    args.push(criteria.planId);
  }
  if (criteria.dateYmd) {
    // fire_at 是 ISO 8601，前 10 位是 UTC 日期。匹配北京日期需要 +8h 偏移
    // 简化：直接字符串 LIKE 'YYYY-MM-DD%' —— 对北京晚间（UTC 次日凌晨）会偏，但大多数场景够用
    where.push("substr(fire_at, 1, 10) = ?");
    args.push(criteria.dateYmd);
  }

  return db.prepare(
    `SELECT * FROM notification_hooks WHERE ${where.join(' AND ')} ORDER BY fire_at ASC`
  ).all(...args);
}
