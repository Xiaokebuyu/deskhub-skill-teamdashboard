import { FONT_MONO, FONT_SANS } from "../../../constants/theme.js";

// 热门搜索词 mock（将来从 Umami event-data/fields 获取）
const searches = [
  { term: "PPT", count: 342 },
  { term: "翻译", count: 289 },
  { term: "PDF", count: 256 },
  { term: "图片生成", count: 198 },
  { term: "代码", count: 176 },
  { term: "邮件", count: 154 },
  { term: "数据分析", count: 132 },
  { term: "OCR", count: 118 },
  { term: "摘要", count: 97 },
  { term: "Excel", count: 86 },
];

const maxCount = searches[0].count;

export default function HotSearch() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", gap: 24 }}>
      {/* 热门搜索词 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>热门搜索词 Top 10</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {searches.map((s, i) => (
            <div key={s.term} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 11, color: i < 3 ? "#b85c1a" : "#a09888",
                width: 18, textAlign: "right", fontWeight: i < 3 ? 600 : 400,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, position: "relative", height: 20, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0,
                  width: `${(s.count / maxCount) * 100}%`,
                  background: i < 3 ? "rgba(184,92,26,0.15)" : "rgba(0,0,0,0.04)",
                  borderRadius: 4,
                  transition: "width 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                }} />
                <div style={{
                  position: "relative", zIndex: 1,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0 8px", height: 20,
                }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#4a4540" }}>{s.term}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#a09888" }}>{s.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 热门技能 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>热门技能 Top 5</div>
        {[
          { name: "知识库", views: 7200, dl: 1456 },
          { name: "PDF解析", views: 5800, dl: 1102 },
          { name: "代码助手", views: 5100, dl: 723 },
          { name: "图片OCR", views: 4800, dl: 960 },
          { name: "网页摘要", views: 4500, dl: 830 },
        ].map((s, i) => (
          <div key={s.name} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 16, fontWeight: 600,
              color: i === 0 ? "#8a6a3a" : i < 3 ? "#7a6a55" : "#a09888",
              width: 20, textAlign: "center",
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18" }}>{s.name}</div>
              <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888" }}>
                {s.views} 查看 · {s.dl} 下载
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
