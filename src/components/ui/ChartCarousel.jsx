import { useState, useRef, useEffect } from "react";
import ToggleSwitch from "./ToggleSwitch.jsx";

/**
 * 图表轮播容器 — 顶部滑动标签切换，内容区水平滑动过渡
 * @param {{ tabs: {id:string, label:string, content:ReactNode}[], height?: number }} props
 */
export default function ChartCarousel({ tabs, height = 280 }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const activeIdx = tabs.findIndex(t => t.id === activeId);
  const containerRef = useRef(null);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 滑动标签 */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <ToggleSwitch
          options={tabs.map(t => ({ id: t.id, label: t.label }))}
          value={activeId}
          onChange={setActiveId}
          width={Math.max(280, tabs.length * 90)}
        />
      </div>

      {/* 内容区 — 水平滑动 */}
      <div style={{
        overflow: "hidden",
        borderRadius: 14,
        background: "linear-gradient(180deg, #ede8e0, #e8e2d8)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)",
      }}>
        <div
          ref={containerRef}
          style={{
            display: "flex",
            width: `${tabs.length * 100}%`,
            transform: `translateX(-${activeIdx * (100 / tabs.length)}%)`,
            transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          {tabs.map(tab => (
            <div key={tab.id} style={{
              width: `${100 / tabs.length}%`,
              flexShrink: 0,
              height,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
