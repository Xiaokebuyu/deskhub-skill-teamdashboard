import { Router } from 'express';
import { getCache, setCache } from '../middleware/cache.js';
import { wrapResponse } from '../utils/meta.js';
import { createMcpRpc } from '../mcp/mcp-rpc.js';

const router = Router();
const MCP_URL = () => process.env.MCP_ENDPOINT || 'http://127.0.0.1:18790/deskclaw/mcp';

const { mcpCall } = createMcpRpc({
  getUrl: MCP_URL,
  clientInfo: { name: 'teamboard-proxy', version: '1.0' },
  label: 'MCP',
  onInit: (sid) => console.log('[mcp] Session acquired:', sid.slice(0, 8) + '...'),
});

// --- GET /api/proxy/mcp/tools --- 工具列表
router.get('/tools', async (_req, res) => {
  try {
    const cacheKey = 'mcp:tools';
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'mcp', cached: true, ttl: hit.ttl }));

    const rpc = await mcpCall('tools/list');
    const tools = rpc.result?.tools || [];

    // 转换为前端友好格式
    const data = tools.map(t => ({
      name: t.name,
      desc: (t.description || '').split('\n')[0], // 取第一行作摘要
      fullDesc: t.description || '',
      params: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
    }));

    setCache(cacheKey, data, 1800); // 30 分钟
    res.json(wrapResponse(data, { source: 'mcp' }));
  } catch (err) {
    console.error('[proxy/mcp/tools]', err.message);
    res.status(502).json({ data: null, meta: { source: 'mcp', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- GET /api/proxy/mcp/health --- 健康状态
router.get('/health', async (_req, res) => {
  try {
    const rpc = await mcpCall('tools/call', { name: 'get_health', arguments: {} });
    const content = rpc.result?.content?.[0]?.text;
    const data = content ? JSON.parse(content) : null;
    res.json(wrapResponse(data, { source: 'mcp' }));
  } catch (err) {
    console.error('[proxy/mcp/health]', err.message);
    res.status(502).json({ data: null, meta: { source: 'mcp', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- GET /api/proxy/mcp/servers --- MCP 服务器列表
router.get('/servers', async (_req, res) => {
  try {
    const cacheKey = 'mcp:servers';
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'mcp', cached: true, ttl: hit.ttl }));

    const rpc = await mcpCall('tools/call', { name: 'mcp_server_list', arguments: {} });
    const content = rpc.result?.content?.[0]?.text;
    const data = content ? JSON.parse(content) : [];

    setCache(cacheKey, data, 600); // 10 分钟
    res.json(wrapResponse(data, { source: 'mcp' }));
  } catch (err) {
    console.error('[proxy/mcp/servers]', err.message);
    res.status(502).json({ data: null, meta: { source: 'mcp', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- GET /api/proxy/mcp/info --- 服务器基本信息（version + capabilities）
router.get('/info', async (_req, res) => {
  try {
    const cacheKey = 'mcp:info';
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'mcp', cached: true, ttl: hit.ttl }));

    // 重新 initialize 以获取最新 serverInfo
    sessionId = null;
    await initSession();
    const initRes = await fetch(MCP_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'initialize', id: 99,
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'teamboard-probe', version: '1.0' } },
      }),
    });
    sessionId = initRes.headers.get('mcp-session-id');
    const text = await initRes.text();
    const dataLine = text.split('\n').find(l => l.startsWith('data: '));
    const rpc = dataLine ? JSON.parse(dataLine.slice(6)) : {};

    const data = {
      name: rpc.result?.serverInfo?.name || 'deskclaw',
      version: rpc.result?.serverInfo?.version || '—',
      instructions: rpc.result?.instructions || '',
      capabilities: rpc.result?.capabilities || {},
    };

    setCache(cacheKey, data, 1800);
    res.json(wrapResponse(data, { source: 'mcp' }));
  } catch (err) {
    console.error('[proxy/mcp/info]', err.message);
    res.status(502).json({ data: null, meta: { source: 'mcp', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

export default router;
