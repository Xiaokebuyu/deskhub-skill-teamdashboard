import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, DESK } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import McpCard from "./McpCard.jsx";
import McpDetail from "./McpDetail.jsx";

export default function McpDeskRow({ status, label, labelColor, mcps, onSelect, onViewAll }) {
  const s = status ? MCP_ST[status] : null;
  const displayLabel = label || (s && s.l) || "MCP";
  const displayColor = labelColor || (s && s.c) || "#4a4540";

  const dr = useDeskRow(mcps, m => m.id);

  const totalCalls = mcps.reduce((a, m) => a + (m.calls || 0), 0);

  return (
    <DeskRowShell {...dr} onViewAll={onViewAll}
      renderInfo={() => (
        <div onClick={() => dr.handOpen ? (dr.focusPhase ? null : dr.setHandOpen(false)) : (onViewAll && onViewAll())} style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          left: dr.handOpen ? "100%" : (20 + (Math.min(dr.count, 5) - 1) * 38 + DESK.cardW + 20),
          padding: dr.handOpen ? 0 : "14px 16px", display: "flex", flexDirection: "column",
          justifyContent: "center", gap: 6, cursor: "pointer",
          opacity: dr.handOpen ? 0 : 1, overflow: "hidden",
          transition: "opacity 0.3s, left 0.4s",
          borderLeft: dr.handOpen ? "none" : DESK.infoLeft,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {s && <SIcon s={s} size={16} />}
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: displayColor, letterSpacing: 0.3 }}>{displayLabel}</span>
            <span style={{ fontSize: 13, color: "#a09888", marginLeft: 4 }}>{dr.count} 项</span>
          </div>
          {totalCalls > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "5px 9px" }}>
                <div style={{ fontSize: 10, color: "#a09888", marginBottom: 2 }}>总调用</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 15, color: displayColor }}>{totalCalls.toLocaleString()}</div>
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((m, i) => (
        <McpCard key={m.id} m={m} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(m, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <McpDetail m={dr.focusItem} show={true} onClose={dr.handleDetailClose} />
      )}
    />
  );
}
