/**
 * 飞书 icon/color 探测运行器 — 本地一次性工具
 *
 * 用法：
 *   cd server
 *   node bot/_probe-run.js <open_id> [icons|colors|templates|all]
 *
 * 直接用 .env 里的 FEISHU_APP_ID/APP_SECRET 初始化 client，
 * 发探测卡到指定 open_id 私聊。不启动 WSClient，不接收消息，
 * 发完即退出。
 *
 * 安全：必须传 open_id（ou_ 开头）；绝不接收 chat_id 避免误发群。
 */

import '../env.js';   // 走项目自己的 .env 加载器
import * as lark from '@larksuiteoapi/node-sdk';
import {
  buildIconProbeCard,
  buildColorProbeCard,
  buildHeaderTemplateProbeCard,
  HEADER_TEMPLATES,
} from './_probe-cards.js';

async function main() {
  const [openId, targetArg = 'all'] = process.argv.slice(2);
  const target = targetArg.toLowerCase();

  if (!openId || !openId.startsWith('ou_')) {
    console.error('❌ 必须传 open_id（ou_ 开头）作为第一个参数');
    console.error('   用法：node bot/_probe-run.js ou_xxxxxxxx [icons|colors|templates|all]');
    process.exit(1);
  }
  if (!['icons', 'colors', 'templates', 'all'].includes(target)) {
    console.error(`❌ target 必须是 icons/colors/templates/all，收到 "${target}"`);
    process.exit(1);
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    console.error('❌ .env 里缺 FEISHU_APP_ID 或 FEISHU_APP_SECRET');
    process.exit(1);
  }

  const client = new lark.Client({
    appId, appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  async function send(card, label) {
    // 1. 创建卡片实体
    const createRes = await client.cardkit.v1.card.create({
      data: { type: 'card_json', data: JSON.stringify(card) },
    });
    if (createRes.code !== 0) {
      console.error(`❌ ${label} 创建失败: code=${createRes.code} msg=${createRes.msg}`);
      return;
    }
    const cardId = createRes.data?.card_id;
    // 2. 发消息引用卡片
    const sendRes = await client.im.v1.message.create({
      params: { receive_id_type: 'open_id' },
      data: {
        receive_id: openId,
        msg_type: 'interactive',
        content: JSON.stringify({ type: 'card', data: { card_id: cardId } }),
      },
    });
    if (sendRes.code !== 0) {
      console.error(`❌ ${label} 发送失败: code=${sendRes.code} msg=${sendRes.msg}`);
    } else {
      console.log(`✓ ${label} 已发送 cardId=${cardId}`);
    }
  }

  console.log(`📬 目标 open_id: ${openId}`);
  console.log(`🎯 探测项: ${target}\n`);

  if (target === 'icons' || target === 'all') {
    await send(buildIconProbeCard(), 'Icon 探测卡');
  }
  if (target === 'colors' || target === 'all') {
    await send(buildColorProbeCard(), 'Color 探测卡');
  }
  if (target === 'templates') {
    // 只在单独请 templates 时发（避免 all 刷 13 张）
    for (const tpl of HEADER_TEMPLATES) {
      await send(buildHeaderTemplateProbeCard(tpl), `Template=${tpl}`);
    }
  }

  console.log('\n✅ 全部发送完毕。打开飞书私聊截图回传。');
  process.exit(0);
}

main().catch(err => {
  console.error('💥 运行失败:', err.message);
  if (err.response) console.error('  response:', JSON.stringify(err.response.data || err.response).slice(0, 400));
  process.exit(1);
});
