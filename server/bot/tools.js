/**
 * 飞书机器人工具层
 * 9 个只读工具定义 + 执行器，复用 db-ops / proxy-ops
 */

import {
  listPlans, getPlanDetail, getDimensions, listUsers, getRecentChanges,
} from '../mcp/db-ops.js';
import {
  listDeskhubSkills, getDeskhubSkill,
  getUmamiStats, getUmamiActive,
} from '../mcp/proxy-ops.js';

// ── 工具定义（Anthropic / MiniMax 兼容格式）──

export const TOOL_DEFINITIONS = [
  {
    name: 'list_plans',
    description: '查询工单列表。可按类型(skill/mcp)和状态(next/active/done)筛选。返回工单名称、状态、优先级、方案数等概览信息。',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['skill', 'mcp'], description: '工单类型筛选' },
        status: { type: 'string', enum: ['next', 'active', 'done'], description: '工单状态筛选' },
      },
    },
  },
  {
    name: 'get_plan_detail',
    description: '查询单个工单的完整详情，包括所有方案、各维度评分、当前阶段(征集方案/评测中/待定稿)。需要提供 plan_id。',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: '工单 ID，如 p1234abcd' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'get_dimensions',
    description: '查看当前所有评分维度（评估标准），包括维度名称和满分值。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_deskhub_skills',
    description: '查询 DeskHub 上已发布的技能列表。可按关键词搜索，返回技能名称、描述、状态等信息。',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '返回数量限制' },
      },
    },
  },
  {
    name: 'get_deskhub_skill',
    description: '查询 DeskHub 上某个技能的详细信息。需要提供技能的 slug（唯一标识）。',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: '技能 slug，如 ppt-generator' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_umami_stats',
    description: '查询网站访问统计数据（访问量、用户数、跳出率等）。需要指定时间范围，单位为毫秒时间戳。',
    input_schema: {
      type: 'object',
      properties: {
        start_at: { type: 'number', description: '开始时间（毫秒时间戳）' },
        end_at: { type: 'number', description: '结束时间（毫秒时间戳）' },
      },
      required: ['start_at', 'end_at'],
    },
  },
  {
    name: 'get_umami_active',
    description: '查询当前网站在线活跃用户数。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_users',
    description: '查询系统中的所有团队成员，包括用户名、角色（管理员/测试员/成员）和显示名。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_changes',
    description: '查询最近的工作台变更记录（新建工单、新增方案、提交评分、状态变更等）。',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回数量，默认 20' },
      },
    },
  },
];

// ── 工具执行器 ──

export async function executeTool(name, input = {}) {
  switch (name) {
    case 'list_plans':
      return listPlans({ type: input.type, status: input.status });

    case 'get_plan_detail':
      return getPlanDetail(input.plan_id);

    case 'get_dimensions':
      return getDimensions();

    case 'list_deskhub_skills': {
      const query = {};
      if (input.search) query.search = input.search;
      if (input.limit) query.limit = String(input.limit);
      return listDeskhubSkills(query);
    }

    case 'get_deskhub_skill':
      return getDeskhubSkill(input.slug);

    case 'get_umami_stats':
      return getUmamiStats(input.start_at, input.end_at);

    case 'get_umami_active':
      return getUmamiActive();

    case 'list_users':
      return listUsers();

    case 'get_recent_changes':
      return getRecentChanges(input.limit || 20);

    default:
      throw new Error(`未知工具: ${name}`);
  }
}
