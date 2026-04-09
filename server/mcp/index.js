/**
 * MCP Streamable HTTP 服务器
 * Express 路由 + session 管理
 *
 * 认证由外层 requireBearerAuth 中间件处理（OAuth 2.0 + MCP_API_TOKEN）
 * req.auth.extra 包含 { role, username, userId }
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Tool 注册
import { registerPlanTools } from './tools/plans.js';
import { registerVariantTools } from './tools/variants.js';
import { registerScoreTools } from './tools/scores.js';
import { registerDimensionTools } from './tools/dimensions.js';
import { registerQueryTools } from './tools/queries.js';
import { registerUserTools } from './tools/users.js';
import { registerDeskhubTools } from './tools/deskhub.js';
import { registerUmamiTools } from './tools/umami.js';
// import { registerDeskclawTools } from './tools/deskclaw.js';
import { registerSystemTools } from './tools/system.js';

const router = Router();

// ============================================================
//  Session 管理
// ============================================================

/** @type {Map<string, { transport: StreamableHTTPServerTransport, server: McpServer, auth: object, lastActive: number }>} */
const sessions = new Map();

const SESSION_TIMEOUT = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_TIMEOUT) {
      console.log(`[mcp] Session expired: ${id.slice(0, 8)}...`);
      session.transport.close();
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ============================================================
//  从 req.auth 提取角色信息
// ============================================================

function extractAuthContext(req) {
  // requireBearerAuth 设置 req.auth (AuthInfo)
  // 我们的 provider 在 extra 里放了 role/username/userId
  const authInfo = req.auth;
  if (authInfo?.extra) {
    return {
      role: authInfo.extra.role || 'member',
      username: authInfo.extra.username || '_unknown',
      userId: authInfo.extra.userId || '_unknown',
      source: 'oauth',
    };
  }
  // fallback（不应该走到这里，requireBearerAuth 会拦截）
  return { role: 'member', username: '_unknown', userId: '_unknown', source: 'unknown' };
}

// ============================================================
//  创建带权限上下文的 McpServer
// ============================================================

function createMcpServer(auth) {
  const server = new McpServer({
    name: 'deskskill',
    version: '0.2.0',
  });

  registerPlanTools(server, auth);
  registerVariantTools(server, auth);
  registerScoreTools(server, auth);
  registerDimensionTools(server, auth);
  registerQueryTools(server, auth);
  registerUserTools(server, auth);
  registerDeskhubTools(server, auth);
  registerUmamiTools(server, auth);
  // registerDeskclawTools(server, auth);
  registerSystemTools(server, auth);

  return server;
}

// ============================================================
//  POST — 初始化 / 消息分发
// ============================================================

router.post('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'];
    const isInitialize = !sessionId || (req.body && req.body.method === 'initialize');

    if (isInitialize && !sessionId) {
      const auth = extractAuthContext(req);
      const server = createMcpServer(auth);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      await server.connect(transport);
      const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
      console.log(`[mcp] New session: ${auth.username} (${roleMap[auth.role] || auth.role})`);

      await transport.handleRequest(req, res, req.body);

      const newSessionId = res.getHeader('mcp-session-id');
      if (newSessionId) {
        sessions.set(newSessionId, { transport, server, auth, lastActive: Date.now() });
      }
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or expired session' },
        id: req.body?.id || null,
      });
    }

    session.lastActive = Date.now();
    await session.transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] POST error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: err.message },
        id: req.body?.id || null,
      });
    }
  }
});

// ============================================================
//  GET — SSE 流
// ============================================================

router.get('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'mcp-session-id header required' },
      id: null,
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid or expired session' },
      id: null,
    });
  }

  session.lastActive = Date.now();
  await session.transport.handleRequest(req, res);
});

// ============================================================
//  DELETE — 关闭 session
// ============================================================

router.delete('/', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'mcp-session-id header required' },
      id: null,
    });
  }

  const session = sessions.get(sessionId);
  if (session) {
    await session.transport.close();
    sessions.delete(sessionId);
    console.log(`[mcp] Session closed: ${sessionId.slice(0, 8)}...`);
  }

  res.status(200).json({ ok: true });
});

export default router;
