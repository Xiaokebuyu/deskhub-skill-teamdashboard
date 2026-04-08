import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

export default function SuccessRate({ mcps = [] }) {
  const data = mcps.filter(m => m.calls > 0 && m.successRate != null).map(m => ({
    name: m.name, 成功率: m.successRate,
  }));

  if (data.length === 0) {
    return <div style={{ color: '#aaa', fontSize: FONT_SIZE.base, textAlign: 'center', padding: GAP.page }}>成功率暂无数据</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.md }}>MCP 成功率对比</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.text3 }} axisLine={{ stroke: COLOR.borderMd }} />
          <YAxis domain={[80, 100]} tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <Tooltip contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }} formatter={v => v + "%"} />
          <ReferenceLine y={95} stroke={COLOR.success} strokeDasharray="3 3" label={{ value: "95% 基线", fontSize: FONT_SIZE.xs, fill: COLOR.success, position: "right" }} />
          <Bar dataKey="成功率" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((d, i) => (
              <Cell key={i} fill={d["成功率"] >= 95 ? COLOR.success : d["成功率"] >= 90 ? "#b8861a" : COLOR.error} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
