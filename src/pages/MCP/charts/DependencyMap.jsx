import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../../constants/theme.js";

/** MCP → Skill 依赖关系图（简化为列表展示） */
export default function DependencyMap({ mcps = [] }) {
  const withDeps = mcps.filter(m => m.dependSkills && m.dependSkills.length > 0);

  if (withDeps.length === 0) {
    return <div style={{ color: '#aaa', fontSize: FONT_SIZE.base, textAlign: 'center', padding: GAP.page }}>依赖关系暂无数据</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text4, marginBottom: GAP.base }}>MCP 依赖技能关系</div>
      <div style={{ display: "flex", flexDirection: "column", gap: GAP.md }}>
        {withDeps.map((m, i) => (
          <div key={m.id || i} style={{
            display: "flex", alignItems: "center", gap: GAP.base,
            padding: `${GAP.md}px 0`, borderBottom: `1px solid ${COLOR.borderLt}`,
          }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500,
              minWidth: 80, flexShrink: 0,
            }}>
              {m.name}
            </div>
            <div style={{ color: COLOR.dim, fontSize: FONT_SIZE.md }}>→</div>
            <div style={{ display: "flex", gap: GAP.xs, flexWrap: "wrap", flex: 1 }}>
              {m.dependSkills.map(sk => (
                <span key={sk} style={{
                  padding: `2px ${GAP.md}px`, borderRadius: 5,
                  background: "rgba(138,106,58,0.1)", color: COLOR.brown,
                  fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm,
                }}>
                  {sk}
                </span>
              ))}
            </div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.sub, flexShrink: 0,
            }}>
              {m.dependSkills.length} 项
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
