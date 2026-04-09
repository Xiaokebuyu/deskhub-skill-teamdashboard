import { z } from 'zod';

export function registerSystemTools(server, auth) {
  server.tool(
    'health_check',
    '检查 DeskSkill TeamBoard 服务器健康状态',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          }, null, 2),
        }],
      };
    }
  );
}
