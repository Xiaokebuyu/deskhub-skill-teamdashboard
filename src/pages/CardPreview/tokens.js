/**
 * Feishu CardKit token → 本地预览的颜色/图标映射
 * 近似还原，不是飞书官方渲染引擎
 */

import {
  Wand2, PieChart, Pencil, CheckCircle2, XCircle, Plus,
  Info, Bell, BellRing, AlertTriangle, Sparkles, Brain,
  FileText, Check, ChevronDown, MoreHorizontal,
} from 'lucide-react';

/** 色板主色（对齐 TeamBoard 暖色系 — 偏棕偏红更沉） */
export const COLOR_HEX = {
  orange:    '#b85c1a',   // TeamBoard warn：进行中/橙棕
  red:       '#b83a2a',   // TeamBoard error：红棕
  green:     '#4a8a4a',   // TeamBoard success：森林绿
  blue:      '#5a7a9a',   // TeamBoard MCP：蓝灰
  indigo:    '#6a5a9a',   // 暖紫
  violet:    '#8a6aaa',   // 偏红的紫
  turquoise: '#4a8a8a',   // 暖青
  yellow:    '#b8861a',   // 金棕（中优先）
  purple:    '#8a5aaa',   // 深紫
  carmine:   '#9a3a3a',   // 酒红
  lime:      '#6a8a3a',   // 橄榄绿
  grey:      '#7a6a55',   // 暖灰棕（TeamBoard text4）
  neutral:   '#a09888',   // sub 级
  wathet:    '#7a9aaa',   // 烟雾青
  default:   '#FDFCFA',   // bgModal
};

/** -50 浅色背景（对齐 TeamBoard 奶油/米色系，不要冷白） */
export const COLOR_BG = {
  'blue-50':      '#eaeef3',
  'green-50':     '#eef3ee',
  'orange-50':    '#f5ebe0',
  'red-50':       '#f5e8e4',
  'yellow-50':    '#f3ecde',
  'indigo-50':    '#ebe8f0',
  'violet-50':    '#efe8f0',
  'turquoise-50': '#e6edec',
  'purple-50':    '#ede4ef',
  'grey-50':      '#f2efe9',     // TeamBoard bgSkeleton
  'grey-100':     '#ede8e0',     // DESK 顶色
  'grey-200':     'rgba(0,0,0,0.08)',  // borderMd
  'grey-300':     'rgba(0,0,0,0.12)',  // borderHv
  'grey-400':     '#a09888',
  default:        '#FDFCFA',     // bgModal
};

/** header template 背景 + 边框色 — 走 TeamBoard 奶油色 */
export const HEADER_TEMPLATE = {
  default:   { bg: '#FDFCFA', border: 'rgba(0,0,0,0.06)' },
  red:       { bg: '#f5e8e4', border: 'rgba(184,58,42,0.18)' },
  orange:    { bg: '#f5ebe0', border: 'rgba(184,92,26,0.18)' },
  yellow:    { bg: '#f3ecde', border: 'rgba(184,134,26,0.18)' },
  green:     { bg: '#eef3ee', border: 'rgba(74,138,74,0.18)' },
  turquoise: { bg: '#e6edec', border: 'rgba(74,138,138,0.18)' },
  blue:      { bg: '#eaeef3', border: 'rgba(90,122,154,0.18)' },
  purple:    { bg: '#ede4ef', border: 'rgba(138,90,170,0.18)' },
  indigo:    { bg: '#ebe8f0', border: 'rgba(106,90,154,0.18)' },
  violet:    { bg: '#efe8f0', border: 'rgba(138,106,170,0.18)' },
  carmine:   { bg: '#f5e8e4', border: 'rgba(154,58,58,0.18)' },
  grey:      { bg: '#f2efe9', border: 'rgba(0,0,0,0.06)' },
};

/** TeamBoard 主题常量 — 卡片用 */
export const TB = {
  // 文字
  text:        '#3a2a18',  // 深棕标题
  text2:       '#4a4540',  // 正文
  text4:       '#7a6a55',  // 三级文字
  sub:         '#a09888',  // 辅助/时间戳
  // 背景
  bgCard:      '#f6f1ea',  // 卡片主体
  bgModal:     '#FDFCFA',  // 弹窗 / card 壳
  bgSide:      '#F3F2EE',  // 页面外层
  // 边框 + 阴影
  border:      'rgba(0,0,0,0.06)',
  borderMd:    'rgba(0,0,0,0.08)',
  shadow:      '0 1px 4px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)',
  // 字体
  fontMono:    "'SF Mono', 'Cascadia Code', 'Menlo', monospace",
  fontSans:    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
};

/** 飞书 standard_icon token → lucide 近似 */
export const ICON_MAP = {
  'myai-magic-wand_outlined':   Wand2,
  'chart-ring_outlined':        PieChart,
  'edit_outlined':              Pencil,
  'pencil_outlined':            Pencil,
  'file-doc_outlined':          FileText,
  'file_outlined':              FileText,
  'done-circle_outlined':       CheckCircle2,
  'done_outlined':              Check,
  'close-circle_outlined':      XCircle,
  'plus_outlined':              Plus,
  'add_outlined':               Plus,
  'info_outlined':              Info,
  'bell_outlined':              Bell,
  'bell-ring_outlined':         BellRing,
  'warning-triangle_outlined':  AlertTriangle,
  'down-small-ccm_outlined':    ChevronDown,
  'myai-sparkles_outlined':     Sparkles,
  'myai-brain_outlined':        Brain,
};

/** 文字 size 映射 */
export const TEXT_SIZE = {
  'heading-0':  28,
  'heading-1':  22,
  'heading-2':  18,
  'heading-3':  16,
  'heading-4':  15,
  'normal':     14,
  'notation':   12,
  'xx-large':   20,
  'x-large':    18,
  'large':      16,
  'medium':     14,
  'small':      12,
  'x-small':    11,
  'xx-small':   10,
};
