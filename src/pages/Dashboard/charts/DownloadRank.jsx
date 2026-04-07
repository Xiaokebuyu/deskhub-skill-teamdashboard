import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";
import { SKILLS } from "../../../constants/mock-data.js";

// Top 10 下载量
const data = [...SKILLS]
  .sort((a, b) => b.dl - a.dl)
  .slice(0, 10)
  .map(s => ({ name: s.name, 下载量: s.dl }));

const COLORS = ["#b85c1a", "#c4763a", "#d4905a", "#d4a87a", "#c4b89a", "#b0a890", "#a09888", "#909080", "#808878", "#708070"];

export default function DownloadRank() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>下载量 Top 10</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#5a5550" }} width={72} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }}
          />
          <Bar dataKey="下载量" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
