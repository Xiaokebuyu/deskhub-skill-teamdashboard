import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/init.js';
import { wrapResponse } from '../utils/meta.js';
import { requireAuth, requireRole, JWT_SECRET } from '../middleware/auth.js';

const router = Router();
const local = (data) => wrapResponse(data, { source: 'local' });

// --- POST /api/auth/login --- 登录（公开）
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码必填' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name || user.username,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('deskskill_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });

    res.json(local({
      token,
      user: payload,
    }));
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/auth/logout --- 清除 session cookie
router.post('/logout', (_req, res) => {
  res.clearCookie('deskskill_session', { path: '/' });
  res.json(local({ ok: true }));
});

// --- GET /api/auth/me --- 验证 token，返回用户信息（需登录）
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    res.json(local({
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name || user.username,
    }));
  } catch (err) {
    console.error('[auth/me]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/auth/users --- 列出所有用户（admin）
router.get('/users', requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at').all();
    res.json(local(users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      displayName: u.display_name || u.username,
      created: u.created_at,
    }))));
  } catch (err) {
    console.error('[auth/users]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/auth/users --- 创建用户（admin）
router.post('/users', requireRole('admin'), (req, res) => {
  try {
    const { username, password, role = 'member', displayName = '' } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码必填' });
    }
    if (!['admin', 'tester', 'member'].includes(role)) {
      return res.status(400).json({ error: '角色无效' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const id = 'u_' + crypto.randomUUID().slice(0, 8);
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)')
      .run(id, username, hash, role, displayName || username);

    res.status(201).json(local({
      id, username, role,
      displayName: displayName || username,
    }));
  } catch (err) {
    console.error('[auth/createUser]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/auth/users/:id --- 删除用户（admin）
router.delete('/users/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    // 不能删自己
    if (id === req.auth.userId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[auth/deleteUser]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/auth/password --- 修改密码（任何登录用户）
router.put('/password', requireAuth, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码必填' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json(local({ ok: true }));
  } catch (err) {
    console.error('[auth/password]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
