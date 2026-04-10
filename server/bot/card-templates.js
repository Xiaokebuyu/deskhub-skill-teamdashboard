/**
 * 飞书消息卡片模板
 * 支持实时更新的进度卡片 + 通知卡片
 *
 * 飞书卡片 Markdown 限制：
 * - 不支持表格语法（| col | col |）
 * - 彩色文字用 <text_tag color='neutral'>淡色文字</text_tag>
 * - 图片只能用 image_key，不能用 URL
 * - 所有可更新卡片必须包含 config.update_multi = true
 */

const HEADER_TITLE = 'DeskHub 助手';

const HEADER_COLORS = {
  info: 'blue',
  thinking: 'blue',
  success: 'green',
  high: 'red',
  summary: 'indigo',
};

// 线性图标（JSON 2.0 standard_icon）
const HEADER_ICON = {
  tag: 'standard_icon',
  token: 'myai-magic-wand_outlined',
  color: 'blue',
};

const HEADER_ICON_THINKING = {
  tag: 'standard_icon',
  token: 'myai-magic-wand_outlined',
  color: 'blue',
};

const HEADER_ICON_ERROR = {
  tag: 'standard_icon',
  token: 'info_outlined',
  color: 'grey',
};

const HEADER_ICON_NOTIFY = {
  tag: 'standard_icon',
  token: 'bell_outlined',
  color: 'blue',
};

// ── 变更通知用 ──
const ACTION_EMOJI = {
  created: '🆕',
  updated: '📝',
  status_changed: '🔄',
  deleted: '🗑️',
};

const ENTITY_LABEL = {
  plan: '工单',
  variant: '方案',
  score: '评分',
};

// ── 工具名称映射 ──
const TOOL_LABELS = {
  list_plans: '查询工单列表',
  get_plan_detail: '查询工单详情',
  get_dimensions: '查询评分维度',
  list_deskhub_skills: '查询 DeskHub 技能',
  get_deskhub_skill: '查询技能详情',
  get_umami_stats: '查询访问统计',
  get_umami_active: '查询在线人数',
  list_users: '查询团队成员',
  get_recent_changes: '查询最近变更',
};

// ============================================================
//  辅助函数
// ============================================================

/** 把 thinking 内容包装成飞书淡色文字 */
function greyText(text) {
  return `<text_tag color='neutral'>${text}</text_tag>`;
}

/** 截断过长文本 */
function truncate(text, max = 200) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

/** 构建 thinking 区域的 elements（分隔线 + 淡色思考内容） */
function buildThinkingSection(thinkingContent, ackText) {
  const parts = [];

  if (ackText) {
    parts.push(ackText);
  }
  if (thinkingContent) {
    parts.push(truncate(thinkingContent));
  }

  if (parts.length === 0) return [];

  return [
    { tag: 'hr' },
    {
      tag: 'markdown',
      content: `${greyText('thinking')}\n${greyText(parts.join('\n'))}`,
    },
  ];
}

// ============================================================
//  对话回复卡片（支持实时更新）
// ============================================================

/**
 * 思考中卡片（初始状态 — 模型开始思考、准备调工具）
 */
export function buildThinkingCard(ackText, thinkingContent) {
  const elements = [];

  // 主区域：模型先说的话
  if (ackText) {
    elements.push({ tag: 'markdown', content: `💭 ${ackText}` });
  } else {
    elements.push({ tag: 'markdown', content: '💭 思考中...' });
  }

  // thinking 区域
  if (thinkingContent) {
    elements.push(...buildThinkingSection(thinkingContent));
  }

  return {
    schema: '2.0',
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: HEADER_TITLE },
      icon: HEADER_ICON_THINKING,
      template: HEADER_COLORS.thinking,
    },
    body: { elements },
  };
}

/**
 * 工具调用进度卡片（中间状态）
 */
export function buildProgressCard(ackText, toolSteps, thinkingContent) {
  const elements = [];

  // 主区域：模型说的话 + 工具进度
  if (ackText) {
    elements.push({ tag: 'markdown', content: `💭 ${ackText}` });
  }

  const stepLines = toolSteps.map(s => {
    const label = TOOL_LABELS[s.name] || s.name;
    return s.done ? `✅  ${label}` : `⏳  ${label}...`;
  });
  if (stepLines.length > 0) {
    elements.push({ tag: 'markdown', content: stepLines.join('\n') });
  }

  // thinking 区域
  if (thinkingContent) {
    elements.push(...buildThinkingSection(thinkingContent));
  }

  return {
    schema: '2.0',
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: HEADER_TITLE },
      icon: HEADER_ICON_THINKING,
      template: HEADER_COLORS.thinking,
    },
    body: { elements },
  };
}

/**
 * 最终回复卡片（完成状态）
 * 只展示结果 + 思考过程，不展示工具链路
 */
export function buildFinalCard(replyText) {
  const elements = [
    {
      tag: 'markdown',
      content: replyText || '暂无数据',
    },
  ];

  return {
    schema: '2.0',
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: HEADER_TITLE },
      icon: HEADER_ICON,
      template: HEADER_COLORS.info,
    },
    body: { elements },
  };
}

/**
 * 直接回复卡片（不需要工具调用时）
 */
export function buildReplyCard(replyText) {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: HEADER_TITLE },
      icon: HEADER_ICON,
      template: HEADER_COLORS.info,
    },
    body: {
      elements: [
        { tag: 'markdown', content: replyText || '暂无数据' },
      ],
    },
  };
}

/**
 * 错误卡片
 */
export function buildErrorCard(errorText) {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: HEADER_TITLE },
      icon: HEADER_ICON_ERROR,
      template: 'grey',
    },
    body: {
      elements: [
        { tag: 'markdown', content: errorText || '抱歉，我暂时无法处理请求，请稍后再试。' },
      ],
    },
  };
}

// ============================================================
//  变更通知卡片
// ============================================================

export function buildNotificationCard(changes) {
  const highCount = changes.filter(c => c.priority === 'high').length;
  const template = highCount > 0 ? HEADER_COLORS.high : HEADER_COLORS.info;

  const lines = changes.map(c => {
    const emoji = ACTION_EMOJI[c.action] || '📌';
    return `${emoji}  ${c.summary}`;
  });

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `DeskHub 工作台更新 (${changes.length} 项)` },
      icon: HEADER_ICON_NOTIFY,
      template,
    },
    body: {
      elements: [
        { tag: 'markdown', content: lines.join('\n') },
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [{
            tag: 'plain_text',
            content: `共 ${changes.length} 项更新 | ${timeStr}${highCount ? ` | ${highCount} 项高优先级` : ''}`,
          }],
        },
      ],
    },
  };
}

export function buildDailySummaryCard(changes) {
  const byType = { plan: [], variant: [], score: [] };
  for (const c of changes) {
    (byType[c.entity_type] || []).push(c);
  }

  const sections = [];
  for (const [type, items] of Object.entries(byType)) {
    if (items.length === 0) continue;
    const label = ENTITY_LABEL[type] || type;
    sections.push(`**${label}** (${items.length} 项)`);
    for (const item of items.slice(0, 10)) {
      const emoji = ACTION_EMOJI[item.action] || '📌';
      sections.push(`  ${emoji}  ${item.summary}`);
    }
    if (items.length > 10) sections.push(`  ...及其他 ${items.length - 10} 项`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `DeskHub 每日汇总 — ${today}` },
      icon: HEADER_ICON_NOTIFY,
      template: HEADER_COLORS.summary,
    },
    body: {
      elements: [
        { tag: 'markdown', content: sections.join('\n') || '今日暂无更新' },
        { tag: 'hr' },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `共 ${changes.length} 项变更` }],
        },
      ],
    },
  };
}
