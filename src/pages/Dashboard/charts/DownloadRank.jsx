import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

const COLORS = [COLOR.warn, "#c4763a", "#d4905a", "#d4a87a", "#c4b89a", "#b0a890", COLOR.sub, "#909080", "#808878", "#708070"];

/**
 * @param {{ skills?: Array<{ name: string, dl: number }> }} props
 * 接收 skills 数组，内部排序取 Top 10
 */
/** 截断显示名：去括号内容，超 6 字截断 */
function shortName(name) {
  const clean = (name || '').replace(/[（(].+?[)）]/g, '').trim();
  return clean.length > 6 ? clean.slice(0, 6) + '…' : clean;
}

export default function DownloadRank({ skills = [] }) {
  const data = [...skills]
    .sort((a, b) => (b.dl || 0) - (a.dl || 0))
    .slice(0, 10)
    .map(s => ({ name: s.name, short: shortName(s.name), 下载量: s.dl || 0 }));

  if (data.length === 0) {
    return <div style={{ color: '#aaa', fontSize: FONT_SIZE.base, textAlign: 'center', padding: GAP.page }}>暂无数据</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.md }}>下载量 Top 10</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.sub }} axisLine={{ stroke: COLOR.borderMd }} />
          <YAxis type="category" dataKey="short" tick={{ fontSize: FONT_SIZE.sm, fill: COLOR.text3 }} width={72} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: COLOR.bgWhite, border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.md, fontSize: FONT_SIZE.md, fontFamily: FONT_SANS }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
          />
          <Bar dataKey="下载量" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
