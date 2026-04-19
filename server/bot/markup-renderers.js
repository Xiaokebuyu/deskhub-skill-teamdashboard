/**
 * Markup → CardKit 元素渲染器
 *
 * 每种 markup 对应一个 renderer。返回结构：
 *   inline：{ placement: 'inline', text: string }  // 将拼到当前 main_text 段
 *   block：{ placement: 'block', elementId: string, elements: object[] }  // 独立插入
 *
 * 所有 renderer 都是 async；渲染失败/数据缺失时退化成 text/placeholder 不抛错。
 *
 * 数据源：
 *   - getPlanDetail / getUserByUsername → server/mcp/db-ops.js（同步 SQLite，快）
 *   - getDeskhubSkill → server/mcp/proxy-ops.js HTTP + 缓存
 *   - getMcpToolByName → 同上，走 listDeskclawTools 的 30min 缓存
 */

import { getPlanDetail, getUserByUsername } from '../mcp/db-ops.js';
import { getDeskhubSkill, getMcpToolByName } from '../mcp/proxy-ops.js';
import { PLAN_ST, PLAN_PHASE, PLAN_RESULT } from '../../shared/constants/status.js';
import { PRI } from '../../shared/constants/priority.js';

// ── 色彩枚举映射（shared 常量的 hex → Feishu enum） ──
// CardKit 的 text_tag/background_style 只接受枚举名，不接受 hex
const PLAN_STATUS_COLOR = { next: 'green', active: 'orange', done: 'grey' };
const PLAN_PHASE_COLOR  = { collecting: 'yellow', evaluating: 'carmine', finalizing: 'green' };
const PLAN_RESULT_COLOR = { adopted: 'green', shelved: 'grey' };
const PRI_COLOR = { high: 'red', medium: 'yellow', low: 'green' };
const CALLOUT_BG = { info: 'blue-50', success: 'green-50', warn: 'orange-50', error: 'red-50' };
const CALLOUT_TAG = { info: 'blue', success: 'green', warn: 'orange', error: 'red' };

// 由 streamer 注入的递增 counter，保证 element_id 唯一
function blockId(prefix, counter) {
  return `markup_${prefix}_${counter}`;
}

/**
 * 从污染的 fenced body 里提取第一个平衡的 JSON **对象** `{...}` 子串。
 * 场景：LLM 偶尔把 fenced tag 当分组标题重复 emit（见 2026-04-20 case）：
 *   body = "` 标题\n[[kpi]]\n{\"items\":[...]}\n"
 * 直接 JSON.parse(body) 挂。先扫出合法 JSON 对象子串再 parse。
 *
 * 只认 `{` 不认 `[`：kpi/chart/table 顶层都是对象；且 `[[kpi]]` 里的 `[[` 会被
 * `[` 起点算法误判成空数组，必须排除。
 *
 * 字符串内部的 `{` / `}` 跳过（简易 state machine 处理 "..." + 转义）。
 * @returns {string|null} 平衡的对象子串，找不到返回 null
 */
function extractFirstJsonBlock(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * 稳健解析 fenced body：先直接 parse，失败再提取第一个平衡 JSON 子串。
 * @param {string} body
 * @param {string} label - 日志用（'Chart'/'Table'/'Kpi'）
 * @returns {object|null}
 */
function parseFencedBody(body, label) {
  const trimmed = (body || '').trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch (_) { /* 落下面 */ }
  const extracted = extractFirstJsonBlock(trimmed);
  if (!extracted) {
    console.warn(`[Bot/Markup/${label}] body 里找不到 JSON 对象, 首 200 字:`, trimmed.slice(0, 200));
    return null;
  }
  try {
    const spec = JSON.parse(extracted);
    if (extracted !== trimmed) {
      console.log(`[Bot/Markup/${label}] body 被污染（含前后噪音），已容错提取 JSON 子串（${extracted.length}/${trimmed.length} 字）`);
    }
    return spec;
  } catch (err) {
    console.warn(`[Bot/Markup/${label}] 提取后 JSON.parse 仍失败: ${err.message}，首 200 字:`, extracted.slice(0, 200));
    return null;
  }
}

// ─────────────────────────────────────────────
//  inline 渲染
// ─────────────────────────────────────────────

async function renderUser(name) {
  const u = getUserByUsername(name);
  if (u && u.feishuOpenId) {
    return { placement: 'inline', text: `<person id='${u.feishuOpenId}'>${u.displayName}</person>` };
  }
  const fallback = u ? u.displayName : name;
  return { placement: 'inline', text: `**${fallback}**` };
}

async function renderLink(url, label) {
  const safeLabel = label || url;
  const safeUrl = url || '#';
  return { placement: 'inline', text: `[${safeLabel}](${safeUrl})` };
}

// ─────────────────────────────────────────────
//  block 渲染
// ─────────────────────────────────────────────

async function renderPlan(id, counter) {
  if (!id) {
    return blockFallback('block_plan', counter, `（plan markup 缺 ID）`);
  }
  const plan = getPlanDetail(id);
  if (!plan) {
    return blockFallback('block_plan', counter, `（工单 ${id} 不存在）`);
  }

  // 状态 tag（PLAN_ST.l + 枚举色）
  const stMeta = PLAN_ST[plan.status] || {};
  const stColor = PLAN_STATUS_COLOR[plan.status] || 'grey';
  const stTag = `<text_tag color='${stColor}'>${stMeta.l || plan.status}</text_tag>`;

  // 优先级 tag（PRI.l + 枚举色）
  const priMeta = PRI[plan.priority] || {};
  const priColor = PRI_COLOR[plan.priority] || 'grey';
  const priTag = plan.priority ? `<text_tag color='${priColor}'>${priMeta.l || plan.priority}</text_tag>` : '';

  // 子阶段（只 active 态才有意义）
  let phaseTag = '';
  if (plan.status === 'active') {
    // 自动推断 phase：简化版本，如果有 variants 数组判断；当前先按状态兜底
    const variantCount = Array.isArray(plan.variants) ? plan.variants.length : 0;
    let phase = 'collecting';
    if (variantCount > 0) phase = 'evaluating';
    const phMeta = PLAN_PHASE[phase];
    phaseTag = `<text_tag color='${PLAN_PHASE_COLOR[phase]}'>${phMeta.l}</text_tag>`;
  } else if (plan.status === 'done' && plan.result) {
    const rMeta = PLAN_RESULT[plan.result];
    if (rMeta) {
      phaseTag = `<text_tag color='${PLAN_RESULT_COLOR[plan.result]}'>${rMeta.l}</text_tag>`;
    }
  }

  // 方案数 / 均分 / AI 代笔计数
  const variants = Array.isArray(plan.variants) ? plan.variants : [];
  const allScores = variants.flatMap(v => Array.isArray(v.scores) ? v.scores : []);
  const avgScore = allScores.length
    ? (allScores.reduce((s, x) => s + (x.value || 0), 0) / allScores.length).toFixed(1)
    : null;
  const aiVariantCount = variants.filter(v => v.authorType === 'ai').length;
  const aiScoreCount = allScores.filter(s => s.authorType === 'ai').length;

  const metaParts = [];
  if (variants.length) {
    const vStr = aiVariantCount > 0
      ? `方案 ${variants.length} 个（含 🦀 ${aiVariantCount} 个 AI 代笔）`
      : `方案 ${variants.length} 个`;
    metaParts.push(vStr);
  }
  if (avgScore !== null) {
    const sStr = aiScoreCount > 0
      ? `均分 ${avgScore}（${aiScoreCount} 条 🦀 AI 代测）`
      : `均分 ${avgScore}`;
    metaParts.push(sStr);
  }
  if (plan.owner) metaParts.push(`负责人 ${plan.owner}`);
  const metaLine = metaParts.length ? `<font color='grey'>${metaParts.join(' · ')}</font>` : '';

  const title = `**${plan.id} · ${plan.name || '未命名工单'}**`;
  const tagLine = [priTag, stTag, phaseTag].filter(Boolean).join(' ');
  const content = [title + (tagLine ? ' ' + tagLine : ''), metaLine].filter(Boolean).join('\n\n');

  const elementId = blockId('plan', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{ tag: 'markdown', content }],
    }],
  };
}

async function renderSkill(slug, counter) {
  if (!slug) return blockFallback('block_skill', counter, '（skill markup 缺 slug）');
  let skill = null;
  try {
    skill = await getDeskhubSkill(slug);
  } catch (err) {
    console.warn('[Bot/Markup] getDeskhubSkill 失败:', err.message);
  }
  if (!skill) return blockFallback('block_skill', counter, `（技能 ${slug} 未找到）`);

  const name = skill.displayName || skill.name || slug;
  const summary = skill.summary || skill.description || '';
  const elementId = blockId('skill', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{
        tag: 'markdown',
        content: `**${name}** <text_tag color='wathet'>DeskHub 技能</text_tag>${summary ? `\n\n<font color='grey'>${summary}</font>` : ''}`,
      }],
    }],
  };
}

async function renderMcp(name, counter) {
  if (!name) return blockFallback('block_mcp', counter, '（mcp markup 缺 name）');
  let tool = null;
  try {
    tool = await getMcpToolByName(name);
  } catch (err) {
    console.warn('[Bot/Markup] getMcpToolByName 失败:', err.message);
  }
  if (!tool) return blockFallback('block_mcp', counter, `（MCP 工具 ${name} 未找到）`);

  const elementId = blockId('mcp', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{
        tag: 'markdown',
        content: `**${tool.name}** <text_tag color='indigo'>MCP 工具</text_tag>${tool.desc ? `\n\n<font color='grey'>${tool.desc}</font>` : ''}`,
      }],
    }],
  };
}

async function renderCallout(level, text, counter) {
  const lv = (level || 'info').toLowerCase();
  const bg = CALLOUT_BG[lv] || 'blue-50';
  const tagColor = CALLOUT_TAG[lv] || 'blue';
  const labelMap = { info: '提示', success: '成功', warn: '注意', error: '错误' };
  const label = labelMap[lv] || '提示';
  const body = text || '';
  const elementId = blockId('callout', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '10px 14px',
      margin: '8px 0',
      corner_radius: '8px',
      background_style: bg,
      elements: [{
        tag: 'markdown',
        content: `<text_tag color='${tagColor}'>${label}</text_tag> ${body}`,
      }],
    }],
  };
}

async function renderSection(title, counter) {
  const elementId = blockId('section', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'markdown',
      element_id: elementId,
      content: `**${title || ''}**`,
      text_size: 'heading-4',
    }],
  };
}

async function renderDivider(counter) {
  const elementId = blockId('divider', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{ tag: 'hr', element_id: elementId, margin: '8px 0' }],
  };
}

// ─────────────────────────────────────────────
//  fenced block：chart / table
//  LLM 给简化 schema（data 是扁平数组），renderer 转成飞书 chart_spec
// ─────────────────────────────────────────────

/**
 * 简化 chart 约定（LLM 产出）：
 *   {
 *     title?: string,                // 标题
 *     aspect_ratio?: string,         // '4:3' | '16:9' | '1:1' | '2:1'，默认 '4:3'
 *     xField?, yField?,              // line/bar/scatter 用
 *     categoryField?, valueField?,   // pie 用
 *     seriesField?,                  // 多系列分组用
 *     data: [{x, y, ...}, ...]       // 扁平数组，renderer 包成 { values: [...] }
 *   }
 * 子类型从 args[0] 来：line / bar / pie / scatter
 */
async function renderChart(subType, body, counter) {
  if (!body || !body.trim()) {
    return blockFallback('chart', counter, '（chart markup 缺 body）');
  }
  const spec = parseFencedBody(body, 'Chart');
  if (!spec) {
    return blockFallback('chart', counter, '（chart JSON 格式错或无法提取）');
  }

  const type = (subType || 'line').toLowerCase();
  if (!['line', 'bar', 'pie', 'scatter'].includes(type)) {
    return blockFallback('chart', counter, `（不支持的 chart 类型：${type}）`);
  }

  const dataArr = Array.isArray(spec.data) ? spec.data : [];
  if (dataArr.length === 0) {
    return blockFallback('chart', counter, '（chart data 为空）');
  }

  const chart_spec = {
    type,
    data: { values: dataArr },
  };
  // 字段映射（按类型不同）
  if (spec.xField) chart_spec.xField = spec.xField;
  if (spec.yField) chart_spec.yField = spec.yField;
  if (spec.categoryField) chart_spec.categoryField = spec.categoryField;
  if (spec.valueField) chart_spec.valueField = spec.valueField;
  if (spec.seriesField) chart_spec.seriesField = spec.seriesField;
  if (spec.title) chart_spec.title = { text: spec.title };

  const elementId = blockId('chart', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'chart',
      element_id: elementId,
      aspect_ratio: spec.aspect_ratio || '4:3',
      chart_spec,
    }],
  };
}

/**
 * 简化 table 约定（LLM 产出）：
 *   {
 *     page_size?: 1-10（默认 5）,
 *     columns: [
 *       { name, display_name?, data_type,
 *         width?, horizontal_align?, format?, date_format? }
 *     ],
 *     rows: [{col_name: value, ...}, ...]
 *   }
 * 基本透传到飞书 table 组件（schema 一致），加一些容错
 */
/**
 * KPI 并列卡（基于飞书 column_set）
 * LLM 产出简化 schema：
 *   {
 *     items: [
 *       { label: string, value: string, color?: 'indigo'|'orange'|'grey'|'red'|'green'|...',
 *         hint?: string }    // hint 可选，比 label 更小的一行附注（如"环比 +12%"）
 *     ]
 *   }
 * 默认 color=indigo。items 1-6 个；超 6 会显得挤，renderer 不拦但效果差。
 */
async function renderKpi(body, counter) {
  if (!body || !body.trim()) {
    return blockFallback('kpi', counter, '（kpi markup 缺 body）');
  }
  const spec = parseFencedBody(body, 'Kpi');
  if (!spec) {
    return blockFallback('kpi', counter, '（kpi JSON 格式错或无法提取）');
  }

  const items = Array.isArray(spec.items) ? spec.items : [];
  if (items.length === 0) {
    return blockFallback('kpi', counter, '（kpi items 为空）');
  }

  const columns = items.map(it => {
    const color = it.color || 'indigo';
    const elements = [
      // 大数字
      { tag: 'markdown', text_align: 'center',
        content: `<font color='${color}' size='heading'>${it.value ?? ''}</font>` },
      // 小标签
      { tag: 'markdown', text_align: 'center',
        content: `<font color='grey' size='notation'>${it.label ?? ''}</font>` },
    ];
    // hint 可选，额外加一行更小的附注
    if (it.hint) {
      elements.push({
        tag: 'markdown', text_align: 'center',
        content: `<font color='grey' size='notation'>${it.hint}</font>`,
      });
    }
    return {
      tag: 'column',
      width: 'weighted',
      weight: 1,
      vertical_align: 'center',
      elements,
    };
  });

  const elementId = blockId('kpi', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'column_set',
      element_id: elementId,
      flex_mode: 'none',
      horizontal_spacing: 'default',
      columns,
    }],
  };
}

// 飞书 table column.data_type 的 7 个合法值（见记忆 markup-system.md），
// LLM 常产的别名统一映射过来。不认识的最终退 'text'，保证不会触发 column idx:N 错。
const DATA_TYPE_ALIASES = {
  text: 'text', string: 'text', str: 'text', bool: 'text', boolean: 'text',
  lark_md: 'lark_md', larkmd: 'lark_md',
  markdown: 'markdown', md: 'markdown', longtext: 'markdown', long_text: 'markdown', richtext: 'markdown',
  number: 'number', int: 'number', integer: 'number', float: 'number', double: 'number', decimal: 'number', percent: 'number',
  options: 'options', option: 'options', choice: 'options', choices: 'options', select: 'options', tag: 'options', tags: 'options', enum: 'options',
  persons: 'persons', person: 'persons', user: 'persons', users: 'persons', member: 'persons', members: 'persons',
  date: 'date', datetime: 'date', time: 'date', timestamp: 'date',
};
const VALID_ALIGN = new Set(['left', 'center', 'right']);

/**
 * 严规整 LLM 产的 table column：
 *   - 缺 name 直接废（飞书 column idx:N 错的常见原因）
 *   - data_type 走别名映射到白名单，未知退 'text'
 *   - width 数字转 '{n}px'，非字符串非数字丢
 *   - horizontal_align 只认 left/center/right
 *   - format 只在 number 列保留 {symbol, precision, separator} 子集
 *   - date_format 只在 date 列保留字符串
 *   - 其他未知字段一律丢（飞书严校验，任何多余字段都可能触发 column idx:N 错）
 */
function normalizeColumn(col) {
  if (!col || typeof col !== 'object' || !col.name) return null;
  const out = { name: String(col.name) };

  if (col.display_name != null) out.display_name = String(col.display_name);

  const rawDt = typeof col.data_type === 'string' ? col.data_type.toLowerCase().trim() : '';
  out.data_type = DATA_TYPE_ALIASES[rawDt] || 'text';

  if (col.width !== undefined && col.width !== null) {
    if (typeof col.width === 'string' && col.width) out.width = col.width;
    else if (typeof col.width === 'number' && Number.isFinite(col.width)) out.width = `${col.width}px`;
  }

  if (typeof col.horizontal_align === 'string') {
    const a = col.horizontal_align.toLowerCase();
    if (VALID_ALIGN.has(a)) out.horizontal_align = a;
  }

  if (out.data_type === 'number' && col.format && typeof col.format === 'object') {
    const fmt = {};
    if (typeof col.format.symbol === 'string') fmt.symbol = col.format.symbol;
    if (typeof col.format.precision === 'number') fmt.precision = col.format.precision;
    if (typeof col.format.separator === 'boolean') fmt.separator = col.format.separator;
    if (Object.keys(fmt).length) out.format = fmt;
  }

  if (out.data_type === 'date' && typeof col.date_format === 'string') {
    out.date_format = col.date_format;
  }

  return out;
}

async function renderTable(body, counter) {
  if (!body || !body.trim()) {
    return blockFallback('table', counter, '（table markup 缺 body）');
  }
  const spec = parseFencedBody(body, 'Table');
  if (!spec) {
    return blockFallback('table', counter, '（table JSON 格式错或无法提取）');
  }

  const rawColumns = Array.isArray(spec.columns) ? spec.columns : [];
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  if (rawColumns.length === 0) {
    return blockFallback('table', counter, '（table 缺 columns）');
  }

  const columns = rawColumns.map(normalizeColumn).filter(Boolean);
  if (columns.length === 0) {
    return blockFallback('table', counter, '（table columns 全部不合法）');
  }
  if (columns.length !== rawColumns.length) {
    console.warn(`[Bot/Markup/Table] ${rawColumns.length - columns.length} 列因缺 name 被丢弃`);
  }

  const page_size = Math.max(1, Math.min(10, Number(spec.page_size) || 5));
  const elementId = blockId('table', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'table',
      element_id: elementId,
      page_size,
      columns,
      rows,
    }],
  };
}

// 统一的降级（数据缺失/ID 错）
function blockFallback(prefix, counter, text) {
  const elementId = blockId(prefix, counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'markdown',
      element_id: elementId,
      content: `<font color='grey'>${text}</font>`,
      text_size: 'notation',
    }],
  };
}

// ─────────────────────────────────────────────
//  入口分发
// ─────────────────────────────────────────────

/**
 * @param {string} tag
 * @param {string[]} args
 * @param {number} counter - 由 streamer 递增，保证 element_id 唯一
 * @param {string} [body] - fenced 块的 body（chart/table 用），单行 markup 传 ''/undefined
 * @returns {Promise<null | { placement: 'inline', text: string } | { placement: 'block', elementId: string, elements: object[] }>}
 */
export async function renderMarkup(tag, args, counter, body) {
  try {
    switch (tag) {
      case 'user':    return await renderUser(args[0]);
      case 'link':    return await renderLink(args[0], args[1]);
      case 'plan':    return await renderPlan(args[0], counter);
      case 'skill':   return await renderSkill(args[0], counter);
      case 'mcp':     return await renderMcp(args[0], counter);
      case 'callout': return await renderCallout(args[0], args[1], counter);
      case 'section': return await renderSection(args[0], counter);
      case 'divider': return await renderDivider(counter);
      case 'chart':   return await renderChart(args[0], body, counter);
      case 'table':   return await renderTable(body, counter);
      case 'kpi':     return await renderKpi(body, counter);
      case 'header':  return null;   // Stage C 在上游直接消费，这里忽略
      default:        return null;
    }
  } catch (err) {
    console.error(`[Bot/Markup] renderMarkup(${tag}) 失败:`, err.message);
    return blockFallback('fallback', counter, `（渲染 ${tag} 失败）`);
  }
}
