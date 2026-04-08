import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

/**
 * @param {{ data?: Array<{ date: string, 发布: number }> }} props
 * data 为版本发布按天聚合：[{ date: "04-01", 发布: 5 }, ...]
 */
export default function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: "#b5a898" }}>暂无数据</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.dim, marginTop: GAP.xs }}>
          版本发布趋势将在有数据后显示
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.md }}>
        版本发布趋势
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} />
          <XAxis dataKey="date" tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <YAxis tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <Tooltip contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }} />
          <Line type="monotone" dataKey="发布" stroke={COLOR.warn} strokeWidth={2} dot={{ r: 3, fill: COLOR.warn }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
