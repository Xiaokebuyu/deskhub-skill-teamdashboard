import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FONT_MONO, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

/**
 * 轻量分区组件 — 分割线 + 标题，无背景/阴影
 */
export default function WoSection({ title, icon, collapsible = false, defaultCollapsed = false, count, children }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 分割线 + 标题行 */}
      <div
        onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
        style={{
          borderTop: `1px solid ${COLOR.borderMd}`,
          paddingTop: GAP.lg, marginBottom: collapsed ? 0 : GAP.lg,
          display: "flex", alignItems: "center", gap: GAP.md,
          cursor: collapsible ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        {icon && <span style={{ fontSize: FONT_SIZE.xxl }}>{icon}</span>}
        <span style={{
          fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text2,
          letterSpacing: 0.3, fontWeight: 500,
        }}>
          {title}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: FONT_SIZE.md, color: COLOR.sub }}>{count} 件工单</span>
        )}
        {collapsible && (
          <ChevronDown size={14} style={{
            color: COLOR.sub, marginLeft: "auto",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
          }} />
        )}
      </div>

      {/* 内容区 */}
      {!collapsed && children}
    </div>
  );
}
