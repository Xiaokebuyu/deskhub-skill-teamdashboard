import { z } from 'zod';
import * as proxy from '../proxy-ops.js';

export function registerDeskhubTools(server, auth) {
  server.tool(
    'list_deskhub_skills',
    '查询 DeskHub 上所有已发布的技能列表',
    {
      search: z.string().optional().describe('搜索关键词'),
      limit: z.number().optional().describe('返回数量限制'),
    },
    async ({ search, limit }) => {
      const query = {};
      if (search) query.search = search;
      if (limit) query.limit = limit;
      const skills = await proxy.listDeskhubSkills(query);

      if (!skills || (Array.isArray(skills) && skills.length === 0)) {
        return { content: [{ type: 'text', text: '暂无技能数据' }] };
      }

      const list = Array.isArray(skills) ? skills : (skills?.items || [skills]);
      const lines = list.map(s =>
        `- ${s.slug} | ${s.displayName || s.slug} | ${s.summary || ''} | ${s.badges?.join(',') || ''}`
      );
      return { content: [{ type: 'text', text: `DeskHub 技能 (${list.length})：\n\n${lines.join('\n')}` }] };
    }
  );

  server.tool(
    'get_deskhub_skill',
    '查看 DeskHub 技能详情',
    { slug: z.string().describe('技能 slug 标识') },
    async ({ slug }) => {
      const skill = await proxy.getDeskhubSkill(slug);
      if (!skill) {
        return { content: [{ type: 'text', text: `技能 ${slug} 不存在` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(skill, null, 2) }] };
    }
  );

  server.tool(
    'get_deskhub_versions',
    '查看 DeskHub 最近的技能版本更新',
    {
      since: z.string().optional().describe('起始日期 (YYYY-MM-DD)'),
      limit: z.number().optional().describe('返回数量限制'),
    },
    async ({ since, limit }) => {
      const query = {};
      if (since) query.since = since;
      if (limit) query.limit = limit;
      const versions = await proxy.getDeskhubVersions(query);

      if (!versions || (Array.isArray(versions) && versions.length === 0)) {
        return { content: [{ type: 'text', text: '暂无版本更新' }] };
      }

      return { content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }] };
    }
  );

  server.tool(
    'clear_deskhub_cache',
    '清除 DeskHub 数据缓存',
    {},
    async () => {
      proxy.clearDeskhubCache();
      return { content: [{ type: 'text', text: '缓存已清除' }] };
    }
  );
}
