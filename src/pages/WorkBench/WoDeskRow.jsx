import { useRef } from "react";
import { FONT_MONO, DESK } from "../../constants/theme.js";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import WoCard from "./WoCard.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";
import { PRI } from "../../constants/priority.js";
import { FONT_SANS } from "../../constants/theme.js";
import { avgScore } from "../../utils/helpers.js";

/**
 * 工单桌面行 — 复用 useDeskRow + DeskRowShell
 * 第二层：DetailModal 显示方案排名概览
 */
export default function WoDeskRow({ label, labelColor, icon, wos, dims, onSelect, onViewAll, onExpandFull }) {
  const sorted = [...wos].sort((a, b) => b.created.localeCompare(a.created));
  const dr = useDeskRow(sorted, wo => wo.id);
  const detailRef = useRef(null);

  const totalVariants = wos.reduce((a, wo) => a + wo.variants.length, 0);
  const highCount = wos.filter(wo => wo.priority === "high").length;

  // 展开详情时直接过渡 — 从弹窗位置无缝膨胀为第三层，不回收卡片
  const handleExpandFull = (wo) => {
    const rect = detailRef.current?.getBoundingClientRect();
    if (onExpandFull) {
      onExpandFull(wo, rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null);
      // 静默清理焦点状态（不触发回收动画）
      setTimeout(() => dr.clearFocusSilent(), 100);
    }
  };

  return (
    <>
      <DeskRowShell {...dr} onViewAll={onViewAll}
        renderInfo={() => (
          <div onClick={() => dr.handOpen ? (dr.focusPhase ? null : dr.setHandOpen(false)) : (onViewAll && onViewAll())} style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            left: dr.handOpen ? "100%" : (20 + (Math.min(dr.count, 5) - 1) * 38 + DESK.cardW + 20),
            padding: dr.handOpen ? 0 : "14px 16px", display: "flex", flexDirection: "column",
            justifyContent: "center", gap: 6, cursor: onViewAll ? "pointer" : "default",
            opacity: dr.handOpen ? 0 : 1, overflow: "hidden",
            transition: "opacity 0.3s, left 0.4s",
            borderLeft: dr.handOpen ? "none" : DESK.infoLeft,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, whiteSpace: "nowrap" }}>
              {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: labelColor || "#4a4540", letterSpacing: 0.3 }}>{label}</span>
              <span style={{ fontSize: 13, color: "#a09888", marginLeft: 4 }}>{dr.count} 件</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "高优先", val: highCount, c: "#b83a2a" },
                { label: "总方案", val: totalVariants, c: "#7a6a55" },
              ].map(it => (
                <div key={it.label} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "5px 9px" }}>
                  <div style={{ fontSize: 10, color: "#a09888", letterSpacing: 0.3, marginBottom: 2 }}>{it.label}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 15, color: it.c }}>{it.val}</div>
                </div>
              ))}
            </div>
            {onViewAll && <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>}
          </div>
        )}

        renderCards={() => dr.handCards.map((wo, i) => (
          <WoCard key={wo.id} wo={wo} style={dr.getCardStyle(i)}
            hovered={dr.hoverIdx === i && !dr.focusPhase}
            onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
            onLeave={() => dr.setHoverIdx(null)}
            onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(wo, i); }}
          />
        ))}

        renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
          <WoDetailPopup
            ref={detailRef}
            wo={dr.focusItem}
            dims={dims}
            onClose={dr.handleDetailClose}
            onExpandFull={handleExpandFull}
          />
        )}
      />
    </>
  );
}

import { forwardRef } from "react";

/** 第二层弹窗 — 方案排名概览 */
const WoDetailPopup = forwardRef(function WoDetailPopup({ wo, dims, onClose, onExpandFull }, ref) {
  const activeDims = (dims || []).filter(d => d.active);

  // 按均分排序
  const ranked = [...wo.variants].map(v => ({
    ...v,
    avg: avgScore(v, activeDims),
  })).sort((a, b) => b.avg - a.avg);

  const testers = new Set();
  wo.variants.forEach(v => v.scores?.forEach(s => testers.add(s.tester)));

  return (
    <DetailModal show={true} onClose={onClose} width={380}>
      <div ref={ref}>
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{wo.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "2px 7px", background: PRI[wo.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: PRI[wo.priority].c }}>{PRI[wo.priority].l}</span>
            <span style={{ padding: "2px 7px", background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: wo.type === "skill" ? "#8a6a3a" : "#5a7a9a" }}>{wo.type === "skill" ? "Skill" : "MCP"}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a89a78" }}>{wo.created}</span>
          </div>
        </div>

        {/* 描述 */}
        {wo.desc && (
          <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: FONT_SANS, fontSize: 14, color: "#4a4540", lineHeight: 1.6 }}>
            {wo.desc}
          </div>
        )}

        {/* 方案排名 */}
        <div style={{ padding: "12px 18px" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>
            方案概览 ({wo.variants.length})
          </div>
          {ranked.length === 0 ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898", padding: "8px 0" }}>暂无方案</div>
          ) : (
            ranked.map((v, i) => (
              <div key={v.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0", borderBottom: i < ranked.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
              }}>
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#3a2a18" }}>
                    {i === 0 && v.avg > 0 && <span style={{ marginRight: 4 }}>🥇</span>}
                    {v.name}
                  </div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginTop: 2 }}>
                    {v.uploader} · {v.uploaded}
                  </div>
                </div>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 15, fontWeight: 500,
                  color: v.avg > 0 ? "#3a2a18" : "#c4bfb5",
                }}>
                  {v.avg > 0 ? v.avg.toFixed(1) : "待测"}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 参与人数 */}
        {testers.size > 0 && (
          <div style={{ padding: "0 18px 10px", fontFamily: FONT_SANS, fontSize: 11, color: "#a09888" }}>
            {testers.size} 人参与评测
          </div>
        )}

        {/* 展开详情 */}
        <div
          onClick={() => { if (onExpandFull) onExpandFull(wo); }}
          style={{
            padding: "12px 18px", borderTop: "1px solid rgba(0,0,0,0.06)",
            textAlign: "center", cursor: "pointer",
            fontFamily: FONT_SANS, fontSize: 13, color: "#8a7a62",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#3a2a18"; e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#8a7a62"; e.currentTarget.style.background = "transparent"; }}
        >
          展开详情 →
        </div>
      </div>
    </DetailModal>
  );
});
