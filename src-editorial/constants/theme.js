// ─── 基础 Token (Editorial / Perplexity-inspired) ───────────────────────────────────
//
// 这是 src/ 的 src-editorial/ 副本，专门用来试 Perplexity 风格的"重新上色"。
// 原则：
//   - 所有 key 保持不变，组件无需改动
//   - 只改 value：换调色 + 字体 + 阴影质感
//   - 新增 FONT_SERIF 用于编辑感大标题
//   - 与 src/constants/theme.js 是兄弟关系，可对照看差异
//

/** 颜色体系 — Perplexity 实测色值（从 style-CV38JaYk.css 提取）
 *  Odin 中性体系（暖奶油 + 深棕）
 *  Shiva 强调（teal #20808d）
 *  Phoenix 警示（warm orange #bf5421）
 */
export const COLOR = {
  // 文字层级（深棕 → warm gray）—— 用 Perplexity 真实 odin-light-1000/2000 派生
  text:   "#271a00",   // odin-light-1000，深棕近黑，不是纯黑
  text2:  "#27251e",   // odin-light-2000，warm dark
  text3:  "#3c3b3a",   // 派生
  text4:  "#6e6b62",   // 三级文字
  text5:  "#8a8780",   // 导航/图标
  sub:    "#a8a59c",
  dim:    "#c8c5bc",

  // 背景 —— Perplexity odin-light 阶梯：100/200/300/400
  bg:         "#faf8f5",   // odin-light-200，App 根背景
  bgSide:     "#f3f0ec",   // odin-light-300，侧边栏
  bgModal:    "#fdfbfa",   // odin-light-100，弹窗
  bgCard:     "#fdfbfa",   // odin-light-100，卡片
  bgSkeleton: "#ece9e4",   // odin-light-400
  bgSkBar:    "#dedbd4",   // odin-light-600
  bgWhite:    "#fdfbfa",   // 不用纯白

  // 渐变
  gradModal: "linear-gradient(180deg, #fdfbfa 0%, #fff 30%)",
  gradDesk:  "linear-gradient(180deg, #ece9e4, #dedbd4)",

  // 交互按钮
  btn:      "#271a00",     // 主按钮深棕
  btnHover: "#3c2806",     // hover 略浅
  btnText:  "#faf8f5",     // 按钮文字 = 浅奶油

  // 边框 —— Perplexity 用 odin-light-700-a 半透
  border:   "rgba(39,26,0,0.08)",
  borderLt: "rgba(39,26,0,0.05)",
  borderMd: "rgba(39,26,0,0.10)",
  borderHv: "rgba(39,26,0,0.16)",

  // 状态
  error:   "#bf5421",      // phoenix-500 saturated orange (warning/error 共用 warm)
  success: "#20808d",      // shiva-light-600 ★ Perplexity 标志性 teal
  warn:    "#bf5421",      // phoenix-500
  plan:    "#20808d",      // 同 accent

  // 强调
  blue:  "#20808d",        // 全部归到 teal
  brown: "#97431a",        // phoenix-600
  gold:  "#d57141",        // phoenix-d-400
};

/** 间距体系（px） */
export const GAP = {
  xs: 4, sm: 6, md: 8, base: 10, lg: 12, xl: 16, xxl: 20, page: 40,
};

/** 字号体系（px） */
export const FONT_SIZE = {
  xs: 10, sm: 11, md: 12, base: 13, lg: 14, xl: 15, xxl: 16, h2: 17, h1: 20,
};

// ─── Font Families ────────────────────────────────

export const FONT_MONO = "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Menlo', monospace";
export const FONT_SANS = "'PingFang SC', -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', sans-serif";
// 新增：编辑风衬线（用于大标题、统计数字、有"仪式感"的展示位）
export const FONT_SERIF = "'Cormorant Garamond', 'Source Han Serif SC', 'Songti SC', 'Noto Serif CJK SC', serif";

// ─── 组件级 Token ─────────────────────────────────

// Card shell —— 更柔和的阴影 + 暖色 hover bloom
export const CARD = {
  w: 126,
  h: 164,
  radius: GAP.lg,
  bg: COLOR.bgCard,
  bgHover: "#fdfaf2",
  border: `1px solid ${COLOR.border}`,
  borderHover: `1px solid ${COLOR.borderHv}`,
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
  shadowHover: "0 12px 32px rgba(0,0,0,0.10), 0 0 60px rgba(255,230,180,0.35)",
  transition: "all 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)",
  hoverY: -8,
  hoverScale: 1.03,
  padding: `${GAP.base}px ${GAP.base}px ${GAP.md}px`,
};

// ─── Editorial 玻璃卡片模板 —— 三页所有卡片（Stat/PromptCard/BaseCard/ChartCarousel/FullPanel...）
// 统一复用这里。改一处，全站一起变。
export const GLASS = {
  // 常态
  bg: "rgba(253,251,250,0.78)",
  blur: "blur(20px) saturate(1.3)",
  border: "1px solid rgba(255,255,255,0.55)",
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
  // hover（卡片点击态可选用）
  bgHover: "rgba(253,251,250,0.96)",
  shadowHover: "0 1px 2px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.09), 0 0 40px rgba(255,230,180,0.4)",
};

// Detail modal
export const MODAL = {
  zIndex: 600,
  overlay: "rgba(20,20,15,0.32)",
  blur: "blur(8px)",
  radius: 12,
  width: 340,
  shadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06), 0 0 100px rgba(255,230,180,0.15)",
  scaleHidden: "scale(0.94) translateY(16px)",
  scaleVisible: "scale(1) translateY(0)",
  transition: "transform 0.45s cubic-bezier(0.2, 0.7, 0.3, 1)",
};

// DeskRow
export const DESK = {
  height: 200,
  radius: 14,
  bg: COLOR.gradDesk,
  borderClosed: "1px solid rgba(0,0,0,0.06)",
  borderOpen: `1px solid ${COLOR.border}`,
  shadowClosed: "0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
  shadowOpen: "0 8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6), 0 0 80px rgba(255,230,180,0.2)",
  infoLeft: "1px dashed rgba(0,0,0,0.06)",
  lines: [40, 85, 130, 170],
  maxHand: 7,
  cardW: 126,
  stackY: 18,
};

// FullPanel —— 第三层 Container Transform
export const PANEL = {
  zIndex: 700,
  bg: COLOR.bgWhite,
  radius: 16,
  shadow: "0 30px 80px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08), 0 0 200px rgba(255,230,180,0.1)",
  overlay: "rgba(20,20,15,0.58)", // 加深 —— cream 面板叠在 cream 页面上需要深底对比
  transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
};

// SheetModal —— 业务表单/设置类弹窗（ScorePanel / VariantManager / DocReader / UserPanel / 维度设置 / ChangePassword / 新建工单）
// 比 MODAL 重（上面叠在 FullPanel 之上），但不做 Container Transform 展开 —— "凭空弹"语义
// 层级设计：MODAL(600) < PANEL(700) < SHEET(800) < 预留顶层 confirm(900)
export const SHEET = {
  zIndex: 800,
  overlay: "rgba(20,20,15,0.42)",   // 介于 MODAL 0.32 和 PANEL 0.58 之间
  blur: "blur(4px)",
  bg: COLOR.gradModal,
  radius: 16,
  border: "1px solid rgba(0,0,0,0.1)",
  shadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
  scaleHidden: "scale(0.88) translateY(24px)",
  scaleVisible: "scale(1) translateY(0)",
  transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
  fadeMs: 300,
  // 关闭按钮样式（所有 sheet 头部 X 按钮复用）
  closeBtnSize: 28,
  closeBtnRadius: 7,
  closeBtnBg: "rgba(39,26,0,0.05)",
  closeBtnBgHover: "rgba(39,26,0,0.10)",
};

// Browse page
export const BROWSE = {
  backRadius: 999,        // pill button (Perplexity 风)
  backPadding: "8px 16px",
  backFontSize: 13,
  backFontWeight: 400,
  backColor: COLOR.text4,
  searchBg: COLOR.bgWhite,
  searchRadius: 8,
  searchFontSize: 14,
  gridMin: 128,
};
