import BaseCard from "../../components/cards/BaseCard.jsx";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

/**
 * 统一工单卡片 — 轻量信息（子阶段/优先级由 desk row 标题承载）
 * 显示：标题、类型标签、方案数+评测进度、日期
 */
export default function WoCard({ wo, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const pri = PRI[wo.priority];
  const vCount = wo.variants.length;
  const scored = wo.variants.filter(v => v.scores && v.scores.length > 0).length;

  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      {/* 标题 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text,
        lineHeight: 1.5, marginBottom: GAP.sm, minHeight: 36,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {wo.name}
      </div>

      {/* 类型 + 优先级 */}
      <div style={{ display: "flex", gap: GAP.xs, marginBottom: GAP.md, flexWrap: "wrap" }}>
        <span style={{
          padding: "1px 5px", borderRadius: 4,
          fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs,
          background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)",
          color: wo.type === "skill" ? COLOR.brown : COLOR.blue,
        }}>
          {wo.type === "skill" ? "Skill" : "MCP"}
        </span>
        <span style={{
          padding: "1px 5px", borderRadius: 4,
          fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs,
          background: pri.bg, color: pri.c,
        }}>
          {pri.l}
        </span>
      </div>

      {/* 方案数 + 评测进度 */}
      <div style={{
        fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.text4,
        marginBottom: GAP.xs,
      }}>
        方案 {vCount}{vCount > 0 && <span style={{ marginLeft: GAP.md }}>评测 {scored}/{vCount}</span>}
      </div>

      {/* 日期 */}
      <div style={{
        fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: "#b5a898",
        textAlign: "right",
      }}>
        {wo.created}
      </div>
    </BaseCard>
  );
}
