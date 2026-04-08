import { ST } from "../../constants/status.js";
import { FONT_MONO, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BaseCard from "../../components/cards/BaseCard.jsx";

const FALLBACK_ST = { l: "未标注", c: COLOR.sub, tagBg: "#c4c0b8", Icon: null };

export default function SkillCard({ sk, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const s = ST[sk.status] || FALLBACK_ST;
  const pct = Math.round((sk.iters || 0) / 25 * 100);
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.btn, lineHeight: 1.7, marginBottom: GAP.sm, letterSpacing: 0.3 }}>{sk.name}</div>
      <div style={{ display: "flex", gap: 5, marginBottom: GAP.md, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ padding: "2px 6px", background: s.tagBg + "25", borderRadius: 5, fontSize: FONT_SIZE.sm, fontWeight: 600, color: s.c, letterSpacing: 0.3 }}><SIcon s={s} size={FONT_SIZE.md} /> {s.l}</span>
        <span style={{ fontSize: FONT_SIZE.sm, color: "#8a8078", letterSpacing: 0.2 }}>{sk.ver}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: GAP.sm }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 24, color: s.c, lineHeight: 1 }}>x{sk.iters || 0}</span>
        <span style={{ fontSize: FONT_SIZE.xs, color: "#a09890", letterSpacing: 0.3 }}>迭代</span>
      </div>
      <div style={{ height: 3, background: "rgba(0,0,0,0.05)", borderRadius: 2, overflow: "hidden", marginBottom: GAP.md }}>
        <div style={{ height: "100%", width: pct + "%", borderRadius: 2, background: s.tagBg, opacity: 0.7 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: "#b0a898" }}>
        <span>{sk.source || '—'}</span>
        <span>{sk.updated}</span>
      </div>
    </BaseCard>
  );
}
