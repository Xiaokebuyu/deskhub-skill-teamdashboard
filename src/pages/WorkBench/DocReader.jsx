import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import { X } from "lucide-react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

/**
 * 文档阅读器弹窗 — z-index 800，和 formUI 同款动画
 * 渲染 markdown 格式的方案文档内容
 */
export default function DocReader({ show, onClose, title, content }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!mounted) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 800,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: Math.min(680, window.innerWidth * 0.9),
        maxHeight: "85vh",
        background: COLOR.gradModal,
        border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
        boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
      }}>
        {/* 标题栏 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, color: COLOR.text, fontWeight: 500 }}>
            {title || "方案文档"}
          </div>
          <div onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: COLOR.borderLt,
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = COLOR.borderMd}
            onMouseLeave={e => e.currentTarget.style.background = COLOR.borderLt}
          >
            <X size={14} color={COLOR.text5} strokeWidth={1.5} />
          </div>
        </div>

        {/* 文档内容 */}
        <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px 24px 24px` }}>
          <Markdown components={mdComponents}>{content || ""}</Markdown>
        </div>
      </div>
    </div>
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
