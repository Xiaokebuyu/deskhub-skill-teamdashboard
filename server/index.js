import './env.js'; // .env 必须在所有其他 import 之前加载

import express from 'express';
import cors from 'cors';
import deskhubProxy from './routes/proxy.js';
import umamiProxy from './routes/umami.js';
import workbenchRoutes from './routes/workbench.js';
// MCP 代理暂缓：外部 DeskClaw MCP 服务（127.0.0.1:18790）未接通，删路由避免日志噪音
// 接通外部 MCP 后把 routes/mcp.js 恢复挂载即可
import authRoutes from './routes/auth.js';
import mcpServer from './mcp/index.js';
import { requireAuth } from './middleware/auth.js';

// MCP OAuth
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { provider, handleLogin, ensureClientMiddleware } from './mcp/oauth-provider.js';

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map(s => s.trim()) } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));  // OAuth 登录表单

// --- 静态文件（公开，不需要登录）---
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, 'uploads');
app.use('/api/uploads', express.static(UPLOAD_DIR));

// --- MCP OAuth 认证服务器（根级，处理 /.well-known, /authorize, /token, /register）---
const issuerUrl = new URL(process.env.MCP_ISSUER_URL || `http://localhost:${PORT}`);
app.use(ensureClientMiddleware);  // 在 OAuth 路由前：自动注册未知 client + redirect_uri
app.use(mcpAuthRouter({
  provider,
  issuerUrl,
  scopesSupported: ['mcp:tools'],
}));

// OAuth 登录表单处理
app.post('/oauth/login', handleLogin);

// --- MCP Streamable HTTP 服务器（Bearer auth 保护）---
const MCP_PATH = process.env.MCP_PATH || '/mcp';
app.use(MCP_PATH, requireBearerAuth({ verifier: provider }), mcpServer);

// --- 路由挂载 ---
app.use('/api/auth', authRoutes);                    // 登录（公开）+ 用户管理（自带鉴权）
app.use('/api/proxy/deskhub', deskhubProxy);         // 代理不需要登录（在 requireAuth 之前）
app.use('/api/proxy/umami', umamiProxy);
// app.use('/api/proxy/mcp', mcpProxy);   // 外部 MCP 未接通，先注释
app.use('/api', requireAuth, workbenchRoutes);       // 工作台需登录

// --- 健康检查 ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const distPath = join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production' && existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// --- Express 错误兜底（所有路由之后）---
app.use((err, req, res, _next) => {
  console.error('[express/error]', req.method, req.path, err);
  if (res.headersSent) {
    res.destroy(err);
    return;
  }
  res.status(500).json({ error: '服务器内部错误' });
});

// --- 进程级异常兜底 ---
process.on('unhandledRejection', (reason) => {
  console.error('[fatal/unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal/uncaughtException]', err);
  process.exit(1);
});

// --- 飞书 LLM 机器人 ---
import { startBot } from './bot/index.js';

const server = app.listen(PORT, () => {
  console.log(`[server] DeskSkill API running on http://localhost:${PORT}`);
  console.log(`[server] MCP endpoint: http://localhost:${PORT}${MCP_PATH}`);
  console.log(`[server] OAuth issuer: ${issuerUrl.href}`);
  startBot().catch(err => console.error('[Bot] 启动失败:', err));
});

// --- Graceful shutdown ---
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, closing HTTP server...`);
  server.closeIdleConnections?.();
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[shutdown] forced exit after 30s');
    process.exit(1);
  }, 30_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
