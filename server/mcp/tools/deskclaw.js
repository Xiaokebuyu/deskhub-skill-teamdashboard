import { z } from 'zod';
import * as proxy from '../proxy-ops.js';

/** DeskClaw 调用带容错：本地 MCP 服务可能未启动 */
async function safeDeskclawCall(fn) {
  try {
    return await fn();
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      return { _offline: true, error: `DeskClaw MCP 服务未连接 (${process.env.MCP_ENDPOINT || '127.0.0.1:18790'})，请确认服务已启动` };
    }
    throw err;
  }
}

export function registerDeskclawTools(server) {
  server.tool(
    'list_deskclaw_tools',
    '列出 DeskClaw MCP 服务器上可用的工具列表',
    {},
    async () => {
      const result = await safeDeskclawCall(() => proxy.listDeskclawTools());
      if (result?._offline) return { content: [{ type: 'text', text: result.error }] };

      if (!result || result.length === 0) {
        return { content: [{ type: 'text', text: '暂无可用工具' }] };
      }

      const lines = result.map(t =>
        `- ${t.name} | ${t.desc} | 参数: ${t.params.join(', ') || '无'}`
      );
      return { content: [{ type: 'text', text: `DeskClaw 工具 (${result.length})：\n\n${lines.join('\n')}` }] };
    }
  );

  server.tool(
    'get_deskclaw_health',
    '检查 DeskClaw MCP 服务器健康状态',
    {},
    async () => {
      const result = await safeDeskclawCall(() => proxy.getDeskclawHealth());
      if (result?._offline) return { content: [{ type: 'text', text: result.error }] };
      if (!result) return { content: [{ type: 'text', text: 'DeskClaw MCP 服务器无响应' }] };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'list_deskclaw_servers',
    '列出 DeskClaw MCP 服务器列表',
    {},
    async () => {
      const result = await safeDeskclawCall(() => proxy.listDeskclawServers());
      if (result?._offline) return { content: [{ type: 'text', text: result.error }] };
      if (!result || (Array.isArray(result) && result.length === 0)) {
        return { content: [{ type: 'text', text: '暂无服务器' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_deskclaw_info',
    '获取 DeskClaw MCP 服务器基本信息（名称、版本、能力）',
    {},
    async () => {
      const result = await safeDeskclawCall(() => proxy.getDeskclawInfo());
      if (result?._offline) return { content: [{ type: 'text', text: result.error }] };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
}
