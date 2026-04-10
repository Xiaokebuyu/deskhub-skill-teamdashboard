/**
 * 飞书 SDK 封装
 * WSClient 长连接接收消息（无需公网 IP）
 * Client API 发送消息/卡片
 */

import * as lark from '@larksuiteoapi/node-sdk';

let client = null;
let botOpenId = null;

// 消息去重（三层防护）
const recentMessageIds = new Set();          // 1. message_id 去重
const MESSAGE_DEDUP_TTL = 60000;

const processingUsers = new Set();            // 2. per-user 处理锁：正在处理中的用户
const recentContentKeys = new Set();          // 3. 内容去重：同用户+同内容 30s 内跳过
const CONTENT_DEDUP_TTL = 30000;

/**
 * 初始化飞书客户端并启动消息监听
 * @param {Function} onMessage - 回调: (text, chatId, userId, chatType) => Promise<void>
 */
export async function initFeishu(onMessage) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    console.warn('[Bot/Feishu] FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置，跳过飞书初始化');
    return false;
  }

  // API Client（发送消息用）
  client = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  // 获取机器人自身信息（用于判断群聊中是否被 @）
  try {
    const res = await client.request({
      method: 'GET',
      url: 'https://open.feishu.cn/open-apis/bot/v3/info',
    });
    botOpenId = res?.data?.bot?.open_id || res?.bot?.open_id || null;
    if (botOpenId) {
      console.log(`[Bot/Feishu] 机器人 open_id: ${botOpenId}`);
    } else {
      console.warn('[Bot/Feishu] 获取 bot open_id 为空，群聊 @判断可能不准');
    }
  } catch (err) {
    console.warn('[Bot/Feishu] 获取机器人信息失败:', err.message, '（不影响私聊功能）');
  }

  // 事件处理器
  const eventDispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        await handleMessageEvent(data, onMessage);
      } catch (err) {
        console.error('[Bot/Feishu] 消息处理错误:', err);
      }
    },
  });

  // WSClient 长连接（无需公网 IP）
  const wsClient = new lark.WSClient({
    appId,
    appSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  await wsClient.start({ eventDispatcher });
  console.log('[Bot/Feishu] WSClient 长连接已建立');
  return true;
}

/**
 * 处理收到的消息事件
 */
async function handleMessageEvent(data, onMessage) {
  const message = data?.message;
  if (!message) return;

  // 调试：打印消息标识，排查重复问题
  const msgId = message.message_id;
  const eventId = data?.header?.event_id;
  console.log(`[Bot/Dedup] 收到消息 msgId=${msgId} eventId=${eventId} text=${message.content?.slice(0, 50)}`);

  // 消息去重：优先用 message_id，备用 event_id
  const dedupKey = msgId || eventId;
  if (dedupKey && recentMessageIds.has(dedupKey)) {
    console.log(`[Bot/Dedup] 跳过重复 key=${dedupKey}`);
    return;
  }
  if (dedupKey) {
    recentMessageIds.add(dedupKey);
    setTimeout(() => recentMessageIds.delete(dedupKey), MESSAGE_DEDUP_TTL);
  }

  // 只处理文本消息
  const msgType = message.message_type;
  if (msgType !== 'text') return;

  const chatType = message.chat_type;   // 'p2p' | 'group'
  const chatId = message.chat_id;
  const userId = data.sender?.sender_id?.open_id;

  // 解析文本内容
  let content;
  try {
    content = JSON.parse(message.content);
  } catch {
    return;
  }
  let text = content?.text || '';

  // 群聊：必须 @机器人才响应
  if (chatType === 'group') {
    const mentions = message.mentions || [];
    const mentionedBot = mentions.some(m => m.id?.open_id === botOpenId);
    if (!mentionedBot) return;

    // 去掉 @mention 标记
    for (const m of mentions) {
      text = text.replace(m.key || '', '').trim();
    }
  }

  text = text.trim();
  if (!text) return;

  await onMessage(text, chatId, userId, chatType);
}

/**
 * 发送文本消息
 */
export async function sendText(receiveId, receiveIdType, text) {
  if (!client) return;
  try {
    await client.im.v1.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  } catch (err) {
    console.error('[Bot/Feishu] 发送文本失败:', err.message);
  }
}

/**
 * 发送交互卡片消息
 * @param {string} receiveId - chat_id 或 open_id
 * @param {string} receiveIdType - 'chat_id' | 'open_id'
 * @param {object} card - 飞书卡片 JSON
 */
export async function sendCard(receiveId, receiveIdType, card) {
  if (!client) return;
  try {
    await client.im.v1.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  } catch (err) {
    console.error('[Bot/Feishu] 发送卡片失败:', err.message);
  }
}

/**
 * 发送卡片并返回 message_id（用于后续更新）
 * @returns {Promise<string|null>} message_id
 */
export async function sendCardGetId(receiveId, receiveIdType, card) {
  if (!client) return null;
  try {
    const res = await client.im.v1.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
    return res?.data?.message_id || null;
  } catch (err) {
    console.error('[Bot/Feishu] 发送卡片失败:', err.message);
    return null;
  }
}

/**
 * 更新已发送的卡片内容（原地更新，同一张卡片）
 * @param {string} messageId - 要更新的消息 ID
 * @param {object} card - 新的卡片 JSON
 */
export async function updateCard(messageId, card) {
  if (!client || !messageId) return;
  try {
    await client.im.v1.message.patch({
      path: { message_id: messageId },
      data: {
        content: JSON.stringify(card),
      },
    });
  } catch (err) {
    console.error('[Bot/Feishu] 更新卡片失败:', err.message);
  }
}

/**
 * 根据 username 列表查询 feishu_open_id，用于私聊通知
 */
import db from '../db/init.js';

export function getFeishuOpenIds(usernames) {
  if (!usernames.length) return [];
  const placeholders = usernames.map(() => '?').join(',');
  return db.prepare(
    `SELECT username, feishu_open_id FROM users WHERE username IN (${placeholders}) AND feishu_open_id != ''`
  ).all(...usernames).map(r => ({ username: r.username, openId: r.feishu_open_id }));
}
