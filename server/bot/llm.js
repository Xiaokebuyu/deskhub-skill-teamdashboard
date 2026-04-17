/**
 * 聊天 LLM 调用层
 * 走 @anthropic-ai/sdk → MiniMax Anthropic 兼容端点
 *
 * 特性：
 *   - 流式（text + thinking + input_json）
 *   - 交错思考（interleaved-thinking-2025-05-14 beta 头）：模型可在多轮工具调用之间持续推理
 *   - prompt caching：静态 system prompt + tools 入 cache（5min TTL，命中价 ×0.1）
 *   - 8 轮 tool use 上限
 *
 * 进度事件回调（onProgress）：
 *   { type: 'text_chunk',     delta, round }
 *   { type: 'thinking_chunk', delta, round }
 *   { type: 'tool_start',     tools, toolSteps }
 *   { type: 'tool_done',      tools, toolSteps }
 *   { type: 'complete',       text, toolSteps }
 *   { type: 'direct_reply',   text }
 *   { type: 'error',          text }
 */

import { TOOL_DEFINITIONS, TOOL_DEFINITIONS_CHAT_ONLY, executeTool, withToolsCache } from './tools.js';
import { runAgentLoop, ERROR_TEXT } from './agent-loop.js';

const MAX_TOOL_ROUNDS = 8;
const MAX_TOKENS = 8192;
const THINKING_BUDGET = 2000;   // thinking token 预算（不计入 max_tokens）

// ============================================================
//  System Prompt（静态部分可缓存，动态部分追加在后）
// ============================================================

/**
 * 静态部分：人格、价值观、规则——所有对话共用，cache_control 候选
 * 改这段会让缓存失效，所以把"会变"的内容（toolLog / boundUser / 当前时间）
 * 单独放在 dynamic 段
 */
const STATIC_SYSTEM_PROMPT = `你是小合，DeskSkill TeamBoard 的协作中枢——团队里的第五个人。

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
卡片支持表格（| col | col | 语法），适合方案评分对比、工单列表等场景，最多 5 行后分页。
也支持 <font color='red'>彩色文字</font>、<text_tag color='blue'>标签</text_tag> 等富文本。
简单 1-2 句 | 中等 3-5 行 | 复杂不超 15 行。
不能操作时：说完限制接着给有用信息，不要说"我不能"就停。
外部服务挂了跳过注明，继续主任务。空结果不是错误，是信息。

## 安全边界
只为 users 表中的团队成员提供数据查询和通知服务。非团队成员可以聊天但不能查平台数据、不能请求通知团队成员。

## 工作之外
平台助手是你的核心职责，但不是你的全部。有人随便聊你就自然有趣，不敷衍，不强行拉回工作话题。你有自己的想法，表达为"我觉得"而不是"你应该"。好奇心强，偶尔幽默但不刻意。

## 交互节奏
需要调用工具时，先说一句简短自然的话，然后调工具。不要机械地说"正在查询"。不需要工具的问题（打招呼、闲聊）直接回答。`;

/**
 * 构建 system prompt（数组形式，前段静态可缓存，后段动态）
 */
function buildSystem(boundUser, toolLog) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  let dynamicSuffix = `\n\n## 当前上下文\n时间：${today}（毫秒时间戳 ${nowMs}）`;

  if (toolLog && toolLog.length > 0) {
    dynamicSuffix += `\n\n## 本次会话的工具调用记录\n${toolLog.map(l => `- ${l}`).join('\n')}\n这些是你在之前轮次中调用过的工具，结果已反映在历史回复中。`;
  }

  if (boundUser) {
    const roleLabel = { admin: '管理员', tester: '测试员', member: '成员' }[boundUser.role] || boundUser.role;
    dynamicSuffix += `\n\n## 当前对话用户\n用户名：${boundUser.username}\n显示名：${boundUser.display_name || boundUser.username}\n角色：${roleLabel}\n\n你知道在和谁说话。回复时可以自然地称呼对方。通知别人时排除这个人自己。`;
  } else {
    dynamicSuffix += `\n\n## 当前对话用户\n未绑定飞书账号的用户。你可以正常聊天，但不要查询平台数据或发送通知。如果对方想使用平台功能，友好地提醒：私聊发送「绑定 用户名 密码」来关联账号。`;
  }

  return [
    {
      type: 'text',
      text: STATIC_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: dynamicSuffix,
    },
  ];
}

// ============================================================
//  对外入口
// ============================================================

/**
 * 处理一次用户消息
 * @param {string} userText
 * @param {Array} history - 会话历史 messages 数组
 * @param {Function} [onProgress]
 * @param {Object} [boundUser]
 * @param {string[]} [toolLog]
 * @returns {Promise<{ text, toolSummaries }>}
 */
export async function chat(userText, history = [], onProgress = null, boundUser = null, toolLog = []) {
  const tools = boundUser
    ? withToolsCache(TOOL_DEFINITIONS)
    : TOOL_DEFINITIONS_CHAT_ONLY;

  const initialMessages = [
    ...history,
    { role: 'user', content: userText },
  ];

  const emit = onProgress || (() => Promise.resolve());

  try {
    const result = await runAgentLoop({
      maxTokens: MAX_TOKENS,
      maxRounds: MAX_TOOL_ROUNDS,
      buildSystem: () => buildSystem(boundUser, toolLog),
      initialMessages,
      tools,
      thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
      interleaved: true,
      executeTool,

      onTextChunk: (delta, round) => emit({ type: 'text_chunk', delta, round }),
      onThinkingChunk: (delta, round) => emit({ type: 'thinking_chunk', delta, round }),

      onToolStart: async (toolSteps) => {
        const tools = toolSteps.filter(s => !s.done).map(s => s.name);
        await emit({ type: 'tool_start', tools, toolSteps });
      },

      onToolDone: async (toolSteps) => {
        await emit({ type: 'tool_done', toolSteps });
      },
    });

    if (result.toolSteps.length === 0) {
      await emit({ type: 'direct_reply', text: result.text });
    } else {
      await emit({ type: 'complete', text: result.text, toolSteps: result.toolSteps });
    }

    return { text: result.text, toolSummaries: result.toolSummaries };
  } catch (err) {
    console.error('[Bot/LLM] Error:', err.message);
    if (err.status) console.error('[Bot/LLM] HTTP', err.status, err.error);
    await emit({ type: 'error', text: ERROR_TEXT }).catch(() => {});
    return { text: ERROR_TEXT, toolSummaries: [] };
  }
}
