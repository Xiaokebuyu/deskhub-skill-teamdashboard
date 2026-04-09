import { z } from 'zod';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

export function registerDimensionTools(server, auth) {
  server.tool(
    'create_dimension',
    '新增评测维度。需要管理员权限。',
    {
      name: z.string().describe('维度名称'),
      max: z.number().default(10).describe('满分值（默认 10）'),
    },
    async ({ name, max }) => {
      assertRole(auth, 'admin');
      const dim = ops.createDimension({ name, max });
      return { content: [{ type: 'text', text: `维度已创建\nID: ${dim.id}\n名称: ${dim.name}\n满分: ${dim.max}` }] };
    }
  );

  server.tool(
    'edit_dimension',
    '编辑评测维度（修改名称、满分、启停状态）。需要管理员权限。',
    {
      dimension_id: z.string().describe('维度 ID'),
      name: z.string().optional().describe('新名称'),
      max: z.number().optional().describe('新满分值'),
      active: z.boolean().optional().describe('是否启用'),
    },
    async ({ dimension_id, ...fields }) => {
      assertRole(auth, 'admin');
      ops.editDimension(dimension_id, fields);
      return { content: [{ type: 'text', text: `维度 ${dimension_id} 已更新` }] };
    }
  );

  server.tool(
    'delete_dimension',
    '删除评测维度（软删除，标记为不活跃）。需要管理员权限。',
    { dimension_id: z.string().describe('维度 ID') },
    async ({ dimension_id }) => {
      assertRole(auth, 'admin');
      ops.deleteDimension(dimension_id);
      return { content: [{ type: 'text', text: `维度 ${dimension_id} 已删除` }] };
    }
  );
}
