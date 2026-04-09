/**
 * DeskSkill MCP OAuth 2.0 Provider
 *
 * 实现 @modelcontextprotocol/sdk 的 OAuthServerProvider 接口
 * 用 SQLite users 表验证登录，内存存储 codes/tokens/clients
 */

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/init.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { renderLoginPage } from './login-page.js';

// ============================================================
//  Clients Store（动态客户端注册）
// ============================================================

class ClientsStore {
  constructor() {
    this.clients = new Map();
  }

  async getClient(clientId) {
    return this.clients.get(clientId) || undefined;
  }

  async registerClient(clientMetadata) {
    this.clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }
}

// ============================================================
//  OAuth Provider
// ============================================================

class DeskSkillOAuthProvider {
  constructor() {
    this.clientsStore = new ClientsStore();
    this.codes = new Map();      // code → { client, params, userId, role, username }
    this.tokens = new Map();     // token → { userId, role, username, clientId, scopes, expiresAt, resource }
    this.pendingAuths = new Map(); // requestId → { client, params }

    // 每 10 分钟清理过期 codes 和 tokens
    setInterval(() => this._cleanup(), 10 * 60 * 1000);
  }

  /**
   * authorize — 渲染登录页
   * SDK 的 /authorize 端点调用此方法，传入已验证的 client 和 OAuth 参数
   */
  async authorize(client, params, res) {
    const session = this._getSessionFromCookie(res.req);
    if (session) {
      const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.userId);
      if (user) {
        const code = randomUUID();
        this.codes.set(code, {
          client,
          params,
          userId: user.id,
          role: user.role,
          username: user.username,
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
   * 非 Provider 接口方法，由 Express 路由直接调用
   */
  async handleLogin(req, res) {
    const { request_id, username, password } = req.body;

    // 1. 查找 pending auth request
    const pending = this.pendingAuths.get(request_id);
    if (!pending) {
      return res.type('html').send(renderLoginPage(request_id, '授权请求已过期，请重新连接'));
    }

    // 2. 验证用户
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.type('html').send(renderLoginPage(request_id, '用户名或密码错误'));
    }

    // 3. 生成 authorization code
    const code = randomUUID();
    this.codes.set(code, {
      client: pending.client,
      params: pending.params,
      userId: user.id,
      role: user.role,
      username: user.username,
      createdAt: Date.now(),
    });

    // 4. 清理 pending
    this.pendingAuths.delete(request_id);

    // 5. 设置 session cookie，下次 OAuth 自动通过
    this._setSessionCookie(res, user);

    // 6. 重定向回客户端（带 code 和 state）
    const targetUrl = new URL(pending.params.redirectUri);
    targetUrl.searchParams.set('code', code);
    if (pending.params.state) {
      targetUrl.searchParams.set('state', pending.params.state);
    }

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
   * exchangeAuthorizationCode — 用 code 换 token
   */
  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, _redirectUri, _resource) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) throw new Error('Invalid authorization code');

    // 验证 code 是发给这个 client 的
    if (codeData.client.client_id !== client.client_id) {
      throw new Error('Authorization code was not issued to this client');
    }

    // Code 10 分钟过期
    if (Date.now() - codeData.createdAt > 10 * 60 * 1000) {
      this.codes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }

    // 消费 code（一次性）
    this.codes.delete(authorizationCode);

    // 生成 access token
    const token = randomUUID();
    const expiresIn = 3600; // 1 小时
    this.tokens.set(token, {
      userId: codeData.userId,
      role: codeData.role,
      username: codeData.username,
      clientId: client.client_id,
      scopes: codeData.params.scopes || [],
      expiresAt: Date.now() + expiresIn * 1000,
      resource: codeData.params.resource,
      type: 'access',
    });

    const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
    console.log(`[mcp/oauth] Token issued: ${codeData.username} (${roleMap[codeData.role] || codeData.role})`);

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: expiresIn,
      scope: (codeData.params.scopes || []).join(' '),
    };
  }

  /**
   * exchangeRefreshToken — 暂不实现
   */
  async exchangeRefreshToken(_client, _refreshToken, _scopes, _resource) {
    throw new Error('Refresh token 暂不支持，请重新登录');
  }

  /**
   * verifyAccessToken — 验证 token，返回 AuthInfo
   * 同时兼容 MCP_API_TOKEN 静态令牌
   */
  async verifyAccessToken(token) {
    // 1. 检查 MCP_API_TOKEN（静态 admin token）
    const apiToken = process.env.MCP_API_TOKEN;
    if (apiToken && token === apiToken) {
      return {
        token,
        clientId: '_api_token',
        scopes: ['mcp:tools'],
        extra: { role: 'admin', username: '_mcp_service', userId: '_mcp' },
      };
    }

    // 2. 检查 OAuth token
    const tokenData = this.tokens.get(token);
    if (!tokenData) {
      throw new Error('Invalid token');
    }
    if (tokenData.expiresAt < Date.now()) {
      this.tokens.delete(token);
      throw new Error('Token expired');
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1000),
      resource: tokenData.resource,
      extra: {
        role: tokenData.role,
        username: tokenData.username,
        userId: tokenData.userId,
      },
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

  /** 清理过期数据 */
  _cleanup() {
    const now = Date.now();
    // Codes: 10 分钟
    for (const [code, data] of this.codes) {
      if (now - data.createdAt > 10 * 60 * 1000) this.codes.delete(code);
    }
    // Tokens: 按 expiresAt
    for (const [token, data] of this.tokens) {
      if (data.expiresAt < now) this.tokens.delete(token);
    }
    // Pending auths: 10 分钟
    for (const [id, data] of this.pendingAuths) {
      if (now - data.createdAt > 10 * 60 * 1000) this.pendingAuths.delete(id);
    }
  }
}

// 单例
export const provider = new DeskSkillOAuthProvider();

/**
 * Express 中间件：在 /authorize 之前预注册 client + redirect_uri
 * 解决客户端（Cursor 等）跳过 /register 直接带 client_id 的问题
 */
export function ensureClientMiddleware(req, res, next) {
  if (req.path === '/authorize' && req.query.client_id && req.query.redirect_uri) {
    const { client_id, redirect_uri } = req.query;
    const store = provider.clientsStore;
    let client = store.clients.get(client_id);
    if (!client) {
      client = {
        client_id,
        client_name: 'auto',
        redirect_uris: [],
        token_endpoint_auth_method: 'none',
      };
      store.clients.set(client_id, client);
      console.log(`[mcp/oauth] Auto-registered client: ${client_id.slice(0, 8)}...`);
    }
    // 确保 redirect_uri 在白名单中
    if (!client.redirect_uris.includes(redirect_uri)) {
      client.redirect_uris.push(redirect_uri);
    }
  }
  next();
}

// Express 路由处理器（POST /oauth/login）
export function handleLogin(req, res) {
  return provider.handleLogin(req, res);
}
