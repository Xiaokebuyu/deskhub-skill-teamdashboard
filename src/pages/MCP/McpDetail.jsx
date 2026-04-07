import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
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
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 17, color: "#2d2418", lineHeight: 1.5, marginBottom: 4 }}>{m.name}</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#8a8078", marginBottom: 8 }}>{m.slug} · {m.ver}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 8px", background: s.tagBg + "20", borderRadius: 6, fontSize: 12, fontWeight: 600, color: s.c }}>
            <SIcon s={s} size={11} /> {s.l}
          </span>
          <span style={{ padding: "3px 8px", background: "rgba(90,122,154,0.12)", borderRadius: 6, fontSize: 12, color: "#5a7a9a" }}>MCP</span>
          <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, fontSize: 12, color: "#8a7a68" }}>{m.maintainer}</span>
        </div>
      </div>

      {/* 描述 */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 14, color: "#4a4038", lineHeight: 1.6 }}>
        {m.desc}
      </div>

      {/* 运营数据 */}
      {m.calls > 0 && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <DataCard label="总调用" value={m.calls.toLocaleString()} />
            {weekCalls != null && <DataCard label="周调用" value={weekCalls.toLocaleString()} trend={trendDir} />}
            <DataCard label="成功率" value={m.successRate + "%"} warn={m.successRate < 90} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <DataCard label="响应" value={m.avgResponseTime + "s"} warn={m.avgResponseTime > 3} />
          </div>
        </div>
      )}

      {/* 调用趋势迷你图 */}
      {m.callTrend && m.calls > 0 && (
        <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6 }}>近 7 天调用</div>
          <MiniBar data={m.callTrend} color={s.c} />
        </div>
      )}

      {/* 依赖技能 */}
      {m.dependSkills && m.dependSkills.length > 0 && (
        <div style={{ padding: "10px 18px" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <Link2 size={11} />依赖技能
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {m.dependSkills.map(sk => (
              <span key={sk} style={{
                padding: "3px 8px", borderRadius: 6,
                background: "rgba(138,106,58,0.1)", color: "#8a6a3a",
                fontFamily: FONT_SANS, fontSize: 12,
              }}>
                {sk}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 规划中提示 */}
      {m.calls === 0 && (
        <div style={{ padding: "16px 18px", textAlign: "center", fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898" }}>
          尚未上线，暂无运营数据
        </div>
      )}
    </DetailModal>
  );
}
