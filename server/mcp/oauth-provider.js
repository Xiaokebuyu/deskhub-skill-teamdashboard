/**
 * DeskSkill MCP OAuth 2.0 Provider
 *
 * 实现 @modelcontextprotocol/sdk 的 OAuthServerProvider 接口
 *
 * 持久化策略（优雅的选择）：
 * - Token → JWT（无状态，靠签名验证，重启后自动有效）
 * - Clients → SQLite（注册过的客户端持久化）
 * - Codes / PendingAuths → 内存（一次性、短命，丢了重新认证）
 */

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/init.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { renderLoginPage } from './login-page.js';

// ============================================================
//  Clients Store（SQLite 持久化）
// ============================================================

// 建表（幂等）
db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id              TEXT PRIMARY KEY,
    client_name            TEXT DEFAULT 'auto',
    redirect_uris          TEXT DEFAULT '[]',
    token_endpoint_auth_method TEXT DEFAULT 'none',
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

class ClientsStore {
  async getClient(clientId) {
    const row = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId);
    if (!row) return undefined;
    return {
      client_id: row.client_id,
      client_name: row.client_name,
      redirect_uris: JSON.parse(row.redirect_uris || '[]'),
      token_endpoint_auth_method: row.token_endpoint_auth_method,
    };
  }

  async registerClient(clientMetadata) {
    const existing = db.prepare('SELECT client_id FROM oauth_clients WHERE client_id = ?').get(clientMetadata.client_id);
    if (existing) {
      // 更新 redirect_uris
      db.prepare('UPDATE oauth_clients SET redirect_uris = ?, client_name = ? WHERE client_id = ?')
        .run(JSON.stringify(clientMetadata.redirect_uris || []), clientMetadata.client_name || 'auto', clientMetadata.client_id);
    } else {
      db.prepare('INSERT INTO oauth_clients (client_id, client_name, redirect_uris, token_endpoint_auth_method) VALUES (?, ?, ?, ?)')
        .run(
          clientMetadata.client_id,
          clientMetadata.client_name || 'auto',
          JSON.stringify(clientMetadata.redirect_uris || []),
          clientMetadata.token_endpoint_auth_method || 'none',
        );
    }
    return clientMetadata;
  }

  /** 确保 redirect_uri 在客户端白名单里 */
  addRedirectUri(clientId, redirectUri) {
    const row = db.prepare('SELECT redirect_uris FROM oauth_clients WHERE client_id = ?').get(clientId);
    if (!row) return;
    const uris = JSON.parse(row.redirect_uris || '[]');
    if (!uris.includes(redirectUri)) {
      uris.push(redirectUri);
      db.prepare('UPDATE oauth_clients SET redirect_uris = ? WHERE client_id = ?')
        .run(JSON.stringify(uris), clientId);
    }
  }
}

// ============================================================
//  OAuth Provider
// ============================================================

class DeskSkillOAuthProvider {
  constructor() {
    this.clientsStore = new ClientsStore();
    this.codes = new Map();          // 内存：code → { client, params, userId, role, username }
    this.pendingAuths = new Map();   // 内存：requestId → { client, params }

    // 每 10 分钟清理过期 codes
    setInterval(() => this._cleanup(), 10 * 60 * 1000);
  }

  /**
   * authorize — 渲染登录页
   */
  async authorize(client, params, res) {
    const session = this._getSessionFromCookie(res.req);
    if (session) {
      const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.userId);
      if (user) {
        const code = randomUUID();
        this.codes.set(code, {
          client, params,
          userId: user.id, role: user.role, username: user.username,
          createdAt: Date.now(),
        });

        const targetUrl = new URL(params.redirectUri);
        targetUrl.searchParams.set('code', code);
        if (params.state) targetUrl.searchParams.set('state', params.state);

        const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
        console.log(`[mcp/oauth] Auto-authorized via session: ${user.username} (${roleMap[user.role] || user.role})`);
        return res.redirect(targetUrl.toString());
      }
    }

    const requestId = randomUUID();
    this.pendingAuths.set(requestId, { client, params, createdAt: Date.now() });
    res.type('html').send(renderLoginPage(requestId));
  }

  /**
   * 处理登录表单提交（POST /oauth/login）
   */
  async handleLogin(req, res) {
    const { request_id, username, password } = req.body;

    const pending = this.pendingAuths.get(request_id);
    if (!pending) {
      return res.type('html').send(renderLoginPage(request_id, '授权请求已过期，请重新连接'));
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.type('html').send(renderLoginPage(request_id, '用户名或密码错误'));
    }

    const code = randomUUID();
    this.codes.set(code, {
      client: pending.client, params: pending.params,
      userId: user.id, role: user.role, username: user.username,
      createdAt: Date.now(),
    });

    this.pendingAuths.delete(request_id);
    this._setSessionCookie(res, user);

    const targetUrl = new URL(pending.params.redirectUri);
    targetUrl.searchParams.set('code', code);
    if (pending.params.state) targetUrl.searchParams.set('state', pending.params.state);

    res.redirect(targetUrl.toString());
  }

  /**
   * challengeForAuthorizationCode — 返回 PKCE challenge
   */
  async challengeForAuthorizationCode(client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) throw new Error('Invalid authorization code');
    return codeData.params.codeChallenge;
  }

  /**
   * exchangeAuthorizationCode — 用 code 换 JWT token
   */
  async exchangeAuthorizationCode(client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) throw new Error('Invalid authorization code');

    if (codeData.client.client_id !== client.client_id) {
      throw new Error('Authorization code was not issued to this client');
    }
    if (Date.now() - codeData.createdAt > 10 * 60 * 1000) {
      this.codes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }

    this.codes.delete(authorizationCode);

    const tokenPayload = {
      userId: codeData.userId,
      role: codeData.role,
      username: codeData.username,
      clientId: client.client_id,
      scopes: codeData.params.scopes || [],
    };

    return this._issueTokenPair(tokenPayload, codeData.params.scopes);
  }

  /**
   * exchangeRefreshToken — 用 refresh token 换新的 access + refresh token
   */
  async exchangeRefreshToken(client, refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      throw new Error(err.name === 'TokenExpiredError' ? 'Refresh token expired' : 'Invalid refresh token');
    }

    if (payload.type !== 'mcp_refresh') {
      throw new Error('Invalid token type');
    }

    return this._issueTokenPair({
      userId: payload.userId,
      role: payload.role,
      username: payload.username,
      clientId: payload.clientId,
      scopes: payload.scopes || [],
    }, payload.scopes);
  }

  /**
   * verifyAccessToken — JWT 验证（无状态，不查 Map）
   */
  async verifyAccessToken(token) {
    // 1. 静态 admin token
    const apiToken = process.env.MCP_API_TOKEN;
    if (apiToken && token === apiToken) {
      return {
        token,
        clientId: '_api_token',
        scopes: ['mcp:tools'],
        extra: { role: 'admin', username: '_mcp_service', userId: '_mcp' },
      };
    }

    // 2. JWT 验证
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
    }

    if (payload.type !== 'mcp_access') {
      throw new Error('Invalid token type');
    }

    return {
      token,
      clientId: payload.clientId,
      scopes: payload.scopes || [],
      expiresAt: payload.exp,
      extra: {
        role: payload.role,
        username: payload.username,
        userId: payload.userId,
      },
    };
  }

  /**
   * 生成 access + refresh token 对
   * access: 1 小时，用于 API 调用
   * refresh: 7 天，用于无感续期
   */
  _issueTokenPair(payload, scopes) {
    const accessToken = jwt.sign(
      { ...payload, type: 'mcp_access' },
      JWT_SECRET,
      { expiresIn: 3600 },
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'mcp_refresh' },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
    console.log(`[mcp/oauth] Token issued: ${payload.username} (${roleMap[payload.role] || payload.role})`);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      scope: (scopes || []).join(' '),
      refresh_token: refreshToken,
    };
  }

  _getSessionFromCookie(req) {
    const cookieHeader = req?.headers?.cookie;
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)deskskill_session=([^\s;]+)/);
    if (!match) return null;
    try {
      return jwt.verify(match[1], JWT_SECRET);
    } catch {
      return null;
    }
  }

  _setSessionCookie(res, user) {
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    res.cookie('deskskill_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });
  }

  _cleanup() {
    const now = Date.now();
    for (const [code, data] of this.codes) {
      if (now - data.createdAt > 10 * 60 * 1000) this.codes.delete(code);
    }
    for (const [id, data] of this.pendingAuths) {
      if (now - data.createdAt > 10 * 60 * 1000) this.pendingAuths.delete(id);
    }
  }
}

// 单例
export const provider = new DeskSkillOAuthProvider();

/**
 * 中间件：/authorize 前自动注册 client + redirect_uri
 */
export function ensureClientMiddleware(req, res, next) {
  if (req.path === '/authorize' && req.query.client_id && req.query.redirect_uri) {
    const { client_id, redirect_uri } = req.query;
    const store = provider.clientsStore;

    // 同步查（SQLite 是同步的）
    const existing = db.prepare('SELECT client_id FROM oauth_clients WHERE client_id = ?').get(client_id);
    if (!existing) {
      store.registerClient({
        client_id,
        client_name: 'auto',
        redirect_uris: [redirect_uri],
        token_endpoint_auth_method: 'none',
      });
      console.log(`[mcp/oauth] Auto-registered client: ${client_id.slice(0, 8)}...`);
    } else {
      store.addRedirectUri(client_id, redirect_uri);
    }
  }
  next();
}

export function handleLogin(req, res) {
  return provider.handleLogin(req, res);
}
