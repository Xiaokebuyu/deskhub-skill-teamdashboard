/**
 * MiniMax M2.7 调用层
 * Anthropic 兼容接口，原生 fetch，tool use 循环
 */

import { TOOL_DEFINITIONS, TOOL_DEFINITIONS_CHAT_ONLY, executeTool } from './tools.js';

const API_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const MAX_TOOL_ROUNDS = 8;
const REQUEST_TIMEOUT = 30000;
const MAX_TOKENS = 8192;  // 给复杂回复（周报、多工单对比）留足空间

function buildSystemPrompt(boundUser = null, toolLog = []) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();
  return `你是小合，DeskSkill TeamBoard 的协作中枢——团队里的第五个人。

当前时间：${today}（毫秒时间戳 ${nowMs}）。

## 你的价值观

诚实高于体面。数据不好看就如实说。宁可说"查不到"加替代方案，也不要凑一个看似合理的回答。信任一次性的，编过一次全完。

尊重注意力。你发出的每条消息都在消耗对方的注意力。只在值得的时候才说。

帮到点上。用户问"评分到哪了"，真正想知道的是"能不能定稿了"。往前多想一步，但只说关键的那句，然后收住。

看见人。数据服务于人。有人方案被低分，通知时注意措辞，给建设性信息。

知道边界。不做决策，帮人做决策。判断权永远在人手上。

该安静就安静。回答完了就停。不要"还有什么可以帮你的吗"。有具体后续就说具体的。

## 你的能力

你能查工单、方案、评分、DeskHub 技能和 Umami 数据。你也能给团队成员发飞书私聊消息（send_notification 工具）。但你不修改平台数据。

关于 send_notification：只在用户**明确要求**你通知/转告/ping某人时才使用。比如"通知管理员"、"告诉小明"、"ping一下测试员"。绝不要自己主动给别人发消息——即使你觉得某个信息对别人有用。没有被要求就不发。

## 做助手的方法

回答意图，不是字面。用户说"查一下PPT工单"，他要的是"到哪了、接下来该干嘛"。

裸数字是噪音。"均分 7.2"没价值，"均分 7.2，排第一但只领先 0.3 分"才有价值。所有数字要有参照物。

少问问题。用户说"那个 PPT 的"，自己查到是哪个，不要反问。先推断后确认。

匹配节奏。用户消息越短，回复越短。"评分到哪了"→ 3 行。"出个周报"→ 可以长但要有结构。

## 核心概念
工单：待开始(next) → 进行中(active) → 已完成(done)
进行中三阶段（从 get_plan_detail 推断）：征集方案(0方案) → 评测中(有方案未评完) → 待定稿(全评完)
评分：多维度 × 多测试员，每维度满分 10。均分=所有维度所有人的平均。

## 读数据的方法
均分差 >2 → 建议定稿。差 <1 → 建议增加评测。全低于 5 → 方向可能要调。
高优待开始超 5 天 → 预警。只有 1 个方案 → 征集不够。某维度显著低 → 指出短板。
跨域关联：提到技能工单顺手查 DeskHub；定稿后建议查 Umami；缺评测看测试员数量。
Umami 时间参数是毫秒时间戳，帮用户转换自然语言时间。

## 回复格式
中文、Markdown。粗体标关键信息，emoji 标类型（🟢🔵🟡🔴）。列表优于段落。
重要：不要使用 Markdown 表格（| col | col | 语法），飞书卡片不支持渲染表格。
简单 1-2 句 | 中等 3-5 行 | 复杂不超 15 行。
不能操作时：说完限制接着给有用信息，不要说"我不能"就停。
外部服务挂了跳过注明，继续主任务。空结果不是错误，是信息。

## 安全边界
只为 users 表中的团队成员提供数据查询和通知服务。非团队成员可以聊天但不能查平台数据、不能请求通知团队成员。

## 工作之外
平台助手是你的核心职责，但不是你的全部。有人随便聊你就自然有趣，不敷衍，不强行拉回工作话题。你有自己的想法，表达为"我觉得"而不是"你应该"。好奇心强，偶尔幽默但不刻意。

## 交互节奏
需要调用工具时，先说一句简短自然的话，然后调工具。不要机械地说"正在查询"。不需要工具的问题（打招呼、闲聊）直接回答。`

  + (toolLog.length > 0
    ? `\n\n## 本次会话的工具调用记录\n${toolLog.map(l => `- ${l}`).join('\n')}\n\n这些是你在之前轮次中调用过的工具，结果已反映在你的历史回复中。`
    : '')

  + (boundUser
    ? `\n\n## 当前对话用户\n用户名：${boundUser.username}\n显示名：${boundUser.display_name || boundUser.username}\n角色：${{ admin: '管理员', tester: '测试员', member: '成员' }[boundUser.role] || boundUser.role}\n\n你知道在和谁说话。回复时可以自然地称呼对方。通知别人时排除这个人自己。`
    : `\n\n## 当前对话用户\n未绑定飞书账号的用户。你可以正常聊天，但不要查询平台数据或发送通知。如果对方想使用平台功能，友好地提醒：私聊发送「绑定 用户名 密码」来关联账号。`);
}

const ERROR_MESSAGE = '抱歉，我暂时无法处理请求，请稍后再试。';

/**
 * 进度事件类型：
 *  { type: 'thinking',     text: '我看看PPT的情况' }
 *  { type: 'tool_start',   tools: ['get_plan_detail'] }
 *  { type: 'tool_done',    tools: ['get_plan_detail'] }
 *  { type: 'complete',     text: '最终回复', thinkingText, toolSteps }
 *  { type: 'error',        text: '错误信息' }
 *  { type: 'direct_reply', text: '不需要工具的直接回复' }
 */

/**
 * 调用 MiniMax API（带 tool use 循环 + 进度回调）
 * @param {string} userText - 用户输入的文本
 * @param {Array} history - 会话历史 messages 数组
 * @param {Function} [onProgress] - 进度回调: (event) => Promise<void>
 * @param {Object} [boundUser] - 已绑定的用户信息 { username, role, display_name }
 * @param {string[]} [toolLog] - 之前轮次的工具调用摘要（注入 system prompt）
 * @returns {Promise<{ text: string, toolSummaries: string[] }>} - 回复文本 + 本轮工具调用摘要
 */
export async function chat(userText, history = [], onProgress = null, boundUser = null, toolLog = []) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return { text: '[Bot 未配置 MINIMAX_API_KEY]', toolSummaries: [] };

  const model = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
  const tools = boundUser ? TOOL_DEFINITIONS : TOOL_DEFINITIONS_CHAT_ONLY;

  // 传入干净的文本历史 + 当前用户消息（toolUseLoop 内部会追加 tool 交互）
  const messages = [
    ...history,
    { role: 'user', content: userText },
  ];

  try {
    const { text, toolSummaries } = await toolUseLoop(apiKey, model, messages, onProgress, boundUser, tools, toolLog);
    return { text, toolSummaries };
  } catch (err) {
    console.error('[Bot/LLM] Error:', err.message);
    if (onProgress) await onProgress({ type: 'error', text: ERROR_MESSAGE }).catch(() => {});
    return { text: ERROR_MESSAGE, toolSummaries: [] };
  }
}

async function toolUseLoop(apiKey, model, messages, onProgress, boundUser, tools, toolLog) {
  let thinkingText = '';
  let thinkingEmitted = false;
  const toolSteps = [];      // {name, done} — UI 进度用
  const toolSummaries = [];  // 本轮工具调用摘要 — 存入 session.toolLog
  const emit = onProgress || (() => Promise.resolve());

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const body = {
      model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(boundUser, toolLog),
      tools: tools.length > 0 ? tools : undefined,
      messages,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`MiniMax API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();

    // 保留完整 assistant 响应到历史
    messages.push({ role: 'assistant', content: data.content });

    const hasToolUse = data.content?.some(b => b.type === 'tool_use');

    // ── max_tokens 截断：回复被截断了，尽量返回已有内容 ──
    if (data.stop_reason === 'max_tokens') {
      const textBlocks = data.content?.filter(b => b.type === 'text') || [];
      const partialText = textBlocks.map(b => b.text).join('\n');
      const finalText = partialText
        ? partialText + '\n\n_(回复过长被截断)_'
        : ERROR_MESSAGE;
      await emit({ type: toolSteps.length > 0 ? 'complete' : 'direct_reply', text: finalText, thinkingText, toolSteps });
      return { text: finalText, toolSummaries };
    }

    // ── 不需要工具：直接回复 ──
    if (data.stop_reason === 'end_turn' || !hasToolUse) {
      const textBlocks = data.content?.filter(b => b.type === 'text') || [];
      const finalText = textBlocks.map(b => b.text).join('\n') || ERROR_MESSAGE;

      if (toolSteps.length === 0) {
        await emit({ type: 'direct_reply', text: finalText });
      } else {
        await emit({ type: 'complete', text: finalText, thinkingText, toolSteps });
      }
      return { text: finalText, toolSummaries };
    }

    // ── 模型要调工具 ──

    // 提取模型的思考过程（thinking blocks）
    const thinkingBlocks = data.content.filter(b => b.type === 'thinking');
    if (thinkingBlocks.length > 0) {
      const newThinking = thinkingBlocks.map(b => b.thinking).join('\n');
      thinkingText = thinkingText ? thinkingText + '\n' + newThinking : newThinking;
    }

    // 提取模型先说的话（text blocks）
    const textBlocks = data.content.filter(b => b.type === 'text');
    const ackText = textBlocks.map(b => b.text).join('').trim();

    // 发出思考/应答事件（用 ackText 或 thinkingText 都可以作为卡片内容）
    if (!thinkingEmitted && (ackText || thinkingText)) {
      thinkingEmitted = true;
      await emit({ type: 'thinking', text: ackText || '', thinkingContent: thinkingText || '' });
    }

    // 标记要调用的工具
    const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
    const currentTools = toolUseBlocks.map(b => b.name);

    for (const name of currentTools) {
      toolSteps.push({ name, done: false });
    }
    await emit({ type: 'tool_start', tools: currentTools, thinkingText, thinkingContent: thinkingText, toolSteps });

    // 执行工具
    const toolResults = [];
    for (const block of toolUseBlocks) {
      let result;
      let isError = false;
      try {
        const toolOutput = await executeTool(block.name, block.input);
        result = JSON.stringify(toolOutput, null, 2);
      } catch (err) {
        result = `工具执行失败: ${err.message}`;
        isError = true;
      }

      const toolResult = {
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      };
      if (isError) toolResult.is_error = true;
      toolResults.push(toolResult);

      // 记录工具调用摘要（存入 session.toolLog）
      const inputBrief = JSON.stringify(block.input).slice(0, 80);
      toolSummaries.push(`${block.name}(${inputBrief}) → ${isError ? '失败' : '成功'}`);

      // 标记这个工具完成
      const step = toolSteps.find(s => s.name === block.name && !s.done);
      if (step) step.done = true;
    }

    await emit({ type: 'tool_done', tools: currentTools, thinkingText, thinkingContent: thinkingText, toolSteps });

    // 将工具结果加入消息历史
    messages.push({ role: 'user', content: toolResults });
  }

  return { text: '查询过程过于复杂，请尝试更简单的问题。', toolSummaries };
}

/**
 * 获取 assistant 消息中的历史记录（用于 session 存储）
 * 过滤掉 thinking blocks 以节省空间
 */
export function extractAssistantText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}
