/**
 * 飞书 LLM 机器人入口
 * 卡片实时更新：一张卡片从思考→工具调用→最终结果全程原地更新
 */

import { initFeishu, sendCardGetId, updateCard, sendCard } from './feishu.js';
import { chat } from './llm.js';
import { getSession, updateSession, startSessionCleanup } from './session.js';
import { startChangeDetector } from './change-detector.js';
import { startPatrol } from './patrol.js';
import { enqueueMessage } from './concurrency.js';
import {
  buildThinkingCard,
  buildProgressCard,
  buildFinalCard,
  buildReplyCard,
  buildErrorCard,
} from './card-templates.js';

/**
 * 启动飞书机器人
 */
export async function startBot() {
  if (process.env.BOT_ENABLED !== 'true') {
    console.log('[Bot] BOT_ENABLED !== true，跳过启动');
    return;
  }

  startSessionCleanup();

  const feishuReady = await initFeishu(handleMessage);

  startChangeDetector();
  startPatrol();

  if (feishuReady) {
    console.log('[Bot] 飞书机器人已启动');
  } else {
    console.log('[Bot] 变更检测已启动（飞书未配置，消息功能不可用）');
  }
}

/**
 * 处理收到的飞书消息
 * 卡片生命周期：
 *   1. 模型直接回复（不用工具）→ 一张卡片完事
 *   2. 模型需要工具 → 先发"思考中"卡片 → 更新进度 → 更新为最终结果
 */
async function handleMessage(text, chatId, userId, chatType) {
  const receiveId = chatType === 'p2p' ? userId : chatId;
  const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';

  const { status } = await enqueueMessage(userId, async () => {
    let cardMessageId = null;

    const onProgress = async (event) => {
      switch (event.type) {
        case 'thinking': {
          const card = buildThinkingCard(event.text, event.thinkingContent);
          cardMessageId = await sendCardGetId(receiveId, receiveIdType, card);
          break;
        }

        case 'tool_start': {
          const card = buildProgressCard(event.thinkingText, event.toolSteps, event.thinkingContent);
          if (cardMessageId) {
            await updateCard(cardMessageId, card);
          } else {
            cardMessageId = await sendCardGetId(receiveId, receiveIdType, card);
          }
          break;
        }

        case 'tool_done': {
          if (cardMessageId) {
            const card = buildProgressCard(event.thinkingText, event.toolSteps, event.thinkingContent);
            await updateCard(cardMessageId, card);
          }
          break;
        }

        case 'complete': {
          const card = buildFinalCard(event.text);
          if (cardMessageId) {
            await updateCard(cardMessageId, card);
          } else {
            await sendCard(receiveId, receiveIdType, card);
          }
          break;
        }

        case 'direct_reply': {
          const card = buildReplyCard(event.text);
          await sendCard(receiveId, receiveIdType, card);
          break;
        }

        case 'error': {
          const card = buildErrorCard(event.text);
          if (cardMessageId) {
            await updateCard(cardMessageId, card);
          } else {
            await sendCard(receiveId, receiveIdType, card);
          }
          break;
        }
      }
    };

    try {
      const history = getSession(userId);
      const reply = await chat(text, history, onProgress);
      updateSession(userId, text, reply);
    } catch (err) {
      console.error('[Bot] 消息处理错误:', err);
      const card = buildErrorCard('抱歉，我暂时无法处理请求，请稍后再试。');
      if (cardMessageId) {
        await updateCard(cardMessageId, card);
      } else {
        await sendCard(receiveId, receiveIdType, card);
      }
    }
  });

  // 背压：队列已满时回复友好提示
  if (status === 'backpressure') {
    await sendCard(receiveId, receiveIdType,
      buildReplyCard('我还在处理你之前的消息，稍等一下~')
    );
  }
}
