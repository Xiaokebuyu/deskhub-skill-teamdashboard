import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function McpCard({ m, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const s = MCP_ST[m.status];
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ display: "flex", alignItems: "center", gap: GAP.xs, marginBottom: GAP.xs }}>
        <SIcon s={s} size={FONT_SIZE.sm} />
        <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text, lineHeight: 1.5 }}>{m.name}</span>
      </div>
      <div style={{ display: "flex", gap: GAP.xs, marginBottom: 5 }}>
        <span style={{ padding: "1px 4px", background: "rgba(0,0,0,0.05)", borderRadius: GAP.xs, fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: s.c }}>{s.l}</span>
        <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: "#9a8a68" }}>{m.ver}</span>
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text2, lineHeight: 1.3, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.desc}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: "#9a8a68", marginBottom: 2 }}>维护: {m.maintainer || '—'}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: "#a89a78", textAlign: "right" }}>{m.updated}</div>
    </BaseCard>
  );
}
