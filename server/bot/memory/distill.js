/**
 * Session 蒸馏：session TTL 过期时，把聊天上下文里"值得长期记"的抽象信息
 * 提炼进 user memory。独立 LLM 调用，只提供 memory tool。
 *
 * 设计要点：
 *   - 不走 agent-loop 的流式 / 思考，只跑一个短 agent（≤3 轮）
 *   - 只给 3 个 memory tool（update_memory_section / append_memory_note / forget_memory_section）
 *   - 失败不阻塞 session 清理；memory 是"尽力而为"
 *   - prompt 明确：只抓画像/偏好/协作方式，事实去查 DB，聊天记录不要整段塞进来
 */

import { client, DEFAULT_MODEL } from '../anthropic-client.js';
import { runAgentLoop } from '../agent-loop.js';
import { executeTool, TOOL_DEFINITIONS, withToolsCache } from '../tools.js';
import { beijingNowLine } from '../../utils/time.js';
import { getUserByOpenId } from '../../mcp/db-ops.js';
import { loadUserMemory } from './index.js';

const DISTILL_MAX_ROUNDS = Number(process.env.BOT_DISTILL_MAX_ROUNDS) || 3;
const DISTILL_MAX_TOKENS = 2048;
// 蒸馏输入截断：只取最后 N 条 session 消息。session.js MAX_ROUNDS=50（100 条），
// 全部 concat 成 transcript 可能几十 KB，成本 / 蒸馏质量都退化。取尾部够捕捉近期画像。
const DISTILL_MAX_INPUT_MESSAGES = 40;

// 仅白名单 memory 工具
const MEMORY_TOOL_NAMES = new Set([
  'update_memory_section',
  'append_memory_note',
  'forget_memory_section',
]);

function buildDistillPrompt(openId, boundUser, existingMemory) {
  const whoLine = boundUser
    ? `用户名：${boundUser.username}（${boundUser.display_name || boundUser.username}，${boundUser.role}）`
    : `未绑定用户（openId ${openId}）`;

  const memSnippet = existingMemory?.trim()
    ? `## 现有记忆（参考避免重复）\n${existingMemory.trim()}`
    : `## 现有记忆\n（空——第一次蒸馏）`;

  return `你是小合的记忆蒸馏器。下面是刚刚结束的一轮对话历史，它即将被遗忘。你需要判断有没有值得长期记住的**软信息**，用 memory 工具落地。

## 当前用户
${whoLine}

${memSnippet}

## ${beijingNowLine()}

## 蒸馏原则
1. **只记软信息**：画像、偏好、协作方式、兴趣、长期关注点、通知习惯
2. **不记事实数据**：具体工单 ID / 评分数值 / 方案名称（这些会变，去 DB 查即可）
3. **不记聊天转录**：不要把对话原文塞进 memory
4. **已记的不要重复**：如果现有记忆里已经有同样的内容，跳过
5. **有价值再调工具**：如果这轮对话只是闲聊/临时查询，没有画像增量 → **直接返回"无需更新"文本，什么工具都别调**
6. **隐私敏感内容走 private**：用户明说"别告诉别人"、"私下讨论" → 用 segment: 'private'
7. 记忆条目尽量短（≤50 字/段），关键词化而非叙述化

## 可用工具
- update_memory_section(section, content, segment) — 替换或新增命名段
- append_memory_note(note, segment) — 追加一行日期笔记
- forget_memory_section(section) — 删除已过时的段

完成后用一句话说明你做了什么（或"无需更新"），不要分析对话细节。`;
}

/**
 * 对一个即将过期的 session 做蒸馏
 * @param {string} openId
 * @param {Array} messages - session.messages（user/assistant 文本对）
 * @returns {Promise<{ text: string, toolSteps: Array, skipped?: boolean }>}
 */
export async function distillSession(openId, messages) {
  if (!Array.isArray(messages) || messages.length < 2) {
    return { text: '无对话可蒸馏', skipped: true, toolSteps: [] };
  }

  const boundUser = getUserByOpenId(openId) || null;
  let existingMemory = '';
  try {
    const mem = await loadUserMemory(openId, boundUser);
    existingMemory = mem.content;
  } catch (err) {
    console.warn('[Bot/Distill] load existing memory failed:', err.message);
  }

  const system = buildDistillPrompt(openId, boundUser, existingMemory);

  // 把对话压成一段文本作为 user message（不让 LLM 误以为在继续对话）
  const tail = messages.slice(-DISTILL_MAX_INPUT_MESSAGES);
  const transcript = tail.map((m) => {
    const role = m.role === 'user' ? '用户' : '小合';
    const text = Array.isArray(m.content)
      ? m.content.filter(b => b.type === 'text').map(b => b.text).join(' ')
      : String(m.content || '');
    return `${role}：${text}`;
  }).join('\n');
  const truncatedNote = messages.length > tail.length
    ? `（为控制 token，仅展示最近 ${tail.length}/${messages.length} 条消息）\n\n`
    : '';

  // 只暴露 memory 工具
  const memoryTools = TOOL_DEFINITIONS.filter(t => MEMORY_TOOL_NAMES.has(t.name));

  const distillResult = await runAgentLoop({
    model: DEFAULT_MODEL,
    maxTokens: DISTILL_MAX_TOKENS,
    maxRounds: DISTILL_MAX_ROUNDS,
    buildSystem: () => system,
    initialMessages: [
      { role: 'user', content: `${truncatedNote}以下是要蒸馏的对话历史（按时序）：\n\n${transcript}` },
    ],
    tools: withToolsCache(memoryTools),
    // opts 由 agent-loop 的 runToolWithTimeout 传入（含 signal），合并进 context 透传
    executeTool: (name, input, opts = {}) => executeTool(name, input, {
      boundUser,
      chatContext: { openId, chatType: 'p2p' },  // 蒸馏场景视同私聊（能写 Private）
      ...opts,
    }),
  });

  return distillResult;
}
