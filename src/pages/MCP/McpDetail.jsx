import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import { Link2 } from "lucide-react";
import DetailModal from "../../components/ui/DetailModal.jsx";
import DataCard from "../../components/ui/DataCard.jsx";
import MiniBar from "../../components/ui/MiniBar.jsx";

export default function McpDetail({ m, onClose, show }) {
  if (!m) return null;
  const s = MCP_ST[m.status];
  const weekCalls = m.callTrend ? m.callTrend.reduce((a, b) => a + b, 0) : null;

  const trend = m.callTrend && m.callTrend.length >= 7
    ? { recent: m.callTrend.slice(-3).reduce((a, b) => a + b, 0), prev: m.callTrend.slice(0, 4).reduce((a, b) => a + b, 0) }
    : null;
  const trendDir = trend ? (trend.recent > trend.prev * 0.75 ? "up" : trend.recent < trend.prev * 0.5 ? "down" : "flat") : null;

  return (
    <DetailModal show={show} onClose={onClose} width={380}>
      {/* 标题区 */}
      <div style={{ padding: `${GAP.xl}px 18px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.h2, color: "#2d2418", lineHeight: 1.5, marginBottom: GAP.xs }}>{m.name}</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: "#8a8078", marginBottom: GAP.md }}>{m.slug} · {m.ver}</div>
        <div style={{ display: "flex", gap: GAP.sm, flexWrap: "wrap" }}>
          <span style={{ padding: `3px ${GAP.md}px`, background: s.tagBg + "20", borderRadius: GAP.sm, fontSize: FONT_SIZE.md, fontWeight: 600, color: s.c }}>
            <SIcon s={s} size={FONT_SIZE.sm} /> {s.l}
          </span>
          <span style={{ padding: `3px ${GAP.md}px`, background: "rgba(90,122,154,0.12)", borderRadius: GAP.sm, fontSize: FONT_SIZE.md, color: COLOR.blue }}>MCP</span>
          <span style={{ padding: `3px ${GAP.md}px`, background: COLOR.borderLt, borderRadius: GAP.sm, fontSize: FONT_SIZE.md, color: "#8a7a68" }}>{m.maintainer || '—'}</span>
        </div>
      </div>

      {/* 描述 */}
      <div style={{ padding: `${GAP.base}px 18px`, borderBottom: `1px solid ${COLOR.border}`, fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: "#4a4038", lineHeight: 1.6 }}>
        {m.desc}
      </div>

      {/* 运营数据 */}
      {m.calls > 0 && (
        <div style={{ padding: `${GAP.lg}px 18px`, borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap", marginBottom: GAP.md }}>
            <DataCard label="总调用" value={m.calls.toLocaleString()} />
            {weekCalls != null && <DataCard label="周调用" value={weekCalls.toLocaleString()} trend={trendDir} />}
            <DataCard label="成功率" value={m.successRate + "%"} warn={m.successRate < 90} />
          </div>
          <div style={{ display: "flex", gap: GAP.md }}>
            <DataCard label="响应" value={m.avgResponseTime + "s"} warn={m.avgResponseTime > 3} />
          </div>
        </div>
      )}

      {/* 调用趋势迷你图 */}
      {m.callTrend && m.calls > 0 && (
        <div style={{ padding: `${GAP.base}px 18px`, borderBottom: `1px solid ${COLOR.border}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.text4, marginBottom: GAP.sm }}>近 7 天调用</div>
          <MiniBar data={m.callTrend} color={s.c} />
        </div>
      )}

      {/* 依赖技能 */}
      {m.dependSkills && m.dependSkills.length > 0 && (
        <div style={{ padding: `${GAP.base}px 18px` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.text4, marginBottom: GAP.sm, display: "flex", alignItems: "center", gap: GAP.xs }}>
            <Link2 size={FONT_SIZE.sm} />依赖技能
          </div>
          <div style={{ display: "flex", gap: GAP.xs, flexWrap: "wrap" }}>
            {m.dependSkills.map(sk => (
              <span key={sk} style={{
                padding: `3px ${GAP.md}px`, borderRadius: GAP.sm,
                background: "rgba(138,106,58,0.1)", color: COLOR.brown,
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.md,
              }}>
                {sk}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 规划中提示 */}
      {m.calls === 0 && (
        <div style={{ padding: `${GAP.xl}px 18px`, textAlign: "center", fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: "#b5a898" }}>
          尚未上线，暂无运营数据
        </div>
      )}
    </DetailModal>
  );
}
