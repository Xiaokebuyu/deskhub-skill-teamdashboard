import { COLOR, GAP, FONT_SERIF, FONT_SANS, FONT_MONO } from "../../constants/theme.js";

/**
 * 页面 Hero Header — Perplexity step-card 模式
 *   - mono 12px 编号（"01" / "02" / "03"）
 *   - serif 标题（中文 + 英文 italic 强调可选）
 *   - sans 描述文字
 *
 * 用法：<PageHeader num="01" title="技能总览" titleEm="overview" desc="..." />
 */
/**
 * PageHeader —— 无磨砂容器版本。
 * 文字直接浮在照片上，靠"字体颜色本身 + 细 text-shadow"撑可读。
 * 颜色使用 `currentColor` 级联 —— body[data-page="dashboard"] 是深色背景，文字自动转浅；
 * 其他页面浅色背景，文字维持深棕。
 */
export default function PageHeader({ num, title, titleEm, desc }) {
  return (
    <div style={{
      padding: `${GAP.xxl}px ${GAP.lg}px ${GAP.xl}px`,
      marginBottom: GAP.xl,
    }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        color: "inherit",
        opacity: 0.7,
        letterSpacing: 2.5,
        textTransform: "uppercase",
        marginBottom: 14,
        // 无 text-shadow —— 深色暗阴影叠在浅文字上会糊成一圈光晕
      }}>{num}</div>
      <div style={{
        fontFamily: FONT_SERIF,
        fontSize: 72,
        fontWeight: 500,
        lineHeight: 0.98,
        letterSpacing: -1.5,
        color: "#1a1d18",
        // 无描边、无泛光 —— 靠字体本身 + 页面 vignette wash 撑对比度
      }}>
        {title}
        {titleEm && <em style={{ fontStyle: "italic", opacity: 0.78, marginLeft: 14, fontWeight: 400 }}>{titleEm}</em>}
      </div>
      {desc && <div style={{
        fontFamily: FONT_SANS,
        fontSize: 14,
        color: "inherit",
        opacity: 0.88,
        marginTop: 18,
        lineHeight: 1.65,
        maxWidth: 620,
        // 跟 title 对齐：靠文字本身 + 页面 vignette wash 撑对比度，不再加 shadow
      }}>{desc}</div>}
    </div>
  );
}
