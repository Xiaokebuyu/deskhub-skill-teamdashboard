/**
 * 一次性工具：扫 bot 加入的所有群聊的成员，按名字关键词找 open_id
 * 用法：cd server && node bot/_find-openid.js <名字关键词>
 */

import '../env.js';   // 走项目自己的 .env 加载器
import * as lark from '@larksuiteoapi/node-sdk';

async function main() {
  const keyword = process.argv[2];
  if (!keyword) {
    console.error('用法: node bot/_find-openid.js <名字关键词>');
    process.exit(1);
  }

  const client = new lark.Client({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  // 1. 列出 bot 加入的所有群
  const chatsRes = await client.im.v1.chat.list({ params: { page_size: 100 } });
  if (chatsRes.code !== 0) {
    console.error('❌ 列群失败:', chatsRes.code, chatsRes.msg);
    process.exit(1);
  }
  const chats = chatsRes.data?.items || [];
  console.log(`✓ bot 加入的群聊: ${chats.length} 个`);

  const hits = [];
  const seen = new Set();
  for (const chat of chats) {
    console.log(`  → 扫 ${chat.name || '(无名)'} chat_id=${chat.chat_id}`);
    let pageToken;
    do {
      const memRes = await client.im.v1.chatMembers.get({
        path: { chat_id: chat.chat_id },
        params: { member_id_type: 'open_id', page_size: 100, page_token: pageToken },
      });
      if (memRes.code !== 0) {
        console.warn(`    跳过: ${memRes.msg}`);
        break;
      }
      for (const m of memRes.data?.items || []) {
        const nm = m.name || '';
        if (nm.includes(keyword) && !seen.has(m.member_id)) {
          hits.push({ name: nm, open_id: m.member_id, from_chat: chat.name });
          seen.add(m.member_id);
        }
      }
      pageToken = memRes.data?.page_token;
    } while (pageToken);
  }

  console.log(`\n🎯 匹配 "${keyword}" 的成员:`);
  if (hits.length === 0) {
    console.log('  （无）');
  } else {
    hits.forEach(h => console.log(`  ${h.name}  open_id=${h.open_id}  (from: ${h.from_chat})`));
  }
  process.exit(0);
}

main().catch(err => {
  console.error('💥', err.message);
  process.exit(1);
});
