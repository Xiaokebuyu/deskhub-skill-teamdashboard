import Markdown from "react-markdown";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import SheetModal, { SheetCloseBtn } from "../../components/ui/SheetModal.jsx";

/**
 * 文档阅读器弹窗 — 渲染 markdown 格式的方案文档内容
 */
export default function DocReader({ show, onClose, title, content }) {
  const width = typeof window !== "undefined" ? Math.min(680, window.innerWidth * 0.9) : 680;
  return (
    <SheetModal show={show} onClose={onClose} width={width}>
      {/* 标题栏 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}`,
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, color: COLOR.text, fontWeight: 500 }}>
          {title || "方案文档"}
        </div>
        <SheetCloseBtn onClick={onClose} />
      </div>

      {/* 文档内容 */}
      <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px 24px 24px` }}>
        <Markdown components={mdComponents}>{content || ""}</Markdown>
      </div>
    </SheetModal>
  );
}

// Markdown 元素的内联样式
const mdComponents = {
  h1: ({ children }) => <h1 style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.h1, color: COLOR.btn, margin: `0 0 ${GAP.lg}px`, lineHeight: 1.4 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xxl, color: COLOR.text, margin: `${GAP.xxl}px 0 ${GAP.md}px`, lineHeight: 1.4, borderBottom: `1px solid ${COLOR.border}`, paddingBottom: GAP.sm }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.lg, color: COLOR.text2, margin: `${GAP.xl}px 0 ${GAP.sm}px`, lineHeight: 1.4 }}>{children}</h3>,
  p: ({ children }) => <p style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text2, lineHeight: 1.7, margin: `0 0 ${GAP.base}px` }}>{children}</p>,
  ul: ({ children }) => <ul style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text2, lineHeight: 1.7, margin: `0 0 ${GAP.base}px`, paddingLeft: GAP.xxl }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text2, lineHeight: 1.7, margin: `0 0 ${GAP.base}px`, paddingLeft: GAP.xxl }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: GAP.xs }}>{children}</li>,
  strong: ({ children }) => <strong style={{ color: COLOR.btn, fontWeight: 600 }}>{children}</strong>,
  code: ({ children }) => <code style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, background: COLOR.borderLt, padding: "1px 5px", borderRadius: 4, color: "#8a3a3a" }}>{children}</code>,
  table: ({ children }) => <table style={{ width: "100%", borderCollapse: "collapse", margin: `${GAP.base}px 0`, fontSize: FONT_SIZE.base }}>{children}</table>,
  th: ({ children }) => <th style={{ padding: `${GAP.sm}px ${GAP.base}px`, borderBottom: `2px solid ${COLOR.borderMd}`, textAlign: "left", fontFamily: FONT_SANS, fontWeight: 600, color: COLOR.text }}>{children}</th>,
  td: ({ children }) => <td style={{ padding: `${GAP.sm}px ${GAP.base}px`, borderBottom: `1px solid ${COLOR.borderLt}`, fontFamily: FONT_SANS, color: COLOR.text2 }}>{children}</td>,
};
