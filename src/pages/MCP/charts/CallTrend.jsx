import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";
import { MCPS } from "../../../constants/mock-data.js";

// 合并所有 MCP 的 7 天调用趋势
const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const activeMcps = MCPS.filter(m => m.calls > 0);
const data = days.map((d, i) => {
  const row = { day: d };
  activeMcps.forEach(m => { row[m.name] = m.callTrend[i] || 0; });
  row["总调用"] = activeMcps.reduce((a, m) => a + (m.callTrend[i] || 0), 0);
  return row;
});

const COLORS = ["#b85c1a", "#5a7a9a", "#4a8a4a", "#8a6a3a"];

export default function CallTrend() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>近 7 天 MCP 调用趋势</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }} />
          {activeMcps.map((m, i) => (
            <Line key={m.id} type="monotone" dataKey={m.name} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} />
          ))}
          <Line type="monotone" dataKey="总调用" stroke="#3a2a18" strokeWidth={2} strokeDasharray="4 2" dot={false} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: FONT_SANS }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
