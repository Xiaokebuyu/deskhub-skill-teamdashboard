import { z } from 'zod';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

export function registerVariantTools(server, auth) {
  server.tool(
    'add_variant',
    '给工单提交一个新方案。需要管理员或测试员权限。',
    {
      plan_id: z.string().describe('工单 ID'),
      name: z.string().describe('方案名称'),
      uploader: z.string().optional().describe('提交人（不填则使用当前用户）'),
      desc: z.string().default('').describe('方案描述'),
      link: z.string().default('').describe('外部链接（文档/仓库）'),
      content: z.string().optional().describe('Markdown 格式的方案文档内容'),
    },
    async ({ plan_id, uploader, ...fields }) => {
      assertRole(auth, 'admin', 'tester');
      const actualUploader = uploader || auth.username;
      const variant = ops.addVariant(plan_id, { ...fields, uploader: actualUploader });
      return { content: [{ type: 'text', text: `方案已提交\nID: ${variant.id}\n名称: ${variant.name}\n提交人: ${variant.uploader}\n所属工单: ${plan_id}` }] };
    }
  );

  server.tool(
    'edit_variant',
    '编辑方案信息（名称、描述、链接、内容）。管理员可编辑任何方案，测试员只能编辑自己的。',
    {
      variant_id: z.string().describe('方案 ID'),
      name: z.string().optional().describe('新名称'),
      desc: z.string().optional().describe('新描述'),
      link: z.string().optional().describe('新链接'),
      content: z.string().optional().describe('新 Markdown 内容'),
    },
    async ({ variant_id, ...fields }) => {
      assertRole(auth, 'admin', 'tester');
      if (auth.role !== 'admin') {
        const detail = ops.getPlanDetail_variant(variant_id);
        if (detail && detail.uploader !== auth.username) {
          throw new Error('只能编辑自己的方案');
        }
      }
      ops.editVariant(variant_id, fields);
      return { content: [{ type: 'text', text: `方案 ${variant_id} 已更新` }] };
    }
  );

  server.tool(
    'delete_variant',
    '删除一个方案（同时删除其评分记录）。管理员可删除任何方案，测试员只能删除自己的未评分方案。',
    { variant_id: z.string().describe('方案 ID') },
    async ({ variant_id }) => {
      assertRole(auth, 'admin', 'tester');
      if (auth.role !== 'admin') {
        const detail = ops.getPlanDetail_variant(variant_id);
        if (detail && detail.uploader !== auth.username) {
          throw new Error('只能删除自己的方案');
        }
        // 非 admin：方案已有评分则不可删除
        const hasScores = ops.variantHasScores(variant_id);
        if (hasScores) {
          throw new Error('方案已有评分，无法删除');
        }
      }
      ops.deleteVariant(variant_id);
      return { content: [{ type: 'text', text: `方案 ${variant_id} 已删除` }] };
    }
  );
}
