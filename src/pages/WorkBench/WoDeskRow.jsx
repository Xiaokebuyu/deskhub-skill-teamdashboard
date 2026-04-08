import { useRef } from "react";
import { FONT_MONO, FONT_SANS, DESK, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import WoCard from "./WoCard.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";
import { PRI } from "../../constants/priority.js";
import { avgScore } from "../../utils/helpers.js";

/**
 * 工单桌面行 — 复用 useDeskRow + DeskRowShell
 * 第二层：DetailModal 显示方案排名概览
 */
export default function WoDeskRow({ label, labelColor, icon, wos, dims, onSelect, onViewAll, onExpandFull, fullPanelOpen }) {
  const sorted = [...wos].sort((a, b) => b.created.localeCompare(a.created));
  const dr = useDeskRow(sorted, wo => wo.id);
  const detailRef = useRef(null);

  const totalVariants = wos.reduce((a, wo) => a + wo.variants.length, 0);
  const highCount = wos.filter(wo => wo.priority === "high").length;

  // 展开详情时直接过渡 — 不清焦点，卡片保持 detail 阶段等关闭时飞回
  const handleExpandFull = (wo) => {
    const rect = detailRef.current?.getBoundingClientRect();
    if (onExpandFull) {
      // 传递 rect 和卡片飞回回调给父级
      onExpandFull(wo, rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null, dr.handleDetailClose);
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
            <div style={{ display: "flex", alignItems: "center", gap: GAP.sm, marginBottom: GAP.xs, whiteSpace: "nowrap" }}>
              {icon && <span style={{ fontSize: FONT_SIZE.lg }}>{icon}</span>}
              <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: labelColor || COLOR.text2, letterSpacing: 0.3 }}>{label}</span>
              <span style={{ fontSize: FONT_SIZE.base, color: COLOR.sub, marginLeft: GAP.xs }}>{dr.count} 件</span>
            </div>
            <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap" }}>
              {[
                { label: "高优先", val: highCount, c: COLOR.error },
                { label: "总方案", val: totalVariants, c: COLOR.text4 },
              ].map(it => (
                <div key={it.label} style={{ background: COLOR.borderLt, borderRadius: GAP.md, padding: "5px 9px" }}>
                  <div style={{ fontSize: FONT_SIZE.xs, color: COLOR.sub, letterSpacing: 0.3, marginBottom: 2 }}>{it.label}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, color: it.c }}>{it.val}</div>
                </div>
              ))}
            </div>
            {onViewAll && <div style={{ fontSize: FONT_SIZE.md, color: "#c0b5a5" }}>点击查看全部 ▶</div>}
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

        renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && !fullPanelOpen && (
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
        <div style={{ padding: `${GAP.xl}px 18px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xxl, color: COLOR.text, lineHeight: 1.5 }}>{wo.name}</div>
          <div style={{ display: "flex", gap: GAP.sm, marginTop: GAP.sm, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "2px 7px", background: PRI[wo.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: PRI[wo.priority].c }}>{PRI[wo.priority].l}</span>
            <span style={{ padding: "2px 7px", background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: wo.type === "skill" ? COLOR.brown : COLOR.blue }}>{wo.type === "skill" ? "Skill" : "MCP"}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: "#a89a78" }}>{wo.created}</span>
          </div>
        </div>

        {/* 描述 */}
        {wo.desc && (
          <div style={{ padding: `${GAP.base}px 18px`, borderBottom: "1px solid rgba(0,0,0,0.05)", fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text2, lineHeight: 1.6 }}>
            {wo.desc}
          </div>
        )}

        {/* 方案排名 */}
        <div style={{ padding: `${GAP.lg}px 18px` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.base }}>
            方案概览 ({wo.variants.length})
          </div>
          {ranked.length === 0 ? (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: "#b5a898", padding: `${GAP.md}px 0` }}>暂无方案</div>
          ) : (
            ranked.map((v, i) => (
              <div key={v.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 0", borderBottom: i < ranked.length - 1 ? `1px solid ${COLOR.borderLt}` : "none",
              }}>
                <div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text }}>
                    {i === 0 && v.avg > 0 && <span style={{ marginRight: GAP.xs }}>🥇</span>}
                    {v.name}
                  </div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginTop: 2 }}>
                    {v.uploader} · {v.uploaded}
                  </div>
                </div>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, fontWeight: 500,
                  color: v.avg > 0 ? COLOR.text : COLOR.dim,
                }}>
                  {v.avg > 0 ? v.avg.toFixed(1) : "待测"}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 参与人数 */}
        {testers.size > 0 && (
          <div style={{ padding: `0 18px ${GAP.base}px`, fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub }}>
            {testers.size} 人参与评测
          </div>
        )}

        {/* 展开详情 */}
        <div
          onClick={() => { if (onExpandFull) onExpandFull(wo); }}
          style={{
            padding: `${GAP.lg}px 18px`, borderTop: `1px solid ${COLOR.border}`,
            textAlign: "center", cursor: "pointer",
            fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text5,
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = COLOR.text; e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = COLOR.text5; e.currentTarget.style.background = "transparent"; }}
        >
          展开详情 →
        </div>
      </div>
    </DetailModal>
  );
});
