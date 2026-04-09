import { z } from 'zod';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

export function registerScoreTools(server, auth) {
  server.tool(
    'submit_scores',
    '对方案进行多维度打分。需要管理员或测试员权限。',
    {
      variant_id: z.string().describe('方案 ID'),
      tester: z.string().optional().describe('测试员名称（不填则使用当前用户）'),
      scores: z.array(z.object({
        dim_id: z.string().describe('维度 ID'),
        value: z.number().describe('分值'),
        comment: z.string().default('').describe('评语'),
      })).describe('各维度评分列表'),
      eval_doc: z.string().optional().describe('评测文档路径'),
    },
    async ({ variant_id, tester, scores, eval_doc }) => {
      assertRole(auth, 'admin', 'tester');
      const actualTester = tester || auth.username;
      const created = ops.submitScores(variant_id, { tester: actualTester, scores, evalDoc: eval_doc ?? null });
      return { content: [{ type: 'text', text: `评分已提交\n方案: ${variant_id}\n测试员: ${actualTester}\n评分维度数: ${scores.length}\n评分ID: ${created.map(s => s.id).join(', ')}` }] };
    }
  );

  server.tool(
    'edit_score',
    '编辑单条评分（修改分值、评语、评测文档）。管理员可编辑任何评分，测试员只能编辑自己的。',
    {
      score_id: z.string().describe('评分 ID'),
      value: z.number().optional().describe('新分值'),
      comment: z.string().optional().describe('新评语'),
      eval_doc: z.string().optional().describe('新评测文档路径'),
    },
    async ({ score_id, ...fields }) => {
      assertRole(auth, 'admin', 'tester');
      if (auth.role !== 'admin') {
        const score = ops.getScoreOwner(score_id);
        if (score && score.tester !== auth.username) {
          throw new Error('只能编辑自己的评分');
        }
      }
      ops.editScore(score_id, { value: fields.value, comment: fields.comment, evalDoc: fields.eval_doc });
      return { content: [{ type: 'text', text: `评分 ${score_id} 已更新` }] };
    }
  );

  server.tool(
    'delete_score',
    '删除单条评分记录。管理员可删除任何评分，测试员只能删除自己的。',
    { score_id: z.string().describe('评分 ID') },
    async ({ score_id }) => {
      assertRole(auth, 'admin', 'tester');
      if (auth.role !== 'admin') {
        const score = ops.getScoreOwner(score_id);
        if (score && score.tester !== auth.username) {
          throw new Error('只能删除自己的评分');
        }
      }
      ops.deleteScore(score_id);
      return { content: [{ type: 'text', text: `评分 ${score_id} 已删除` }] };
    }
  );
}
