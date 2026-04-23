/**
 * MCP JSON-RPC 调用封装
 *
 * 两处调用方（server/routes/mcp.js 和 server/mcp/proxy-ops.js 的 DeskClaw 段）
 * 原本各维护一份几乎一样的 while-loop + 400-retry + SSE-parse 代码。
 * 这里统一抽出：每个 factory 调用返回一对独立的 { mcpCall, initSession }
 * 各自闭包持有自己的 sessionId，互不干扰。
 *
 * 使用：
 *   const { mcpCall } = createMcpRpc({
 *     getUrl: () => process.env.MCP_ENDPOINT || '...',
 *     clientInfo: { name: 'teamboard-proxy', version: '1.0' },
 *     label: 'MCP',
 *   });
 */

const DEFAULT_MAX_RETRIES = 2;

export function createMcpRpc({ getUrl, clientInfo, label = 'MCP', onInit }) {
  let sessionId = null;

  async function initSession() {
    const res = await fetch(getUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'initialize', id: 1,
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo,
        },
      }),
    });
    sessionId = res.headers.get('mcp-session-id');
    if (!sessionId) throw new Error(`${label} initialize failed: no session ID`);
    onInit?.(sessionId);
    return res;
  }

  async function mcpCall(method, params = {}, id = Date.now()) {
    // 400 = session 过期，重置后最多重试 N 次（递归实现过往遇到上游持续 400 会栈爆）
    let attempts = 0;
    let currentId = id;
    while (true) {
      if (!sessionId) await initSession();

      const res = await fetch(getUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: currentId }),
      });

      if (!res.ok && res.status === 400) {
        if (attempts++ < DEFAULT_MAX_RETRIES) {
          sessionId = null;
          currentId++;
          continue;
        }
        throw new Error(`${label} 持续返 400（已重试 ${attempts} 次）`);
      }

      const text = await res.text();
      const dataLine = text.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) throw new Error(`Invalid ${label} response`);
      return JSON.parse(dataLine.slice(6));
    }
  }

  return { mcpCall, initSession, getSessionId: () => sessionId };
}
