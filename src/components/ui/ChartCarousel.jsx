import { useState, useRef, useEffect } from "react";
import ToggleSwitch from "./ToggleSwitch.jsx";

/**
 * 图表轮播容器 — 选择栏在内部顶栏，高度自适应内容
 * 切换时用 opacity + translateY 过渡，每个 tab 高度由内容决定
 */
export default function ChartCarousel({ tabs, minHeight = 200 }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const [displayId, setDisplayId] = useState(tabs[0]?.id);
  const [fading, setFading] = useState(false);

  const handleChange = (id) => {
    if (id === activeId) return;
    setFading(true);
    setTimeout(() => {
      setDisplayId(id);
      setActiveId(id);
      requestAnimationFrame(() => setFading(false));
    }, 200);
  };

  const activeTab = tabs.find(t => t.id === displayId);

  return (
    <div style={{
      marginBottom: 16, overflow: "hidden", borderRadius: 14,
      background: "linear-gradient(180deg, #ede8e0, #e8e2d8)",
      border: "1px solid rgba(0,0,0,0.05)",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)",
    }}>
      {/* 选择栏 — 内部顶栏 */}
      <div style={{
        display: "flex", justifyContent: "center",
        padding: "10px 16px 6px",
      }}>
        <ToggleSwitch
          options={tabs.map(t => ({ id: t.id, label: t.label }))}
          value={activeId}
          onChange={handleChange}
          width={Math.max(280, tabs.length * 90)}
        />
      </div>

      {/* 内容区 — opacity 过渡，高度自适应 */}
      <div style={{
        padding: "8px 20px 16px",
        minHeight,
        opacity: fading ? 0 : 1,
        transform: fading ? "translateY(8px)" : "translateY(0)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}>
        {activeTab?.content}
      </div>
    </div>
  );
}
