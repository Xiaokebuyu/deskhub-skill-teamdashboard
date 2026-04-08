import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const COLORS = [COLOR.warn, COLOR.blue, COLOR.success, COLOR.brown];

export default function CallTrend({ mcps = [] }) {
  const activeMcps = mcps.filter(m => m.calls > 0 && m.callTrend);

  if (activeMcps.length === 0) {
    return <div style={{ color: '#aaa', fontSize: FONT_SIZE.base, textAlign: 'center', padding: GAP.page }}>调用趋势暂无数据</div>;
  }

  const data = days.map((d, i) => {
    const row = { day: d };
    activeMcps.forEach(m => { row[m.name] = m.callTrend[i] || 0; });
    row["总调用"] = activeMcps.reduce((a, m) => a + (m.callTrend[i] || 0), 0);
    return row;
  });

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.md }}>近 7 天 MCP 调用趋势</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} />
          <XAxis dataKey="day" tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <YAxis tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <Tooltip contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }} />
          {activeMcps.map((m, i) => (
            <Line key={m.id || i} type="monotone" dataKey={m.name} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} />
          ))}
          <Line type="monotone" dataKey="总调用" stroke={COLOR.text} strokeWidth={2} strokeDasharray="4 2" dot={false} />
          <Legend wrapperStyle={{ fontSize: FONT_SIZE.sm, fontFamily: FONT_SANS }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
