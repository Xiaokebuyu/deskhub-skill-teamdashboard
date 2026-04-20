import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db/init.js';
import { wrapResponse } from '../utils/meta.js';
import { requireRole } from '../middleware/auth.js';
import { deletePlan } from '../mcp/db-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '..', 'uploads');
const upload = multer({
  dest: join(UPLOAD_DIR, 'eval'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = Router();
const uid = () => crypto.randomUUID().slice(0, 8);
const local = (data) => wrapResponse(data, { source: 'local' });

// --- 定稿锁定校验 ---
function checkPlanNotDone(planId) {
  const plan = db.prepare('SELECT status FROM plans WHERE id = ?').get(planId);
  return plan && plan.status === 'done'
    ? '工单已定稿，请先撤销定稿再操作'
    : null;
}

// ============================================================
//  工单 (Plans)
// ============================================================

// --- GET /api/plans --- 列表（含嵌套 variants + scores）
router.get('/plans', (req, res) => {
  try {
    const { type, status } = req.query;
    let where = [];
    let params = {};
    // better-sqlite3 绑定 named params 时 key 不含 $ 前缀（SQL 里保留 $）
    if (type) { where.push('p.type = $type'); params.type = type; }
    if (status) { where.push('p.status = $status'); params.status = status; }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const plans = db.prepare(`SELECT * FROM plans p ${clause} ORDER BY p.created_at DESC`).all(params);
    const variants = db.prepare('SELECT * FROM variants ORDER BY uploaded_at ASC').all();
    const scores = db.prepare('SELECT * FROM scores ORDER BY created_at ASC').all();
    const dims = db.prepare('SELECT * FROM dimensions WHERE active = 1 ORDER BY sort_order').all();

    // 组装嵌套结构
    const scoreMap = {};
    for (const s of scores) {
      (scoreMap[s.variant_id] ??= []).push({
        id: s.id, tester: s.tester, dimId: s.dim_id, value: s.value,
        comment: s.comment, date: fmtDate(s.created_at), evalDoc: s.eval_doc,
        authorType: s.author_type || 'human',
        proxyAuthorId: s.proxy_author_id || null,
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
        authorType: v.author_type || 'human',
        proxyAuthorId: v.proxy_author_id || null,
      });
    }

    const result = plans.map(p => ({
      id: p.id, name: p.name, type: p.type, status: p.status,
      priority: p.priority, created: fmtDate(p.created_at),
      desc: p.description, result: p.result,
      owner: p.owner || '', deadline: p.deadline || '',
      relatedSkill: p.related_skill || '', attachment: p.attachment || '',
      variants: variantMap[p.id] || [],
    }));

    res.json(local(result));
  } catch (err) {
    console.error('[plans/list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/plans ---
router.post('/plans', requireRole('admin'), (req, res) => {
  try {
    const { name, type, priority = 'medium', desc = '', status = 'next',
            owner = '', deadline = '', related_skill = '', attachment = '' } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name 和 type 必填' });

    const id = 'p' + uid();
    db.prepare(`INSERT INTO plans (id, name, type, status, priority, description, owner, deadline, related_skill, attachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, name, type, status, priority, desc, owner, deadline, related_skill, attachment);

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    res.status(201).json(local({
      id: plan.id, name: plan.name, type: plan.type, status: plan.status,
      priority: plan.priority, created: fmtDate(plan.created_at),
      desc: plan.description, result: plan.result,
      owner: plan.owner || '', deadline: plan.deadline || '',
      relatedSkill: plan.related_skill || '', attachment: plan.attachment || '',
      variants: [],
    }));
  } catch (err) {
    console.error('[plans/create]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/plans/:id ---
router.put('/plans/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, priority, desc, owner, deadline, related_skill, attachment } = req.body;
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (priority !== undefined) { sets.push('priority = ?'); vals.push(priority); }
    if (desc !== undefined) { sets.push('description = ?'); vals.push(desc); }
    if (owner !== undefined) { sets.push('owner = ?'); vals.push(owner); }
    if (deadline !== undefined) { sets.push('deadline = ?'); vals.push(deadline); }
    if (related_skill !== undefined) { sets.push('related_skill = ?'); vals.push(related_skill); }
    if (attachment !== undefined) { sets.push('attachment = ?'); vals.push(attachment); }
    if (sets.length === 0) return res.status(400).json({ error: '无更新字段' });

    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[plans/edit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PATCH /api/plans/:id/status ---
router.patch('/plans/:id/status', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { status, result } = req.body;
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    if (!plan) return res.status(404).json({ error: '工单不存在' });

    // 状态转换校验：next → active, done → active（撤销定稿）
    if (status === 'active' && plan.status !== 'next' && plan.status !== 'done') {
      return res.status(400).json({ error: '只能从 next 或 done 激活' });
    }
    if (status === 'done') {
      if (plan.status !== 'active') return res.status(400).json({ error: '只能从 active 完成' });
      if (!result || !['adopted', 'shelved'].includes(result)) {
        return res.status(400).json({ error: 'done 必须指定 result: adopted|shelved' });
      }
    }

    db.prepare(`UPDATE plans SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, status === 'done' ? result : null, id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[plans/status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/plans/:id ---
router.delete('/plans/:id', requireRole('admin'), (req, res) => {
  try {
    deletePlan(req.params.id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[plans/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  方案 (Variants)
// ============================================================

// --- POST /api/plans/:id/variants ---
router.post('/plans/:planId/variants', requireRole('admin', 'tester', 'member'), (req, res) => {
  try {
    const { planId } = req.params;
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!plan) return res.status(404).json({ error: '工单不存在' });

    const lockMsg = checkPlanNotDone(planId);
    if (lockMsg) return res.status(403).json({ error: lockMsg });

    const { name, desc = '', link = '', content = null, attachments = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name 必填' });

    const id = 'v' + uid();
    const attStr = typeof attachments === 'string' ? attachments : JSON.stringify(attachments);
    // 走 REST API 的请求永远是真人：uploader 强制用 JWT 里的 username，不信任 body
    // 小合代笔走直接 db-ops 调用，在 server/mcp/db-ops.js 里注入 AI 字段
    db.prepare(`INSERT INTO variants (id, plan_id, name, uploader, description, link, content, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, planId, name, req.user, desc, link, content, attStr);

    const v = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    res.status(201).json(local({
      id: v.id, name: v.name, uploader: v.uploader,
      uploaded: fmtDate(v.uploaded_at), desc: v.description,
      link: v.link, content: v.content, attachments: parseJSON(v.attachments), scores: [],
    }));
  } catch (err) {
    console.error('[variants/create]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/variants/:id ---
router.put('/variants/:id', requireRole('admin', 'tester', 'member'), (req, res) => {
  try {
    const { id } = req.params;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) return res.status(404).json({ error: '方案不存在' });

    // 定稿锁定
    const lockMsg = checkPlanNotDone(variant.plan_id);
    if (lockMsg) return res.status(403).json({ error: lockMsg });

    // 归属校验：非 admin 只能编辑自己的方案
    if (req.role !== 'admin' && variant.uploader !== req.user) {
      return res.status(403).json({ error: '只能编辑自己的方案' });
    }

    const { name, desc, link, content, attachments } = req.body;
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (desc !== undefined) { sets.push('description = ?'); vals.push(desc); }
    if (link !== undefined) { sets.push('link = ?'); vals.push(link); }
    if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
    if (attachments !== undefined) {
      sets.push('attachments = ?');
      vals.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments));
    }
    if (sets.length === 0) return res.status(400).json({ error: '无更新字段' });

    sets.push("updated_at = datetime('now')");
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[variants/edit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/variants/:id ---
router.delete('/variants/:id', requireRole('admin', 'tester', 'member'), (req, res) => {
  try {
    const { id } = req.params;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) return res.status(404).json({ error: '方案不存在' });

    // 定稿锁定
    const lockMsg = checkPlanNotDone(variant.plan_id);
    if (lockMsg) return res.status(403).json({ error: lockMsg });

    if (req.role !== 'admin') {
      // 归属校验
      if (variant.uploader !== req.user) {
        return res.status(403).json({ error: '只能删除自己的方案' });
      }
      // 仅保护他人评分，自己（含代笔）的自评不阻拦 —— 随 variant 一并级联删
      const otherScoreCount = db.prepare(
        'SELECT COUNT(*) AS n FROM scores WHERE variant_id = ? AND tester != ?'
      ).get(id, req.user).n;
      if (otherScoreCount > 0) {
        return res.status(403).json({ error: '方案已有他人评分，无法删除' });
      }
    }

    db.prepare('DELETE FROM scores WHERE variant_id = ?').run(id);
    db.prepare('DELETE FROM variants WHERE id = ?').run(id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[variants/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  评分 (Scores)
// ============================================================

// --- POST /api/variants/:id/scores --- 批量提交
router.post('/variants/:variantId/scores', requireRole('admin', 'tester'), (req, res) => {
  try {
    const { variantId } = req.params;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId);
    if (!variant) return res.status(404).json({ error: '方案不存在' });

    const lockMsg = checkPlanNotDone(variant.plan_id);
    if (lockMsg) return res.status(403).json({ error: lockMsg });

    const { tester, scores, evalDoc } = req.body;
    if (!tester || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'tester 和 scores[] 必填' });
    }

    // 校验评分上限
    const dimsMap = {};
    for (const d of db.prepare('SELECT * FROM dimensions').all()) {
      dimsMap[d.id] = d;
    }
    for (const s of scores) {
      const dim = dimsMap[s.dim_id];
      if (!dim) return res.status(400).json({ error: `维度 ${s.dim_id} 不存在` });
      if (s.value < 0 || s.value > dim.max) {
        return res.status(400).json({ error: `维度 ${dim.name} 满分为 ${dim.max}，提交值 ${s.value} 越界` });
      }
    }

    // REST API 默认真人（author_type DEFAULT 'human'）；代笔走 mcp/db-ops 注入 AI 字段
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

    res.status(201).json(local({ scores: created }));
  } catch (err) {
    console.error('[scores/submit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/scores/:id --- 编辑单条评分
router.put('/scores/:id', requireRole('admin', 'tester'), (req, res) => {
  try {
    const { id } = req.params;
    const score = db.prepare('SELECT * FROM scores WHERE id = ?').get(id);
    if (!score) return res.status(404).json({ error: '评分不存在' });

    // 定稿锁定
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(score.plan_id);
    if (plan && plan.status === 'done') {
      return res.status(403).json({ error: '工单已定稿，无法编辑评分' });
    }

    // 归属校验：非 admin 只能改自己的
    if (req.role !== 'admin' && score.tester !== req.user) {
      return res.status(403).json({ error: '只能编辑自己的评分' });
    }

    const { value, comment, evalDoc } = req.body;
    const sets = [];
    const vals = [];
    if (value !== undefined) {
      const dim = db.prepare('SELECT * FROM dimensions WHERE id = ?').get(score.dim_id);
      if (dim && (value < 0 || value > dim.max)) {
        return res.status(400).json({ error: `维度 ${dim.name} 满分为 ${dim.max}，提交值 ${value} 越界` });
      }
      sets.push('value = ?'); vals.push(value);
    }
    if (comment !== undefined) { sets.push('comment = ?'); vals.push(comment); }
    if (evalDoc !== undefined) { sets.push('eval_doc = ?'); vals.push(evalDoc); }
    if (sets.length === 0) return res.status(400).json({ error: '无更新字段' });

    db.prepare(`UPDATE scores SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[scores/edit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/scores/:id --- 删除单条评分
router.delete('/scores/:id', requireRole('admin', 'tester'), (req, res) => {
  try {
    const { id } = req.params;
    const score = db.prepare('SELECT * FROM scores WHERE id = ?').get(id);
    if (!score) return res.status(404).json({ error: '评分不存在' });

    // 定稿锁定
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(score.plan_id);
    if (plan && plan.status === 'done') {
      return res.status(403).json({ error: '工单已定稿，无法删除评分' });
    }

    // 归属校验：非 admin 只能删自己的
    if (req.role !== 'admin' && score.tester !== req.user) {
      return res.status(403).json({ error: '只能删除自己的评分' });
    }

    db.prepare('DELETE FROM scores WHERE id = ?').run(id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[scores/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  维度 (Dimensions)
// ============================================================

// --- GET /api/dimensions ---
router.get('/dimensions', (_req, res) => {
  try {
    const dims = db.prepare('SELECT * FROM dimensions ORDER BY sort_order').all();
    const result = dims.map(d => ({
      id: d.id, name: d.name, max: d.max, active: !!d.active,
    }));
    res.json(local(result));
  } catch (err) {
    console.error('[dims/list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/dimensions ---
router.post('/dimensions', requireRole('admin'), (req, res) => {
  try {
    const { name, max = 10 } = req.body;
    if (!name) return res.status(400).json({ error: 'name 必填' });

    const id = 'd' + uid();
    const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM dimensions').get().m || 0;
    db.prepare('INSERT INTO dimensions (id, name, max, sort_order) VALUES (?, ?, ?, ?)')
      .run(id, name, max, maxOrder + 1);

    res.status(201).json(local({ id, name, max, active: true }));
  } catch (err) {
    console.error('[dims/create]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/dimensions/:id ---
router.put('/dimensions/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, max, active } = req.body;
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (max !== undefined) { sets.push('max = ?'); vals.push(max); }
    if (active !== undefined) { sets.push('active = ?'); vals.push(active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: '无更新字段' });

    db.prepare(`UPDATE dimensions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[dims/edit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/dimensions/:id --- 软删除
router.delete('/dimensions/:id', requireRole('admin'), (req, res) => {
  try {
    db.prepare('UPDATE dimensions SET active = 0 WHERE id = ?').run(req.params.id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[dims/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  文件上传
// ============================================================

// --- POST /api/upload --- 多文件上传（最多 10 个）
router.post('/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: '未选择文件' });
    const result = req.files.map(f => {
      const path = `uploads/eval/${f.filename}`;
      console.log(`[upload] ${f.originalname} → ${path} (${(f.size / 1024).toFixed(1)}KB)`);
      return { path, originalName: f.originalname, size: f.size };
    });
    res.json(local(result));
  } catch (err) {
    console.error('[upload]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/uploads/* --- 静态文件服务
import expressModule from 'express';
router.use('/uploads', expressModule.static(UPLOAD_DIR));

// ============================================================
//  工具函数
// ============================================================

/** 安全解析 JSON，失败返回 [] */
function parseJSON(str) {
  if (!str) return [];
  try { const r = JSON.parse(str); return Array.isArray(r) ? r : []; }
  catch { return []; }
}

/** ISO datetime → "MM-DD" */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default router;
