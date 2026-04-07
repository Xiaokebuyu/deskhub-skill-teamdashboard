import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";
import { SKILLS } from "../../../constants/mock-data.js";

// 按 cat 分布
const catCount = {};
SKILLS.forEach(s => { catCount[s.cat] = (catCount[s.cat] || 0) + 1; });

// 按 source 分布
const srcCount = {};
SKILLS.forEach(s => { srcCount[s.source] = (srcCount[s.source] || 0) + 1; });

const catData = Object.entries(catCount).map(([k, v]) => ({ name: k === "skill" ? "Skill" : "MCP", value: v }));
const srcData = Object.entries(srcCount).map(([k, v]) => ({ name: k, value: v }));

const CAT_COLORS = ["#b85c1a", "#5a7a9a"];
const SRC_COLORS = ["#8a6a3a", "#5a8a5a", "#7a6a9a"];

export default function SceneDistribution() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", gap: 20 }}>
      {/* 类型分布 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 4, textAlign: "center" }}>类型分布</div>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={catData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
              {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: FONT_SANS }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* 来源分布 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 4, textAlign: "center" }}>来源分布</div>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={srcData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3} strokeWidth={0}>
              {srcData.map((_, i) => <Cell key={i} fill={SRC_COLORS[i % SRC_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: FONT_SANS }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
