/**
 * MarkupStream 单元测试 — 纯 node 跑，不发卡片
 *
 * 用法：cd server && node bot/_probe-parser.js
 *
 * 覆盖：跨 chunk 切 markup / 多 markup 一 chunk / 无效 tag / 未闭合超时兜底 / flush 尾 buffer
 */

import { MarkupStream } from './markup-parser.js';

let passCount = 0;
let failCount = 0;

function assertEq(label, got, expected) {
  const gotStr = JSON.stringify(got);
  const expectedStr = JSON.stringify(expected);
  if (gotStr === expectedStr) {
    console.log(`  ✓ ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    expected: ${expectedStr}`);
    console.log(`    got:      ${gotStr}`);
    failCount++;
  }
}

// ── 场景 1：单 chunk 内一个完整 markup ──
{
  console.log('\n[case 1] 单 chunk 完整 markup');
  const s = new MarkupStream();
  const parts = s.feed('hello [[plan:P-012]] world');
  assertEq('len=3', parts.length, 3);
  assertEq('[0] text=hello ', parts[0], { kind: 'text', text: 'hello ' });
  assertEq('[1] markup plan', parts[1], { kind: 'markup', tag: 'plan', args: ['P-012'], placement: 'block' });
  assertEq('[2] text= world', parts[2], { kind: 'text', text: ' world' });
}

// ── 场景 2：跨 chunk 切开 `[[` 和 `]]` ──
{
  console.log('\n[case 2] 跨 chunk 切 markup');
  const s = new MarkupStream();
  const p1 = s.feed('before [[pla');
  const p2 = s.feed('n:P-012]] after');
  assertEq('p1: [0] text before', p1, [{ kind: 'text', text: 'before ' }]);
  assertEq('p2: markup + text', p2, [
    { kind: 'markup', tag: 'plan', args: ['P-012'], placement: 'block' },
    { kind: 'text', text: ' after' },
  ]);
}

// ── 场景 3：多个 markup 一次 chunk 内 ──
{
  console.log('\n[case 3] 一 chunk 多 markup');
  const s = new MarkupStream();
  const parts = s.feed('[[plan:P-001]][[plan:P-002]][[user:liwei]]');
  assertEq('len=3', parts.length, 3);
  assertEq('[0] plan P-001', parts[0], { kind: 'markup', tag: 'plan', args: ['P-001'], placement: 'block' });
  assertEq('[1] plan P-002', parts[1], { kind: 'markup', tag: 'plan', args: ['P-002'], placement: 'block' });
  assertEq('[2] user inline', parts[2], { kind: 'markup', tag: 'user', args: ['liwei'], placement: 'inline' });
}

// ── 场景 4：带多参数（callout） ──
{
  console.log('\n[case 4] 多参数 callout');
  const s = new MarkupStream();
  const parts = s.feed('[[callout:info|本周所有工单已定稿]]');
  assertEq('callout with 2 args', parts, [
    { kind: 'markup', tag: 'callout', args: ['info', '本周所有工单已定稿'], placement: 'block' },
  ]);
}

// ── 场景 5：无参 divider ──
{
  console.log('\n[case 5] 无参 divider');
  const s = new MarkupStream();
  const parts = s.feed('段落一\n[[divider]]\n段落二');
  assertEq('divider + 前后 text', parts, [
    { kind: 'text', text: '段落一\n' },
    { kind: 'markup', tag: 'divider', args: [], placement: 'block' },
    { kind: 'text', text: '\n段落二' },
  ]);
}

// ── 场景 6：无效 tag 当普通文本 ──
{
  console.log('\n[case 6] 无效 tag 保留原文');
  const s = new MarkupStream();
  const parts = s.feed('a [[unknown:xxx]] b');
  assertEq('保留 [[unknown:xxx]] 原文', parts, [
    { kind: 'text', text: 'a ' },
    { kind: 'text', text: '[[unknown:xxx]]' },
    { kind: 'text', text: ' b' },
  ]);
}

// ── 场景 7：未闭合超过 MAX_PENDING 兜底 ──
{
  console.log('\n[case 7] 未闭合超时兜底');
  const s = new MarkupStream();
  const bigOpen = '[[plan:' + 'x'.repeat(250);
  const parts = s.feed(bigOpen);
  assertEq('整体当 text 泄出', parts.length, 1);
  assertEq('[0] kind=text', parts[0].kind, 'text');
  assertEq('[0] 长度匹配', parts[0].text.length, bigOpen.length);
}

// ── 场景 8：flush 尾 buffer（流结束时还有未闭合 `[[`） ──
{
  console.log('\n[case 8] flush 尾 buffer');
  const s = new MarkupStream();
  s.feed('hello [[pla');
  const tail = s.flush();
  assertEq('flush 返回未完成 text', tail, [{ kind: 'text', text: '[[pla' }]);
}

// ── 场景 9：link 内联 ──
{
  console.log('\n[case 9] link 内联');
  const s = new MarkupStream();
  const parts = s.feed('看 [[link:https://example.com|这里]] 详情');
  assertEq('link inline', parts, [
    { kind: 'text', text: '看 ' },
    { kind: 'markup', tag: 'link', args: ['https://example.com', '这里'], placement: 'inline' },
    { kind: 'text', text: ' 详情' },
  ]);
}

// ── 场景 10：header markup（Stage C 才消费，Stage B 只识别） ──
{
  console.log('\n[case 10] header 识别');
  const s = new MarkupStream();
  const parts = s.feed('[[header:小合 · 工单房|翻抽屉中|violet]]\n正文');
  assertEq('header block', parts[0], {
    kind: 'markup', tag: 'header',
    args: ['小合 · 工单房', '翻抽屉中', 'violet'],
    placement: 'block',
  });
  assertEq('\\n正文 text', parts[1], { kind: 'text', text: '\n正文' });
}

// ── 场景 11：一个字符一个字符喂（极端切法） ──
{
  console.log('\n[case 11] 一字一喂');
  const s = new MarkupStream();
  const input = 'ab[[plan:X]]cd';
  const collected = [];
  for (const ch of input) {
    for (const p of s.feed(ch)) collected.push(p);
  }
  for (const p of s.flush()) collected.push(p);
  // 会出现 text 碎片 — 合并后看最终语义
  const joined = collected.reduce((acc, p) => {
    if (p.kind === 'text') {
      if (acc.length && acc[acc.length - 1].kind === 'text') {
        acc[acc.length - 1].text += p.text;
      } else acc.push({ ...p });
    } else acc.push(p);
    return acc;
  }, []);
  assertEq('合并后 3 部分', joined, [
    { kind: 'text', text: 'ab' },
    { kind: 'markup', tag: 'plan', args: ['X'], placement: 'block' },
    { kind: 'text', text: 'cd' },
  ]);
}

// ═══════════════════════════════════════════════
//  Fenced block 测试（chart / table 新增）
// ═══════════════════════════════════════════════

// ── 场景 12：chart fenced 单 chunk 完整 ──
{
  console.log('\n[case 12] chart fenced 单 chunk');
  const s = new MarkupStream();
  const parts = s.feed('前置\n[[chart:line]]{"type":"line","data":{"values":[]}}[[/chart]]\n后置');
  assertEq('parts 数', parts.length, 3);
  assertEq('[0] text 前置', parts[0], { kind: 'text', text: '前置\n' });
  assertEq('[1] chart body', parts[1], {
    kind: 'markup', tag: 'chart', args: ['line'], placement: 'block',
    body: '{"type":"line","data":{"values":[]}}',
  });
  assertEq('[2] text 后置', parts[2], { kind: 'text', text: '\n后置' });
}

// ── 场景 13：chart fenced 跨 3 个 chunk 切 ──
{
  console.log('\n[case 13] chart fenced 跨 chunk');
  const s = new MarkupStream();
  const p1 = s.feed('[[chart:bar]]\n{"data":{"va');
  const p2 = s.feed('lues":[{"x":1,"y":2}]}');
  const p3 = s.feed('\n[[/chart]] 结尾');
  // p1 不应该 emit（还在 fenced 模式等 body 和闭合）
  assertEq('p1 未 emit', p1, []);
  assertEq('p2 未 emit', p2, []);
  assertEq('p3 应 emit chart + text', p3, [
    {
      kind: 'markup', tag: 'chart', args: ['bar'], placement: 'block',
      body: '\n{"data":{"values":[{"x":1,"y":2}]}\n',
    },
    { kind: 'text', text: ' 结尾' },
  ]);
}

// ── 场景 14：chart body 里含字面 [[plan:X]] 不递归解析 ──
{
  console.log('\n[case 14] chart body 内层 markup 保留字面');
  const s = new MarkupStream();
  const parts = s.feed('[[chart:line]]这里有 [[plan:P-999]] 字面量[[/chart]]');
  assertEq('单 parts', parts, [
    {
      kind: 'markup', tag: 'chart', args: ['line'], placement: 'block',
      body: '这里有 [[plan:P-999]] 字面量',
    },
  ]);
}

// ── 场景 15：chart body 里含 | 和 ] 字符 ──
{
  console.log('\n[case 15] chart body 含 | 和 ]');
  const s = new MarkupStream();
  const body = '{"labels":["A|B","C]D"],"values":[1,2]}';
  const parts = s.feed(`[[chart:pie]]${body}[[/chart]]`);
  assertEq('body 原样保留', parts[0].body, body);
}

// ── 场景 16：table fenced ──
{
  console.log('\n[case 16] table fenced');
  const s = new MarkupStream();
  const parts = s.feed('[[table]]{"columns":[],"rows":[]}[[/table]]');
  assertEq('table no args', parts, [
    {
      kind: 'markup', tag: 'table', args: [], placement: 'block',
      body: '{"columns":[],"rows":[]}',
    },
  ]);
}

// ── 场景 17：fenced 超 MAX_FENCED_BODY 兜底 ──
{
  console.log('\n[case 17] fenced 超时兜底');
  const s = new MarkupStream();
  const huge = 'x'.repeat(5000);
  const parts = s.feed(`[[chart:line]]${huge}`);
  // 超 4000 字无闭合 → 当普通文本
  assertEq('兜底 emit 为 text', parts.length, 1);
  assertEq('kind=text', parts[0].kind, 'text');
  assertEq('text 含原 opening + body', parts[0].text, `[[chart:line]]${huge}`);
}

// ── 场景 18：fenced 闭合 tag 写错（unclosed 直到 flush） ──
{
  console.log('\n[case 18] 闭合 tag 拼写错');
  const s = new MarkupStream();
  s.feed('[[chart:line]]{"data":1}[[/charts]]');   // charts 多了 s
  // feed 阶段没定稿（因为找不到 [[/chart]]）
  const tail = s.flush();
  assertEq('flush 返回一段 text', tail.length, 1);
  assertEq('flush kind=text', tail[0].kind, 'text');
  // 应该包含 opening + body + 错误闭合
  assertEq('flush 含完整原文', tail[0].text, '[[chart:line]]{"data":1}[[/charts]]');
}

// ── 场景 19：一条消息多个 fenced + 穿插单行 ──
{
  console.log('\n[case 19] 多 fenced 穿插单行');
  const s = new MarkupStream();
  const parts = s.feed(
    '开头\n' +
    '[[chart:line]]{"a":1}[[/chart]]\n' +
    '中间 [[user:刘万钢]] 文本\n' +
    '[[table]]{"b":2}[[/table]]\n' +
    '结尾'
  );
  // 期待：text / chart / text / user / text / table / text
  assertEq('parts 数', parts.length, 7);
  assertEq('[0] 开头', parts[0], { kind: 'text', text: '开头\n' });
  assertEq('[1] chart', parts[1], {
    kind: 'markup', tag: 'chart', args: ['line'], placement: 'block',
    body: '{"a":1}',
  });
  assertEq('[2] 中间前缀', parts[2], { kind: 'text', text: '\n中间 ' });
  assertEq('[3] user inline', parts[3], { kind: 'markup', tag: 'user', args: ['刘万钢'], placement: 'inline' });
  assertEq('[4] 文本\\n', parts[4], { kind: 'text', text: ' 文本\n' });
  assertEq('[5] table', parts[5], {
    kind: 'markup', tag: 'table', args: [], placement: 'block',
    body: '{"b":2}',
  });
  assertEq('[6] 结尾', parts[6], { kind: 'text', text: '\n结尾' });
}

// ── 场景 20：fenced 一字一喂（极端切法） ──
{
  console.log('\n[case 20] fenced 一字一喂');
  const s = new MarkupStream();
  const input = 'A[[chart:line]]{"x":1}[[/chart]]B';
  const collected = [];
  for (const ch of input) {
    for (const p of s.feed(ch)) collected.push(p);
  }
  for (const p of s.flush()) collected.push(p);
  // 合并相邻 text
  const joined = collected.reduce((acc, p) => {
    if (p.kind === 'text') {
      if (acc.length && acc[acc.length - 1].kind === 'text') {
        acc[acc.length - 1].text += p.text;
      } else acc.push({ ...p });
    } else acc.push(p);
    return acc;
  }, []);
  assertEq('合并后 3 部分', joined, [
    { kind: 'text', text: 'A' },
    { kind: 'markup', tag: 'chart', args: ['line'], placement: 'block', body: '{"x":1}' },
    { kind: 'text', text: 'B' },
  ]);
}

// ── 场景 21：非白名单 fenced tag（[[foo:x]]...[[/foo]]）当普通文本 ──
{
  console.log('\n[case 21] 非白名单 fenced tag');
  const s = new MarkupStream();
  const parts = s.feed('[[foo:x]]body[[/foo]]');
  // foo 不在 VALID_TAGS，opening 被当普通文本；body 也是文本；[[/foo]] 是 `/` 开头当文本
  const texts = parts.filter(p => p.kind === 'text').map(p => p.text).join('');
  assertEq('全部当文本', texts, '[[foo:x]]body[[/foo]]');
}

// ── 场景 22b：kpi fenced ──
{
  console.log('\n[case 22b] kpi fenced');
  const s = new MarkupStream();
  const parts = s.feed('[[kpi]]{"items":[{"label":"接单","value":"5"}]}[[/kpi]]');
  assertEq('kpi fenced', parts, [
    {
      kind: 'markup', tag: 'kpi', args: [], placement: 'block',
      body: '{"items":[{"label":"接单","value":"5"}]}',
    },
  ]);
}

// ── 场景 22：孤立 [[/plan]] 在 normal 模式当文本 ──
{
  console.log('\n[case 22] 孤立闭合 tag');
  const s = new MarkupStream();
  const parts = s.feed('前文 [[/plan]] 后文');
  assertEq('闭合当普通文本', parts, [
    { kind: 'text', text: '前文 ' },
    { kind: 'text', text: '[[/plan]]' },
    { kind: 'text', text: ' 后文' },
  ]);
}

// ── 汇总 ──
console.log(`\n总结: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
