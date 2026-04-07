import { FONT_MONO, FONT_SANS } from "../../../constants/theme.js";
import { MCPS } from "../../../constants/mock-data.js";

/** MCP → Skill 依赖关系图（简化为列表展示） */
export default function DependencyMap() {
  const withDeps = MCPS.filter(m => m.dependSkills && m.dependSkills.length > 0);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 10 }}>MCP 依赖技能关系</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {withDeps.map(m => (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 13, color: "#3a2a18", fontWeight: 500,
              minWidth: 80, flexShrink: 0,
            }}>
              {m.name}
            </div>
            <div style={{ color: "#c4bfb5", fontSize: 12 }}>→</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {m.dependSkills.map(sk => (
                <span key={sk} style={{
                  padding: "2px 8px", borderRadius: 5,
                  background: "rgba(138,106,58,0.1)", color: "#8a6a3a",
                  fontFamily: FONT_SANS, fontSize: 11,
                }}>
                  {sk}
                </span>
              ))}
            </div>
            <div style={{
              fontFamily: FONT_MONO, fontSize: 12, color: "#a09888", flexShrink: 0,
            }}>
              {m.dependSkills.length} 项
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
