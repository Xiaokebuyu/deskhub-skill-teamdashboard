import { X } from "lucide-react";
import { DESK, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

export default function DeskRowShell({ deskRef, handOpen, setHandOpen, focusPhase, handExtra, onViewAll, renderInfo, renderCards, renderDetail }) {
  return (
    <div style={{ marginBottom: GAP.lg, position: "relative", zIndex: handOpen ? 50 : 1 }}>
      {handOpen && <div onClick={() => { if (!focusPhase) setHandOpen(false); }} style={{ position: "fixed", inset: 0, background: COLOR.borderLt, zIndex: 40 }} />}

      <div ref={deskRef} style={{
        position: "relative", height: DESK.height, zIndex: handOpen ? 45 : 1,
        background: DESK.bg,
        borderRadius: DESK.radius,
        border: handOpen ? DESK.borderOpen : DESK.borderClosed,
        boxShadow: handOpen ? DESK.shadowOpen : DESK.shadowClosed,
        overflow: handOpen ? "visible" : "hidden",
        transition: "all 0.3s ease",
      }}>
        {DESK.lines.map((y, i) => (<div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: 1, background: "rgba(0,0,0,0.03)" }} />))}

        {/* 信息区 */}
        {renderInfo()}

        {/* 卡片 */}
        {renderCards()}

        {/* 底部按钮 */}
        {handOpen && !focusPhase && (
          <div style={{ position: "absolute", bottom: GAP.md, right: GAP.lg, display: "flex", gap: GAP.md, zIndex: 210 }}>
            {handExtra > 0 && (
              <button onClick={e => { e.stopPropagation(); setHandOpen(false); onViewAll(); }} style={{
                background: COLOR.border, border: `1px solid ${COLOR.border}`, borderRadius: GAP.md,
                padding: `${GAP.xs}px ${GAP.base}px`, cursor: "pointer", fontSize: FONT_SIZE.md, color: "#6a5a45",
              }}>还有 {handExtra} 张 →</button>
            )}
            <button onClick={e => { e.stopPropagation(); setHandOpen(false); }} style={{
              background: COLOR.border, border: `1px solid ${COLOR.border}`, borderRadius: GAP.md,
              padding: `${GAP.xs}px ${GAP.base}px`, cursor: "pointer", fontSize: FONT_SIZE.md, color: "#8a7a65",
            }}><X size={FONT_SIZE.md} style={{ verticalAlign: "middle" }} /> 收起</button>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {renderDetail()}
    </div>
  );
}
