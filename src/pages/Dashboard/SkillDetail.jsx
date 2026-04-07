import { ST } from "../../constants/status.js";
import { INIT_PLANS } from "../../constants/mock-data.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import { GitCommit, ClipboardList } from "lucide-react";
import DetailModal from "../../components/ui/DetailModal.jsx";
import DataCard from "../../components/ui/DataCard.jsx";
import MiniBar from "../../components/ui/MiniBar.jsx";

export default function SkillDetail({ sk, onClose, show }) {
  if (!sk) return null;
  const s = ST[sk.status];

  // 下载趋势判断
  const trend = sk.dlTrend && sk.dlTrend.length >= 7
    ? { recent: sk.dlTrend.slice(-3).reduce((a, b) => a + b, 0), prev: sk.dlTrend.slice(0, 4).reduce((a, b) => a + b, 0) }
    : null;
  const trendDir = trend ? (trend.recent > trend.prev * 0.75 ? "up" : trend.recent < trend.prev * 0.5 ? "down" : "flat") : null;
  const weekDl = sk.dlTrend ? sk.dlTrend.reduce((a, b) => a + b, 0) : null;

  // 关联工单
  const relatedPlan = sk.relatedPlanId ? INIT_PLANS.find(p => p.id === sk.relatedPlanId) : null;

  return (
    <DetailModal show={show} onClose={onClose} width={380}>
      {/* 标题区 */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 17, color: "#2d2418", lineHeight: 1.5, marginBottom: 4 }}>{sk.name}</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#8a8078", marginBottom: 8 }}>{sk.slug} · {sk.ver}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 8px", background: s.tagBg + "20", borderRadius: 6, fontSize: 12, fontWeight: 600, color: s.c }}>
            <SIcon s={s} size={11} /> {s.l}
          </span>
          <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, fontSize: 12, color: sk.cat === "mcp" ? "#5a7a9a" : "#7a7a60" }}>
            {sk.cat === "mcp" ? "MCP" : "Skill"}
          </span>
          <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, fontSize: 12, color: "#8a7a68" }}>{sk.source}</span>
        </div>
      </div>

      {/* 描述 */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 14, color: "#4a4038", lineHeight: 1.6 }}>
        {sk.desc}
      </div>

      {/* 核心数据 */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DataCard label="总下载" value={sk.dl} />
          <DataCard label="总查看" value={sk.views} />
          {weekDl !== null && <DataCard label="周下载" value={weekDl} trend={trendDir} />}
        </div>
      </div>

      {/* 运营指标 */}
      {(sk.successRate || sk.userRating) && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sk.successRate != null && <DataCard label="成功率" value={sk.successRate + "%"} warn={sk.successRate < 90} />}
            {sk.avgResponseTime != null && <DataCard label="响应" value={sk.avgResponseTime + "s"} warn={sk.avgResponseTime > 5} />}
            {sk.userRating != null && <DataCard label="评分" value={sk.userRating + "/5"} />}
            {sk.weeklyActiveUsers != null && <DataCard label="周活" value={sk.weeklyActiveUsers} />}
            {sk.searchHits != null && <DataCard label="搜索" value={sk.searchHits} />}
          </div>
        </div>
      )}

      {/* 下载趋势迷你图 */}
      {sk.dlTrend && (
        <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6 }}>近 7 天下载</div>
          <MiniBar data={sk.dlTrend} color={s.c} />
        </div>
      )}

      {/* 版本变更历史 */}
      {sk.changelog && sk.changelog.length > 0 && (
        <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <GitCommit size={11} />最近更新
          </div>
          {sk.changelog.map((c, i) => (
            <div key={i} style={{
              padding: "6px 0",
              borderBottom: i < sk.changelog.length - 1 ? "1px solid rgba(0,0,0,0.03)" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#3a2a18", fontWeight: 500 }}>{c.ver}</span>
                <span style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888" }}>{c.date}</span>
              </div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#5a5550", lineHeight: 1.5 }}>{c.summary}</div>
            </div>
          ))}
        </div>
      )}

      {/* 关联工单 */}
      {relatedPlan && (
        <div style={{ padding: "10px 18px" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <ClipboardList size={11} />关联工单
          </div>
          <div style={{
            padding: "8px 10px", borderRadius: 8,
            background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)",
          }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18", fontWeight: 500 }}>{relatedPlan.name}</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginTop: 2 }}>
              {relatedPlan.status === "active" ? "进行中" : relatedPlan.status === "next" ? "下期规划" : "已完成"}
              {relatedPlan.variants.length > 0 && ` · ${relatedPlan.variants.length} 个方案`}
            </div>
          </div>
        </div>
      )}
    </DetailModal>
  );
}

