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
import {
  buildChartProbeA_VChartLine,
  buildChartProbeB_FlatData,
  buildChartProbeC_BarPie,
  buildChartProbeD_MultiSeries,
  buildChartProbeE_Scatter,
  buildChartPatchInitialCard,
  CHART_PATCH_FULL_REPLACEMENT,
  buildTableProbeA_AllTypes,
  buildTableProbeB_Pagination,
  buildColumnSetProbeA,
  buildColumnSetProbeB,
  buildColumnSetProbeC,
} from './_probe-chart-table.js';

const VALID_TARGETS = [
  'icons', 'colors', 'templates',
  'charts', 'tables', 'chart-patch', 'columns',
  'all',
];

async function main() {
  const [openId, targetArg = 'all'] = process.argv.slice(2);
  const target = targetArg.toLowerCase();

  if (!openId || !openId.startsWith('ou_')) {
    console.error('❌ 必须传 open_id（ou_ 开头）作为第一个参数');
    console.error(`   用法：node bot/_probe-run.js ou_xxxxxxxx [${VALID_TARGETS.join('|')}]`);
    process.exit(1);
  }
  if (!VALID_TARGETS.includes(target)) {
    console.error(`❌ target 必须是 ${VALID_TARGETS.join('/')} 之一，收到 "${target}"`);
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
      return null;
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
      return null;
    }
    console.log(`✓ ${label} 已发送 cardId=${cardId}`);
    return cardId;
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
  if (target === 'charts' || target === 'all') {
    await send(buildChartProbeA_VChartLine(),   'Chart A · VChart spec line');
    await send(buildChartProbeB_FlatData(),     'Chart B · 扁平 data 数组');
    await send(buildChartProbeC_BarPie(),       'Chart C · 柱状+饼图');
    await send(buildChartProbeD_MultiSeries(),  'Chart D · 多系列折线');
    await send(buildChartProbeE_Scatter(),      'Chart E · 散点图');
  }
  if (target === 'tables' || target === 'all') {
    await send(buildTableProbeA_AllTypes(),     'Table A · 7 种列类型');
    await send(buildTableProbeB_Pagination(),   'Table B · 分页（12 行/页 5）');
  }
  if (target === 'columns' || target === 'all') {
    await send(buildColumnSetProbeA(),          'Column A · KPI markdown 大数字');
    await send(buildColumnSetProbeB(),          'Column B · plain_text + 灰底');
    await send(buildColumnSetProbeC(),          'Column C · 3 种 flex_mode');
  }
  if (target === 'chart-patch') {
    // 先发初始卡片（3 个数据点），2 秒后 patchCardElement 把数据替换为 5 个点
    // 看飞书客户端是"全量替换"还是"merge 追加"——若追加则流式填充可行
    const cardId = await send(buildChartPatchInitialCard(), 'Chart Patch · 初始 3 点');
    if (!cardId) {
      console.error('❌ patch 测试前置失败，退出');
      process.exit(1);
    }
    console.log('⏳ 2 秒后 patchCardElement 追加数据点...');
    await new Promise(r => setTimeout(r, 2000));

    const patchRes = await client.cardkit.v1.cardElement.patch({
      path: { card_id: cardId, element_id: 'chart_patch_target' },
      data: {
        partial_element: JSON.stringify(CHART_PATCH_FULL_REPLACEMENT),
        uuid: `probe-patch-${Date.now()}`,
        sequence: 1,
      },
    });
    if (patchRes.code !== 0) {
      console.error(`❌ Patch 失败: code=${patchRes.code} msg=${patchRes.msg}`);
    } else {
      console.log(`✓ Patch 已发送。观察飞书客户端 chart：`);
      console.log(`  • 若显示 5 个数据点（周一到周五） → patch 支持（全量 or merge 均可）`);
      console.log(`  • 若仍 3 个点或空白 → patch 对 chart 不生效，Phase 3 走一次性渲染`);
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
