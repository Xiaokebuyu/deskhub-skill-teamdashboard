import { z } from 'zod';
import * as proxy from '../proxy-ops.js';

export function registerUmamiTools(server, auth) {
  server.tool(
    'get_umami_stats',
    '获取 Umami 网站总体统计数据（访问量、访客数、跳出率等）',
    {
      start_at: z.number().describe('起始时间戳（毫秒）'),
      end_at: z.number().describe('结束时间戳（毫秒）'),
    },
    async ({ start_at, end_at }) => {
      const data = await proxy.getUmamiStats(start_at, end_at);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_umami_pageviews',
    '获取 Umami 页面浏览量时间线数据',
    {
      start_at: z.number().describe('起始时间戳（毫秒）'),
      end_at: z.number().describe('结束时间戳（毫秒）'),
      unit: z.enum(['hour', 'day', 'week', 'month']).default('day').describe('时间粒度'),
    },
    async ({ start_at, end_at, unit }) => {
      const data = await proxy.getUmamiPageviews(start_at, end_at, unit);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_umami_metrics',
    '获取 Umami 自定义指标数据（URL、浏览器、操作系统等）',
    {
      type: z.string().describe('指标类型（url, browser, os, device, country, event）'),
      start_at: z.number().describe('起始时间戳（毫秒）'),
      end_at: z.number().describe('结束时间戳（毫秒）'),
    },
    async ({ type, start_at, end_at }) => {
      const data = await proxy.getUmamiMetrics(type, start_at, end_at);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_umami_events',
    '获取 Umami 事件字段数据',
    {
      start_at: z.number().describe('起始时间戳（毫秒）'),
      end_at: z.number().describe('结束时间戳（毫秒）'),
    },
    async ({ start_at, end_at }) => {
      const data = await proxy.getUmamiEventData(start_at, end_at);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_umami_active',
    '获取 Umami 当前活跃用户数',
    {},
    async () => {
      const data = await proxy.getUmamiActive();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );
}
