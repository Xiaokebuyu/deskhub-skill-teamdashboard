import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";
import { MCPS } from "../../../constants/mock-data.js";

const data = MCPS.filter(m => m.calls > 0).map(m => ({
  name: m.name,
  成功率: m.successRate,
}));

export default function SuccessRate() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>MCP 成功率对比</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5a5550" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }} formatter={v => v + "%"} />
          <ReferenceLine y={95} stroke="#4a8a4a" strokeDasharray="3 3" label={{ value: "95% 基线", fontSize: 10, fill: "#4a8a4a", position: "right" }} />
          <Bar dataKey="成功率" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((d, i) => (
              <Cell key={i} fill={d["成功率"] >= 95 ? "#4a8a4a" : d["成功率"] >= 90 ? "#b8861a" : "#b83a2a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
