/**
 * 小合通知/巡检/中继代理
 * 走 SDK 流式（思考更深，cache_control 复用 tools）
 *
 * 三个入口：
 *   analyzeChanges(changes)       — 变更通知决策（返回 JSON）
 *   runPatrol()                    — 定时巡检（返回 JSON）
 *   handleXiaoheTask(msg, caller)  — MCP / 用户中继（返回纯文本）
 *
 * 共用底座 runAgentLoop()，每个入口只负责构建 prompt 和解析结果
 */

import { TOOL_DEFINITIONS, executeTool, withToolsCache } from './tools.js';
import { runAgentLoop } from './agent-loop.js';
import { beijingNowLine, formatBeijingNow } from '../utils/time.js';
import db from '../db/init.js';
import { loadUserMemoryByUsername, parseSegments } from './memory/index.js';
import { getPatrolConfigValue } from '../mcp/db-ops.js';

const MAX_TOOL_ROUNDS = Number(process.env.BOT_NOTIFY_MAX_ROUNDS) || 10;
const MAX_TOKENS = 4096;
const THINKING_BUDGET = 1500;

// ============================================================
//  System Prompts（按模式切换，每段最后用 cache_control 缓存）
// ============================================================

/**
 * 汇总本批变更涉及的所有 username，含：
 *   - actor（谁动的手）
 *   - 对应实体的 owner / uploader / tester（从 DB 反查）
 */
function collectAffectedUsernames(changes) {
  const set = new Set();
  for (const c of changes) {
    if (c.actor) set.add(c.actor);
    try {
      if (c.entityType === 'plan') {
        const p = db.prepare('SELECT owner FROM plans WHERE id = ?').get(c.entityId);
        if (p?.owner) set.add(p.owner);
      } else if (c.entityType === 'variant') {
        const v = db.prepare('SELECT uploader, plan_id FROM variants WHERE id = ?').get(c.entityId);
        if (v?.uploader) set.add(v.uploader);
        if (v?.plan_id) {
          const p = db.prepare('SELECT owner FROM plans WHERE id = ?').get(v.plan_id);
          if (p?.owner) set.add(p.owner);
        }
      } else if (c.entityType === 'score') {
        const s = db.prepare('SELECT tester, variant_id FROM scores WHERE id = ?').get(c.entityId);
        if (s?.tester) set.add(s.tester);
        if (s?.variant_id) {
          const v = db.prepare('SELECT uploader, plan_id FROM variants WHERE id = ?').get(s.variant_id);
          if (v?.uploader) set.add(v.uploader);
          if (v?.plan_id) {
            const p = db.prepare('SELECT owner FROM plans WHERE id = ?').get(v.plan_id);
            if (p?.owner) set.add(p.owner);
          }
        }
      }
    } catch { /* 实体可能已删除，忽略 */ }
  }
  return [...set];
}

/**
 * 为涉及的每位用户加载 memory 的 Public 段（群决策场景 → 不含 Private）
 */
async function loadAffectedMemorySnippets(usernames) {
  const parts = [];
  for (const u of usernames) {
    try {
      const raw = await loadUserMemoryByUsername(u);
      if (!raw?.trim()) continue;
      const segs = parseSegments(raw);
      if (segs.public.trim()) {
        parts.push(`### ${u}\n${segs.public.trim()}`);
      }
    } catch (err) {
      console.warn(`[Bot/Notify] 载入 ${u} memory 失败:`, err.message);
    }
  }
  return parts.join('\n\n');
}

async function buildNotifyPrompt(changes) {
  const changeList = changes.map(c =>
    `- [${c.priority}] ${c.action} | ${c.entityType}:${c.entityId} | ${c.summary} | actor: ${c.actor || '未知'}`
  ).join('\n');

  const affected = collectAffectedUsernames(changes);
  const memSnippet = await loadAffectedMemorySnippets(affected);

  const staticSystem = `你是小合，DeskSkill TeamBoard 的协作中枢。现在你收到一批工作台变更，需要决定通知策略。

## 通知原则
1. **永远不通知操作者本人**（actor 做的事不需要再告诉 actor）
2. 工单 owner 应该知道其工单的重要变更（新方案、评分、状态变化）
3. 方案 uploader 应该知道其方案的评分变化和工单定稿结果
4. 已评分 tester 应该知道工单的定稿结果
5. 低优先级的小编辑（改描述、备注）可以不通知
6. 同批多条关联变更合并成一条通知
7. 只能通知 users 表中的团队成员

## 你的工具
用 list_users 查所有团队成员。用 get_plan_detail 查工单详情（看 owner、uploader、tester）。
查完之后再做通知决策——不要猜，用工具确认。

## 消息风格
简短友好，1-3 句话。告诉对方「发生了什么」+「你可能需要做什么」。
好：「你负责的「PPT优化」有新方案提交了，目前共 3 个方案，可以安排评测了。」
好：「你提交的方案「NotebookLM」收到了新评分，均分 8.3，排名第一。」
坏：「系统通知：variant created on plan p5678。」

可以用 send_notification 工具直接发送私聊通知。

## 输出格式
最终用纯 JSON 输出（不要 markdown 包裹）：
{
  "group": { "send": true/false, "message": "群聊通知内容（markdown格式）" },
  "individuals": [{ "username": "xxx", "message": "私聊内容" }],
  "reasoning": "决策理由（调试用）"
}

如果这批变更不值得通知任何人：
{ "group": { "send": false }, "individuals": [], "reasoning": "..." }`;

  const memoryBlock = memSnippet
    ? `\n\n## 相关人员画像（从 memory 读取的 Public 段）\n${memSnippet}\n\n参考这些软信息做通知决策——如果某人的画像明确写了"不想被群里打扰"、"只要高优事项"等偏好，请尊重。`
    : '';

  const dynamic = `\n\n${beijingNowLine()}${memoryBlock}`;
  const userMsg = `以下是待处理的变更批次：\n\n${changeList}\n\n请分析这些变更，决定通知策略。先用工具查询相关工单详情和团队成员，再做决策；相关人员画像已在 system 里给出。`;

  return {
    system: [
      { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: dynamic },
    ],
    user: userMsg,
  };
}

/**
 * 预查本地 DB 里 deadline 临近或已逾期的活跃工单，喂给 LLM 做巡检决策。
 * 阈值走 patrol_config.deadline_alert_days（默认 3 天，可通过 update_patrol_config 动态改）。
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
  const d = new Date(`${ymd}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayDiffBeijing(fromYmd, toYmd) {
  const a = new Date(`${fromYmd}T00:00:00+08:00`).getTime();
  const b = new Date(`${toYmd}T00:00:00+08:00`).getTime();
  return Math.round((b - a) / (24 * 3600 * 1000));
}

function buildPatrolPrompt() {
  const alerts = queryDeadlineAlerts();
  const alertBlock = alerts.length === 0
    ? '（无临近或逾期工单）'
    : alerts.map(a =>
      `- [${a.priority}] ${a.name}（${a.id}）— ${a.tag}，负责人：${a.owner || '未指定'}，状态：${a.status}`
    ).join('\n');

  const staticSystem = `你是小合，DeskSkill TeamBoard 的协作中枢。现在是每日巡检时间，你需要扫描平台状态，发现异常。

## 巡检要点
用工具查询所有工单和团队成员，检查以下异常：
- 高优先级工单待开始超过 5 天
- **截止日期相关**：下方已预先附上 DB 查询结果，优先据此提醒相关负责人
- 评分全到齐，可以定稿（提醒管理员）
- 活跃工单只有 1 个方案（征集不够）
- 某方案提交超过 5 天没有评分
- 测试员负载不均（有人评了很多，有人没评）

## 输出格式
纯 JSON：
{
  "group": { "send": true/false, "message": "巡检摘要（markdown格式）" },
  "individuals": [{ "username": "xxx", "message": "针对此人的提醒" }],
  "reasoning": "巡检发现"
}

一切正常 → { "group": { "send": false }, "individuals": [], "reasoning": "无异常" }
只有值得关注的异常才通知。不要把正常状态当异常。`;

  const deadlineHint = `\n\n## 截止日期预警（DB 查询结果，北京时间 endOfDay）\n${alertBlock}`;

  return {
    system: [
      { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `\n\n${beijingNowLine()}${deadlineHint}` },
    ],
    user: '请执行每日巡检。先用工具查询所有工单状态和团队成员，然后分析是否有需要关注的异常；截止预警已在 system 里给出。',
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

function parseDecision(text) {
  let json = text.trim();

  // 去掉可能的 markdown 代码块包裹
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  try {
    const decision = JSON.parse(json);
    if (!decision.group) decision.group = { send: false };
    if (!Array.isArray(decision.individuals)) decision.individuals = [];
    return decision;
  } catch {
    console.error('[NotifyLLM] JSON 解析失败:', text.slice(0, 200));
    return null;
  }
}

// ============================================================
//  对外暴露
// ============================================================

export async function analyzeChanges(changes) {
  const { system, user } = await buildNotifyPrompt(changes);
  const raw = await runAgent(system, user);
  const decision = parseDecision(raw);

  if (decision) {
    console.log(`[NotifyLLM] 通知决策: group=${decision.group?.send}, individuals=${decision.individuals?.length}, reasoning=${decision.reasoning?.slice(0, 80)}`);
    return decision;
  }
  return fallbackNotify(changes);
}

export async function runPatrol() {
  const { system, user } = buildPatrolPrompt();
  const raw = await runAgent(system, user);
  const decision = parseDecision(raw);

  if (decision) {
    console.log(`[NotifyLLM] 巡检结果: group=${decision.group?.send}, individuals=${decision.individuals?.length}`);
    return decision;
  }
  return { group: { send: false }, individuals: [], reasoning: '巡检 LLM 解析失败' };
}

export async function handleXiaoheTask(message, callerUsername) {
  const system = buildRelayPrompt(callerUsername);
  const result = await runAgent(system, message);
  return result || '任务处理完成。';
}

/**
 * LLM 失败时的兜底通知
 */
export function fallbackNotify(changes) {
  const lines = changes.map(c => {
    const emoji = { created: '🆕', updated: '📝', status_changed: '🔄', deleted: '🗑️' }[c.action] || '📌';
    return `${emoji} ${c.summary}`;
  });

  return {
    group: { send: true, message: lines.join('\n') },
    individuals: [],
    reasoning: 'LLM 不可用，兜底模板',
  };
}
