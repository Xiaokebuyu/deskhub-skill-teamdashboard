import { MCPS } from '../constants/mock-data.js';

/**
 * 获取 MCP 工具列表 + 健康状态 + 版本信息
 *
 * 历史上走 /api/proxy/mcp/{tools,info,health} 代理到 DeskClaw MCP 服务
 * （127.0.0.1:18790）。目前外部服务未接通，**暂时走 mock 数据**。
 *
 * 接通后恢复为真实 API：
 *   1. server/index.js 恢复 app.use('/api/proxy/mcp', mcpProxy) 挂载
 *   2. 本函数改回 allSettled 三个 fetch 的逻辑（见 git 历史 179b18f 之前）
 */
export async function getMCPData() {
  return {
    mcps: MCPS,
    info: null,
    health: null,
    isReal: false,
  };
}
