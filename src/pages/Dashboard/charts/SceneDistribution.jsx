import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

const CAT_COLORS = [COLOR.warn, COLOR.blue];
const SRC_COLORS = [COLOR.brown, "#5a8a5a", "#7a6a9a", "#9a6a6a", "#6a8a9a"];

/**
 * @param {{ skills?: Array<{ cat: string, source: string }> }} props
 * 接收 skills 数组，内部聚合 cat 和 source 分布
 */
export default function SceneDistribution({ skills = [] }) {
  if (skills.length === 0) {
    return <div style={{ color: '#aaa', fontSize: FONT_SIZE.base, textAlign: 'center', padding: GAP.page }}>暂无数据</div>;
  }

  // 按 cat 分布
  const catCount = {};
  skills.forEach(s => { const c = s.cat || 'unknown'; catCount[c] = (catCount[c] || 0) + 1; });
  const catData = Object.entries(catCount).map(([k, v]) => ({ name: k === "skill" ? "Skill" : k === "mcp" ? "MCP" : k, value: v }));

  // 按 source 分布
  const srcCount = {};
  skills.forEach(s => { const src = s.source || '未知'; srcCount[src] = (srcCount[src] || 0) + 1; });
  const srcData = Object.entries(srcCount).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div style={{ width: "100%", height: 220, display: "flex", gap: GAP.xxl }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.xs, textAlign: "center" }}>类型分布</div>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={catData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
              {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }} />
            <Legend wrapperStyle={{ fontSize: FONT_SIZE.sm, fontFamily: FONT_SANS }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.xs, textAlign: "center" }}>来源分布</div>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={srcData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
              {srcData.map((_, i) => <Cell key={i} fill={SRC_COLORS[i % SRC_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }} />
            <Legend wrapperStyle={{ fontSize: FONT_SIZE.sm, fontFamily: FONT_SANS }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
