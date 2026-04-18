/**
 * 思考摘要小模型调用
 *
 * 目的：拿一段原始 thinking 内容，让 MiniMax-M2.7-highspeed 一句 ≤20 字概括结论。
 * 用于思考胶囊收起后的标题（● 思考 2.1s · {摘要}）。
 *
 * 设计：
 *  - 复用 anthropic-client.js 的同一个 client + SUMMARY_MODEL env 配置
 *  - 不传 thinking 参数 = 纯推理模式（快）
 *  - AbortController 1.5s timeout；失败返 null，调用侧兜底显示"● 思考 X.Xs"
 *  - fire-and-forget：不进 ChatCardStreamer._opQueue，结果回来再 enqueue patch
 */

import { client, SUMMARY_MODEL } from './anthropic-client.js';

const TIMEOUT_MS = 4000;
const MAX_SUMMARY_TOKENS = 50;

/**
 * @param {string} rawThinking - 累积的 thinking 内容（跨 chunk 已拼好）
 * @returns {Promise<string|null>} 摘要文本，失败/超时返 null
 */
export async function summarizeThinking(rawThinking) {
  if (!rawThinking || rawThinking.trim().length < 10) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: MAX_SUMMARY_TOKENS,
      messages: [
        {
          role: 'user',
          content: '用 ≤20 字一句中文概括这段思考的结论，直接输出不要引号不要前缀：\n\n' + rawThinking.slice(0, 2000),
        },
      ],
    }, { signal: controller.signal });

    const text = res.content?.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!text) return null;

    // 取第一行（防止模型多输出），截到 24 字兜底
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > 24 ? firstLine.slice(0, 24) + '…' : firstLine;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[Bot/Summary] 摘要失败:', err.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
