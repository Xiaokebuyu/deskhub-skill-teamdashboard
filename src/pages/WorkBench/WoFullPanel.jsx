import { useState } from "react";
import { Plus } from "lucide-react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { PRI } from "../../constants/priority.js";
import { PLAN_ST } from "../../constants/status.js";
import { avgScore } from "../../utils/helpers.js";
import FullPanel from "../../components/ui/FullPanel.jsx";
import Accordion from "../../components/ui/Accordion.jsx";
import ComparisonTable from "./ComparisonTable.jsx";
import ScoreForm from "./ScoreForm.jsx";

/**
 * 第三层完整面板 — Container Transform 展开后的内容
 */
export default function WoFullPanel({ wo, dims, show, originRect, onClose, onUpdate, role, onAddVariant, onMarkComplete }) {
  const [expandedVar, setExpandedVar] = useState(null);
  const activeDims = (dims || []).filter(d => d.active);

  if (!wo) return null;

  const st = PLAN_ST[wo.status];

  // 构建 Accordion items
  const accordionItems = wo.variants.map(v => {
    const avg = avgScore(v, activeDims);

    return {
      key: v.id,
      header: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#3a2a18" }}>{v.name}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginLeft: 8 }}>
              {v.uploader} · {v.uploaded}
            </span>
          </div>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 13,
            color: avg > 0 ? "#3a2a18" : "#c4bfb5",
          }}>
            {avg > 0 ? avg.toFixed(1) : "待测"}
          </span>
        </div>
      ),
      content: (
        <div>
          {/* 方案说明 */}
          {v.desc && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540", lineHeight: 1.6, marginBottom: 10 }}>
              {v.desc}
            </div>
          )}

          {/* 附件链接 */}
          {v.link && (
            <div style={{ marginBottom: 10 }}>
              <a href={v.link} target="_blank" rel="noopener noreferrer" style={{
                fontFamily: FONT_SANS, fontSize: 12, color: "#5a7a9a",
                textDecoration: "none", borderBottom: "1px dashed #5a7a9a",
              }}>
                方案文档 ↗
              </a>
            </div>
          )}

          {/* 评分记录 */}
          {v.scores && v.scores.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6 }}>评分记录</div>
              {groupScoresByTester(v.scores, activeDims).map((record, idx) => (
                <div key={idx} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.03)",
                  fontSize: 12, fontFamily: FONT_SANS,
                }}>
                  <span style={{ color: "#3a2a18", fontWeight: 500, minWidth: 36 }}>{record.tester}</span>
                  <span style={{ color: "#a09888", minWidth: 40 }}>{record.date}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                    {record.dims.map(ds => (
                      <span key={ds.dimId} style={{ color: "#5a5550" }}>
                        {ds.dimName} {ds.value}
                      </span>
                    ))}
                  </div>
                  {record.comment && <span style={{ color: "#8a7a62", fontStyle: "italic" }}>"{record.comment}"</span>}
                </div>
              ))}
            </div>
          )}

          {/* 评分表单 */}
          <ScoreForm
            variant={v}
            dims={dims}
            role={role}
            onSubmit={scoreEntries => {
              if (!onUpdate) return;
              const updated = {
                ...wo,
                variants: wo.variants.map(vv =>
                  vv.id === v.id ? { ...vv, scores: [...(vv.scores || []), ...scoreEntries] } : vv
                ),
              };
              onUpdate(updated);
            }}
          />
        </div>
      ),
    };
  });

  return (
    <FullPanel show={show} onClose={onClose} originRect={originRect}>
      {/* Header — 标题 + 右上角操作按钮 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, color: "#3a2a18", marginBottom: 8 }}>{wo.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "3px 8px", background: PRI[wo.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: PRI[wo.priority].c }}>{PRI[wo.priority].l}</span>
            {st && <span style={{ padding: "3px 8px", background: st.tagBg + "30", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: st.c }}>{st.l}</span>}
            <span style={{ padding: "3px 8px", background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: wo.type === "skill" ? "#8a6a3a" : "#5a7a9a" }}>{wo.type === "skill" ? "Skill" : "MCP"}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a89a78" }}>{wo.created}</span>
          </div>
          {wo.desc && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#4a4540", lineHeight: 1.6, marginTop: 10 }}>
              {wo.desc}
            </div>
          )}
        </div>
        {/* 右上角操作按钮 */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
          {(role === "admin" || role === "member") && wo.status === "active" && (
            <button onClick={() => onAddVariant && onAddVariant(wo)} style={btnStyle}>
              <Plus size={13} style={{ marginRight: 4 }} />添加方案
            </button>
          )}
          {role === "admin" && wo.status === "active" && (
            <button onClick={() => onMarkComplete && onMarkComplete(wo)} style={{ ...btnStyle, background: "rgba(74,138,74,0.1)", color: "#4a8a4a", border: "1px solid rgba(74,138,74,0.2)" }}>
              标记完成
            </button>
          )}
        </div>
      </div>

      {/* 对比表 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#5a5550", marginBottom: 8 }}>方案对比</div>
        <ComparisonTable variants={wo.variants} dims={dims} />
      </div>

      {/* 方案详情 Accordion */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#5a5550", marginBottom: 8 }}>
          方案详情 ({wo.variants.length})
        </div>
        {wo.variants.length > 0 ? (
          <Accordion
            items={accordionItems}
            expandedKey={expandedVar}
            onToggle={key => setExpandedVar(prev => prev === key ? null : key)}
          />
        ) : (
          <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898", padding: "8px 0" }}>暂无方案</div>
        )}
      </div>

    </FullPanel>
  );
}

const btnStyle = {
  padding: "6px 14px", borderRadius: 8, cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
  fontSize: 13, border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(0,0,0,0.04)", color: "#4a4540",
  display: "flex", alignItems: "center",
  transition: "all 0.15s",
};

/** 按测试员+日期分组评分记录 */
function groupScoresByTester(scores, activeDims) {
  const groups = {};
  scores.forEach(s => {
    const key = `${s.tester}-${s.date}`;
    if (!groups[key]) groups[key] = { tester: s.tester, date: s.date, comment: s.comment || "", dims: [] };
    const dim = activeDims.find(d => d.id === s.dimId);
    if (dim) groups[key].dims.push({ dimId: s.dimId, dimName: dim.name, value: s.value });
    if (s.comment) groups[key].comment = s.comment;
  });
  return Object.values(groups);
}
