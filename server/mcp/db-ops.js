/**
 * MCP 数据库操作层
 * 直接操作 SQLite，纯函数，无 HTTP/角色逻辑
 * SQL 模式提取自 routes/workbench.js + routes/auth.js
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db/init.js';

const uid = () => crypto.randomUUID().slice(0, 8);

// ============================================================
//  变更日志（飞书推送用）
// ============================================================

export function logChange(entityType, entityId, action, summary, actor = '', priority = 'medium', relatedUsers = []) {
  db.prepare(
    'INSERT INTO change_log (entity_type, entity_id, action, summary, actor, priority, related_users) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(entityType, entityId, action, summary, actor, priority, JSON.stringify(relatedUsers));
}

export function getRecentChanges(limit = 20) {
  return db.prepare('SELECT * FROM change_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

/** ISO datetime → "MM-DD" */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 安全解析 JSON，失败返回 [] */
function parseJSON(str) {
  if (!str) return [];
  try { const r = JSON.parse(str); return Array.isArray(r) ? r : []; }
  catch { return []; }
}

// ============================================================
//  工单 (Plans)
// ============================================================

export function createPlan({ name, type, priority = 'medium', desc = '', status = 'next', owner = '', deadline = '', related_skill = '', attachment = '' }) {
  if (!name || !type) throw new Error('name 和 type 必填');
  const id = 'p' + uid();
  db.prepare(`INSERT INTO plans (id, name, type, status, priority, description, owner, deadline, related_skill, attachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, type, status, priority, desc, owner, deadline, related_skill, attachment);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  logChange('plan', id, 'created', `创建工单「${name}」`, owner, priority, owner ? [owner] : []);
  return {
    id: plan.id, name: plan.name, type: plan.type, status: plan.status,
    priority: plan.priority, created: fmtDate(plan.created_at),
    desc: plan.description, result: plan.result,
    owner: plan.owner || '', deadline: plan.deadline || '',
  };
}

export function editPlan(planId, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = k === 'desc' ? 'description' : k;
    sets.push(`${col} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) throw new Error('无更新字段');
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`).run(...vals, planId);
  const plan = db.prepare('SELECT name, priority, owner FROM plans WHERE id = ?').get(planId);
  if (plan) logChange('plan', planId, 'updated', `编辑工单「${plan.name}」`, '', plan.priority, plan.owner ? [plan.owner] : []);
}

export function deletePlan(planId) {
  const plan = db.prepare('SELECT name, priority, owner FROM plans WHERE id = ?').get(planId);
  const vids = db.prepare('SELECT id FROM variants WHERE plan_id = ?').all(planId).map(v => v.id);
  if (vids.length > 0) {
    db.prepare(`DELETE FROM scores WHERE variant_id IN (${vids.map(() => '?').join(',')})`).run(...vids);
  }
  db.prepare('DELETE FROM variants WHERE plan_id = ?').run(planId);
  db.prepare('DELETE FROM plans WHERE id = ?').run(planId);
  if (plan) logChange('plan', planId, 'deleted', `删除工单「${plan.name}」`, '', plan.priority, plan.owner ? [plan.owner] : []);
}

export function updatePlanStatus(planId, status, result) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) throw new Error('工单不存在');

  if (status === 'active' && plan.status !== 'next' && plan.status !== 'done') {
    throw new Error('只能从 next 或 done 激活');
  }
  if (status === 'done') {
    if (plan.status !== 'active') throw new Error('只能从 active 完成');
    if (!result || !['adopted', 'shelved'].includes(result)) {
      throw new Error('done 必须指定 result: adopted|shelved');
    }
  }

  db.prepare(`UPDATE plans SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, status === 'done' ? result : null, planId);

  const statusLabel = { next: '待开始', active: '进行中', done: '已完成' }[status] || status;
  const resultLabel = result === 'adopted' ? '（采纳）' : result === 'shelved' ? '（搁置）' : '';
  const uploaders = db.prepare('SELECT DISTINCT uploader FROM variants WHERE plan_id = ?').all(planId).map(v => v.uploader);
  const related = [plan.owner, ...uploaders].filter(Boolean);
  logChange('plan', planId, 'status_changed', `工单「${plan.name}」→ ${statusLabel}${resultLabel}`, '', plan.priority, related);
}

// ============================================================
//  方案 (Variants)
// ============================================================

export function addVariant(planId, { name, uploader, desc = '', link = '', content = null, attachments = '' }) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) throw new Error('工单不存在');
  if (plan.status === 'done') throw new Error('工单已定稿，无法添加方案');
  if (!name || !uploader) throw new Error('name 和 uploader 必填');

  const id = 'v' + uid();
  const attStr = typeof attachments === 'string' ? attachments : JSON.stringify(attachments);
  db.prepare(`INSERT INTO variants (id, plan_id, name, uploader, description, link, content, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, planId, name, uploader, desc, link, content, attStr);

  const v = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
  logChange('variant', id, 'created', `工单「${plan.name}」新增方案「${name}」`, uploader, plan.priority, plan.owner ? [plan.owner] : []);
  return {
    id: v.id, name: v.name, uploader: v.uploader,
    uploaded: fmtDate(v.uploaded_at), desc: v.description,
    link: v.link, content: v.content, attachments: parseJSON(v.attachments), scores: [],
  };
}

export function editVariant(variantId, fields) {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
  if (!variant) throw new Error('方案不存在');
  const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(variant.plan_id);
  if (plan && plan.status === 'done') throw new Error('工单已定稿，无法编辑方案');

  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = k === 'desc' ? 'description' : k;
    if (col === 'attachments') {
      sets.push('attachments = ?');
      vals.push(typeof v === 'string' ? v : JSON.stringify(v));
    } else {
      sets.push(`${col} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) throw new Error('无更新字段');
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, variantId);
}

export function deleteVariant(variantId) {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
  if (!variant) throw new Error('方案不存在');
  const plan = db.prepare('SELECT status, name, priority, owner FROM plans WHERE id = ?').get(variant.plan_id);
  if (plan && plan.status === 'done') throw new Error('工单已定稿，无法删除方案');

  db.prepare('DELETE FROM scores WHERE variant_id = ?').run(variantId);
  db.prepare('DELETE FROM variants WHERE id = ?').run(variantId);
  if (plan) logChange('variant', variantId, 'deleted', `工单「${plan.name}」删除方案「${variant.name}」`, '', plan.priority, plan.owner ? [plan.owner] : []);
}

// ============================================================
//  评分 (Scores)
// ============================================================

export function submitScores(variantId, { tester, scores, evalDoc }) {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
  if (!variant) throw new Error('方案不存在');
  const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(variant.plan_id);
  if (plan && plan.status === 'done') throw new Error('工单已定稿');
  if (!tester || !Array.isArray(scores) || scores.length === 0) {
    throw new Error('tester 和 scores[] 必填');
  }

  const dimsMap = {};
  for (const d of db.prepare('SELECT * FROM dimensions').all()) {
    dimsMap[d.id] = d;
  }
  for (const s of scores) {
    const dim = dimsMap[s.dim_id];
    if (!dim) throw new Error(`维度 ${s.dim_id} 不存在`);
    if (s.value < 0 || s.value > dim.max) {
      throw new Error(`维度 ${dim.name} 满分为 ${dim.max}，提交值 ${s.value} 越界`);
    }
  }

  const insert = db.prepare(`INSERT INTO scores (id, variant_id, plan_id, tester, dim_id, value, comment, eval_doc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const created = [];
  const insertMany = db.transaction((entries) => {
    for (const s of entries) {
      const id = 's' + uid();
      insert.run(id, variantId, variant.plan_id, tester, s.dim_id, s.value, s.comment || '', evalDoc || null);
      created.push({ id, tester, dimId: s.dim_id, value: s.value, comment: s.comment || '', evalDoc: evalDoc || null });
    }
  });
  insertMany(scores);

  const planRow = db.prepare('SELECT name, priority, owner FROM plans WHERE id = ?').get(variant.plan_id);
  const related = [planRow?.owner, variant.uploader].filter(Boolean);
  logChange('score', variantId, 'created', `${tester} 对方案「${variant.name}」提交了评分`, tester, planRow?.priority || 'medium', related);

  return created;
}

export function editScore(scoreId, fields) {
  const score = db.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
  if (!score) throw new Error('评分不存在');
  const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(score.plan_id);
  if (plan && plan.status === 'done') throw new Error('工单已定稿，无法编辑评分');

  const { value, comment, evalDoc } = fields;
  const sets = [];
  const vals = [];
  if (value !== undefined) {
    const dim = db.prepare('SELECT * FROM dimensions WHERE id = ?').get(score.dim_id);
    if (dim && (value < 0 || value > dim.max)) {
      throw new Error(`维度 ${dim.name} 满分为 ${dim.max}，提交值 ${value} 越界`);
    }
    sets.push('value = ?'); vals.push(value);
  }
  if (comment !== undefined) { sets.push('comment = ?'); vals.push(comment); }
  if (evalDoc !== undefined) { sets.push('eval_doc = ?'); vals.push(evalDoc); }
  if (sets.length === 0) throw new Error('无更新字段');

  db.prepare(`UPDATE scores SET ${sets.join(', ')} WHERE id = ?`).run(...vals, scoreId);
}

export function deleteScore(scoreId) {
  const score = db.prepare('SELECT * FROM scores WHERE id = ?').get(scoreId);
  if (!score) throw new Error('评分不存在');
  const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(score.plan_id);
  if (plan && plan.status === 'done') throw new Error('工单已定稿，无法删除评分');

  db.prepare('DELETE FROM scores WHERE id = ?').run(scoreId);
}

// ============================================================
//  维度 (Dimensions)
// ============================================================

export function createDimension({ name, max = 10 }) {
  if (!name) throw new Error('name 必填');
  const id = 'd' + uid();
  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM dimensions').get().m || 0;
  db.prepare('INSERT INTO dimensions (id, name, max, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name, max, maxOrder + 1);
  return { id, name, max, active: true };
}

export function editDimension(dimensionId, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (k === 'active') { sets.push('active = ?'); vals.push(v ? 1 : 0); }
    else { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length === 0) throw new Error('无更新字段');
  db.prepare(`UPDATE dimensions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, dimensionId);
}

export function deleteDimension(dimensionId) {
  db.prepare('UPDATE dimensions SET active = 0 WHERE id = ?').run(dimensionId);
}

// ============================================================
//  用户 (Users)
// ============================================================

export function listUsers() {
  const users = db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at').all();
  return users.map(u => ({
    id: u.id, username: u.username, role: u.role,
    displayName: u.display_name || u.username, created: u.created_at,
  }));
}

export function createUser({ username, password, role = 'member', displayName = '' }) {
  if (!username || !password) throw new Error('用户名和密码必填');
  if (!['admin', 'tester', 'member'].includes(role)) throw new Error('角色无效');

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) throw new Error('用户名已存在');

  const id = 'u_' + uid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)')
    .run(id, username, hash, role, displayName || username);
  return { id, username, role, displayName: displayName || username };
}

export function deleteUser(userId) {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('用户不存在');
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// ============================================================
//  归属查询（供权限检查用）
// ============================================================

/** 查询方案的 uploader */
export function getPlanDetail_variant(variantId) {
  return db.prepare('SELECT id, plan_id, uploader FROM variants WHERE id = ?').get(variantId) || null;
}

/** 检查方案是否有评分 */
export function variantHasScores(variantId) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM scores WHERE variant_id = ?').get(variantId);
  return row.n > 0;
}

/** 查询评分的 tester */
export function getScoreOwner(scoreId) {
  return db.prepare('SELECT id, tester, plan_id FROM scores WHERE id = ?').get(scoreId) || null;
}

// ============================================================
//  查询 (Queries)
// ============================================================

export function listPlans({ type, status } = {}) {
  let where = [];
  let params = {};
  if (type) { where.push('p.type = $type'); params.type = type; }
  if (status) { where.push('p.status = $status'); params.status = status; }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const plans = db.prepare(`SELECT * FROM plans p ${clause} ORDER BY p.created_at DESC`).all(params);
  const variants = db.prepare('SELECT * FROM variants ORDER BY uploaded_at ASC').all();
  const allScores = db.prepare('SELECT * FROM scores ORDER BY created_at ASC').all();

  const scoreMap = {};
  for (const s of allScores) {
    (scoreMap[s.variant_id] ??= []).push({
      id: s.id, tester: s.tester, dimId: s.dim_id, value: s.value,
      comment: s.comment, date: fmtDate(s.created_at), evalDoc: s.eval_doc,
    });
  }

  const variantMap = {};
  for (const v of variants) {
    (variantMap[v.plan_id] ??= []).push({
      id: v.id, name: v.name, uploader: v.uploader,
      uploaded: fmtDate(v.uploaded_at), desc: v.description,
      link: v.link, content: v.content,
      attachments: parseJSON(v.attachments),
      scores: scoreMap[v.id] || [],
    });
  }

  return plans.map(p => ({
    id: p.id, name: p.name, type: p.type, status: p.status,
    priority: p.priority, created: fmtDate(p.created_at),
    desc: p.description, result: p.result,
    owner: p.owner || '', deadline: p.deadline || '',
    relatedSkill: p.related_skill || '', attachment: p.attachment || '',
    variants: variantMap[p.id] || [],
  }));
}

export function getPlanDetail(planId) {
  const plans = listPlans();
  return plans.find(p => p.id === planId) || null;
}

export function getDimensions() {
  const dims = db.prepare('SELECT * FROM dimensions ORDER BY sort_order').all();
  return dims.map(d => ({ id: d.id, name: d.name, max: d.max, active: !!d.active }));
}
