import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";

// 近 14 天迭代趋势 mock 数据
const data = [
  { date: "03-25", 新增: 3, 更新: 8 },
  { date: "03-26", 新增: 1, 更新: 5 },
  { date: "03-27", 新增: 4, 更新: 12 },
  { date: "03-28", 新增: 2, 更新: 7 },
  { date: "03-29", 新增: 5, 更新: 15 },
  { date: "03-30", 新增: 1, 更新: 6 },
  { date: "03-31", 新增: 3, 更新: 9 },
  { date: "04-01", 新增: 6, 更新: 18 },
  { date: "04-02", 新增: 2, 更新: 11 },
  { date: "04-03", 新增: 4, 更新: 14 },
  { date: "04-04", 新增: 3, 更新: 10 },
  { date: "04-05", 新增: 7, 更新: 20 },
  { date: "04-06", 新增: 2, 更新: 8 },
  { date: "04-07", 新增: 5, 更新: 16 },
];

export default function TrendChart() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>近 14 天迭代趋势</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }}
          />
          <Line type="monotone" dataKey="更新" stroke="#b85c1a" strokeWidth={2} dot={{ r: 3, fill: "#b85c1a" }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="新增" stroke="#4a8a4a" strokeWidth={2} dot={{ r: 3, fill: "#4a8a4a" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
