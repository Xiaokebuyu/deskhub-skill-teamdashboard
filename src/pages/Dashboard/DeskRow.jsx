import { ST } from "../../constants/status.js";
import { FONT_MONO, DESK, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import SkillCard from "./SkillCard.jsx";
import SkillDetail from "./SkillDetail.jsx";

export default function DeskRow({ status, label, labelColor, skills, onSelect, onViewAll }) {
  // 支持新的 label/labelColor 直传，向后兼容 status 查找
  const s = status ? ST[status] : null;
  const displayLabel = label || (s && s.l) || "未知";
  const displayColor = labelColor || (s && s.c) || COLOR.text2;

  const sorted = [...skills].sort((a, b) => b.updated.localeCompare(a.updated));
  const dr = useDeskRow(sorted, sk => sk.slug);

  const totalIters = skills.reduce((a, b) => a + b.iters, 0);
  const totalDl = skills.reduce((a, b) => a + b.dl, 0);
  const totalViews = skills.reduce((a, b) => a + b.views, 0);
  const latest = sorted[0];

  return (
    <DeskRowShell {...dr} onViewAll={onViewAll}
      renderInfo={() => (
        <div onClick={() => dr.handOpen ? (dr.focusPhase ? null : dr.setHandOpen(false)) : onViewAll()} style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          left: dr.handOpen ? "100%" : (20 + (Math.min(dr.count, 5) - 1) * 38 + DESK.cardW + 20),
          padding: dr.handOpen ? 0 : `${FONT_SIZE.lg}px ${FONT_SIZE.xxl}px`, display: "flex", flexDirection: "column",
          justifyContent: "center", gap: GAP.sm, cursor: "pointer",
          opacity: dr.handOpen ? 0 : 1, overflow: "hidden",
          transition: "opacity 0.3s, left 0.4s",
          borderLeft: dr.handOpen ? "none" : DESK.infoLeft,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: GAP.sm, marginBottom: GAP.xs, whiteSpace: "nowrap" }}>
            {s && <SIcon s={s} size={FONT_SIZE.xxl} />}
            <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: displayColor, letterSpacing: 0.3 }}>{displayLabel}</span>
            <span style={{ fontSize: FONT_SIZE.base, color: COLOR.sub, marginLeft: GAP.xs }}>{dr.count} 件技能</span>
          </div>
          <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap" }}>
            {[{ label: "总迭代", val: totalIters, c: displayColor }, { label: "下载量", val: totalDl, c: COLOR.text4 }, { label: "查看数", val: totalViews, c: COLOR.text4 }].map(it => (
              <div key={it.label} style={{ background: COLOR.borderLt, borderRadius: GAP.md, padding: "5px 9px" }}>
                <div style={{ fontSize: FONT_SIZE.xs, color: COLOR.sub, letterSpacing: 0.3, marginBottom: 2 }}>{it.label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, color: it.c }}>{it.val}</div>
              </div>
            ))}
          </div>
          {latest && <div style={{ fontSize: FONT_SIZE.base, color: "#b5a898", marginTop: 2, whiteSpace: "nowrap" }}>最近: {latest.name} ({latest.updated})</div>}
          <div style={{ fontSize: FONT_SIZE.md, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((sk, i) => (
        <SkillCard key={sk.slug} sk={sk} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(sk, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <SkillDetail sk={dr.focusItem} show={true} onClose={dr.handleDetailClose} />
      )}
    />
  );
}
