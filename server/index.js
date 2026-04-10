import express from 'express';
import cors from 'cors';
import deskhubProxy from './routes/proxy.js';
import umamiProxy from './routes/umami.js';
import workbenchRoutes from './routes/workbench.js';
import mcpProxy from './routes/mcp.js';
import authRoutes from './routes/auth.js';
import mcpServer from './mcp/index.js';
import { requireAuth } from './middleware/auth.js';

// MCP OAuth
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { provider, handleLogin, ensureClientMiddleware } from './mcp/oauth-provider.js';

// 读 .env（简易方式，不引入 dotenv）
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch { /* .env 不存在也没关系 */ }

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
app.use('/api/proxy/mcp', mcpProxy);
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

// --- 飞书 LLM 机器人 ---
import { startBot } from './bot/index.js';

app.listen(PORT, () => {
  console.log(`[server] DeskSkill API running on http://localhost:${PORT}`);
  console.log(`[server] MCP endpoint: http://localhost:${PORT}${MCP_PATH}`);
  console.log(`[server] OAuth issuer: ${issuerUrl.href}`);
  startBot().catch(err => console.error('[Bot] 启动失败:', err));
});
