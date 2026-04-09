import { z } from 'zod';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

export function registerPlanTools(server, auth) {
  server.tool(
    'create_plan',
    '创建新工单（技能迭代或 MCP 开发计划）。需要管理员权限。',
    {
      name: z.string().describe('工单名称'),
      type: z.enum(['skill', 'mcp']).describe('类型：skill 或 mcp'),
      priority: z.enum(['high', 'medium', 'low']).default('medium').describe('优先级'),
      desc: z.string().default('').describe('描述'),
      status: z.enum(['next', 'active']).default('next').describe('初始状态'),
      owner: z.string().default('').describe('负责人'),
      deadline: z.string().default('').describe('截止日期'),
    },
    async (args) => {
      assertRole(auth, 'admin');
      const plan = ops.createPlan(args);
      return { content: [{ type: 'text', text: `工单已创建\nID: ${plan.id}\n名称: ${plan.name}\n类型: ${plan.type}\n状态: ${plan.status}\n优先级: ${plan.priority}` }] };
    }
  );

  server.tool(
    'edit_plan',
    '编辑工单信息（名称、优先级、描述、负责人、截止日期）。需要管理员权限。',
    {
      plan_id: z.string().describe('工单 ID'),
      name: z.string().optional().describe('新名称'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('新优先级'),
      desc: z.string().optional().describe('新描述'),
      owner: z.string().optional().describe('新负责人'),
      deadline: z.string().optional().describe('新截止日期'),
    },
    async ({ plan_id, ...fields }) => {
      assertRole(auth, 'admin');
      ops.editPlan(plan_id, fields);
      return { content: [{ type: 'text', text: `工单 ${plan_id} 已更新` }] };
    }
  );

  server.tool(
    'delete_plan',
    '删除工单（同时删除其下所有方案和评分）。需要管理员权限。',
    { plan_id: z.string().describe('工单 ID') },
    async ({ plan_id }) => {
      assertRole(auth, 'admin');
      ops.deletePlan(plan_id);
      return { content: [{ type: 'text', text: `工单 ${plan_id} 已删除` }] };
    }
  );

  server.tool(
    'activate_plan',
    '激活工单：将"待开始"的工单移入"进行中"。需要管理员权限。',
    { plan_id: z.string().describe('工单 ID') },
    async ({ plan_id }) => {
      assertRole(auth, 'admin');
      ops.updatePlanStatus(plan_id, 'active');
      return { content: [{ type: 'text', text: `工单 ${plan_id} 已激活，进入进行中状态` }] };
    }
  );

  server.tool(
    'complete_plan',
    '定稿工单：标记为已完成，需指定结果（采纳或搁置）。需要管理员权限。',
    {
      plan_id: z.string().describe('工单 ID'),
      result: z.enum(['adopted', 'shelved']).describe('结果：adopted（采纳）或 shelved（搁置）'),
    },
    async ({ plan_id, result }) => {
      assertRole(auth, 'admin');
      ops.updatePlanStatus(plan_id, 'done', result);
      const label = result === 'adopted' ? '采纳' : '搁置';
      return { content: [{ type: 'text', text: `工单 ${plan_id} 已定稿，结果：${label}` }] };
    }
  );

  server.tool(
    'reopen_plan',
    '重新打开已完成的工单，恢复为进行中状态。需要管理员权限。',
    { plan_id: z.string().describe('工单 ID') },
    async ({ plan_id }) => {
      assertRole(auth, 'admin');
      ops.updatePlanStatus(plan_id, 'active');
      return { content: [{ type: 'text', text: `工单 ${plan_id} 已重新打开` }] };
    }
  );
}
