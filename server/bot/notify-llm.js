/**
 * 小合巡检 + 中继代理
 *
 * 两个入口（2026-04-22 后不再做变更通知，整个变更通知管线废掉）：
 *   runPatrol()                    — 定时巡检，产钩子草案 JSON
 *   handleXiaoheTask(msg, caller)  — MCP 中继，返回纯文本
 *
 * 共用底座 runAgentLoop()。
 */

import { TOOL_DEFINITIONS, executeTool, withToolsCache } from './tools.js';
import { runAgentLoop } from './agent-loop.js';
import { beijingNowLine, formatBeijingNow } from '../utils/time.js';
import db from '../db/init.js';
import { getPatrolConfigValue } from '../mcp/db-ops.js';

const MAX_TOOL_ROUNDS = Number(process.env.BOT_NOTIFY_MAX_ROUNDS) || 10;
const MAX_TOKENS = 4096;
const THINKING_BUDGET = 1500;

// ============================================================
//  DB 预查：deadline 预警
// ============================================================

/**
 * 预查本地 DB 里 deadline 临近或已逾期的活跃工单，喂给 LLM 做巡检决策。
 * 阈值走 patrol_config.deadline_alert_days（默认 3）。
 * 北京时间 endOfDay 语义：YYYY-MM-DD 当天 23:59+08 之前都不算逾期。
 */
function queryDeadlineAlerts() {
  const { today } = formatBeijingNow();
  const alertDays = getPatrolConfigValue('deadline_alert_days') ?? 3;
  const threshold = addDaysBeijing(today, alertDays);
  const rows = db.prepare(`
    SELECT id, name, owner, deadline, priority, status
    FROM plans
    WHERE status IN ('next','active')
      AND deadline != ''
      AND deadline <= ?
    ORDER BY deadline ASC
  `).all(threshold);

  return rows.map(r => {
    const daysLeft = dayDiffBeijing(today, r.deadline);
    const tag = daysLeft < 0 ? `已逾期 ${-daysLeft} 天`
             : daysLeft === 0 ? '今日到期'
             : `剩 ${daysLeft} 天`;
    return { ...r, daysLeft, tag };
  });
}

function addDaysBeijing(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function dayDiffBeijing(fromYmd, toYmd) {
  const a = new Date(`${fromYmd}T00:00:00+08:00`).getTime();
  const b = new Date(`${toYmd}T00:00:00+08:00`).getTime();
  return Math.round((b - a) / (24 * 3600 * 1000));
}

// ============================================================
//  巡检 prompt：产钩子草案（不再产群/个人通知）
// ============================================================

function buildPatrolPrompt() {
  const alerts = queryDeadlineAlerts();
  const alertBlock = alerts.length === 0
    ? '（无临近或逾期工单）'
    : alerts.map(a =>
      `- [${a.priority}] ${a.name}（${a.id}）— ${a.tag}，负责人：${a.owner || '未指定'}，状态：${a.status}`
    ).join('\n');

  const staticSystem = `你是小合，DeskSkill TeamBoard 的协作中枢。现在是每日巡检时间。

## 巡检目标
扫描平台状态，把值得关注的异常转化为**通知钩子草案**。钩子由 admin 审批后才真发，所以你宁缺毋滥——不要硬凑异常。

## 你产出的格式
最终必须输出一段**严格 JSON**（不要 markdown 代码块包裹）：

{
  "hooks": [
    {
      "target_user": "被提醒人的 username",
      "fire_at": "触发时间 ISO 8601 带 +08:00（如 2026-04-25T09:00:00+08:00）",
      "message": "给对方的消息正文，简短友好有上下文",
      "plan_id": "关联工单 id（可选）"
    }
  ],
  "reasoning": "巡检发现（一句话说 N 条草案的背景）"
}

如无任何异常：
{ "hooks": [], "reasoning": "今日无异常" }

## 应当产钩子草案的异常类型
1. **deadline 临近** ≤ 3 天或已逾期 —— 下方已预查好列表，优先覆盖这些
2. **高优先级工单待开始超过 5 天** —— 提醒 owner
3. **活跃工单只有 1 个方案** —— 提醒 owner"征集方案"
4. **某方案提交超过 5 天没有评分** —— 提醒 tester
5. **所有评分到齐，可以定稿** —— 提醒 admin

## fire_at 策略
- deadline 相关：前 1 天上午 09:00+08:00（deadline 已过或今天到期 → 明天 09:00）
- 其他异常：次日 09:00+08:00（不要今天下午或更早）

## message 风格
简短、具体、友好。好：「李四，你负责的「知识库重构」明天到期，有空推进一下。」
坏：「系统通知：plan_id=p042 deadline approaching.」

## 你可以用的工具
先用 list_plans / get_plan_detail / list_users 查情况，再产 hooks。

**重要约束**：你**不**直接调 propose_notification_hook，也**不**发 send_notification。你只输出 JSON 让调度器逐条入库；admin 会收到一条汇总卡统一审批。`;

  const deadlineHint = `\n\n## DB 预查：deadline 预警（北京时间 endOfDay）\n${alertBlock}`;

  return {
    system: [
      { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `\n\n${beijingNowLine()}${deadlineHint}` },
    ],
    user: '请执行每日巡检。先用工具查询状态，再按异常类型产钩子草案，最后输出 JSON。',
  };
}

function buildRelayPrompt(callerUsername) {
  const staticSystem = `你是小合，DeskSkill TeamBoard 的协作中枢。

你收到了一个任务请求。理解意图后执行：
- 如果是通知某人 → 用工具查上下文，然后用 send_notification 发送个性化消息
- 如果是查询数据 → 用工具查询并返回结果
- 只能通知 users 表中的团队成员
- 不修改平台数据

消息风格：简短友好，带上下文。不是原封转发，而是理解后组织。
比如调用者说"通知测试员开始评测"，你应该先查有哪些待评测的工单，再给测试员发具体内容。

直接回复执行结果。`;

  return [
    { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `\n\n${beijingNowLine()}\n调用者：${callerUsername}` },
  ];
}

// ============================================================
//  跑一次 agent，返回纯文本
// ============================================================

async function runAgent(system, userMessage) {
  const result = await runAgentLoop({
    maxTokens: MAX_TOKENS,
    maxRounds: MAX_TOOL_ROUNDS,
    buildSystem: () => system,
    initialMessages: [{ role: 'user', content: userMessage }],
    tools: withToolsCache(TOOL_DEFINITIONS),
    thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
    interleaved: true,
    executeTool,
  });
  return result.text;
}

// ============================================================
//  解析 LLM JSON 输出
// ============================================================

function parsePatrolOutput(text) {
  let json = text.trim();
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  try {
    const out = JSON.parse(json);
    if (!Array.isArray(out.hooks)) out.hooks = [];
    if (typeof out.reasoning !== 'string') out.reasoning = '';
    return out;
  } catch {
    console.error('[NotifyLLM] 巡检 JSON 解析失败:', text.slice(0, 200));
    return null;
  }
}

// ============================================================
//  对外暴露
// ============================================================

/**
 * 跑一次每日巡检，返回 { hooks: [{target_user, fire_at, message, plan_id?}], reasoning }
 * 调用方（patrol.js）负责逐条 proposeHook 并 DM admin 汇总
 */
export async function runPatrol() {
  const { system, user } = buildPatrolPrompt();
  const raw = await runAgent(system, user);
  const out = parsePatrolOutput(raw);

  if (out) {
    console.log(`[NotifyLLM] 巡检产出 ${out.hooks.length} 条钩子草案：${out.reasoning.slice(0, 80)}`);
    return out;
  }
  return { hooks: [], reasoning: '巡检 LLM 解析失败' };
}

export async function handleXiaoheTask(message, callerUsername) {
  const system = buildRelayPrompt(callerUsername);
  const result = await runAgent(system, message);
  return result || '任务处理完成。';
}
