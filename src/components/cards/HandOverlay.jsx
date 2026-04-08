import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

export default function HandOverlay({ items, renderCard, onSelect, onClose }) {
  const [phase, setPhase] = useState("stack");
  const [hoverIdx, setHoverIdx] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setPhase("arc"));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = useCallback(() => {
    setPhase("stack");
    setTimeout(onClose, 450);
  }, [onClose]);

  const handleSelect = useCallback((item) => {
    handleClose();
    setTimeout(() => onSelect(item), 300);
  }, [onSelect, handleClose]);

  const onWheel = useCallback(e => {
    if (containerRef.current) {
      e.preventDefault();
      containerRef.current.scrollLeft += e.deltaY * 1.5;
    }
  }, []);

  const N = items.length;
  const centerIdx = (N - 1) / 2;
  const maxAngle = Math.min(N * 2.5, 20);
  const spacing = Math.min(140, 700 / Math.max(N, 1));
  const arcK = Math.min(4, 60 / Math.max(N, 1));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={handleClose} style={{
        position: "absolute", inset: 0,
        background: phase === "arc" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0)",
        backdropFilter: phase === "arc" ? "blur(3px)" : "none",
        transition: "all 0.4s ease",
      }} />
      <div ref={containerRef} onWheel={onWheel} style={{
        position: "relative", marginBottom: "6vh", width: "100%", maxWidth: 900,
        height: 240, display: "flex", justifyContent: "center", alignItems: "flex-end",
        overflowX: N > 5 ? "auto" : "visible", overflowY: "visible",
        scrollbarWidth: "none", msOverflowStyle: "none",
        paddingLeft: N > 5 ? 60 : 0, paddingRight: N > 5 ? 60 : 0,
      }}>
        <div style={{ position: "relative", width: N * spacing, height: 220, flexShrink: 0 }}>
          {items.map((item, i) => {
            const offset = i - centerIdx;
            const normOff = N > 1 ? offset / ((N - 1) / 2) : 0;
            const angle = normOff * maxAngle;
            const yUp = offset * offset * arcK;
            const isHover = hoverIdx === i;
            const x = i * spacing;

            const arcStyle = phase === "arc" ? {
              position: "absolute", left: x, bottom: isHover ? yUp + 50 : yUp,
              transform: `rotate(${isHover ? 0 : angle}deg) scale(${isHover ? 1.18 : 1})`,
              zIndex: isHover ? 200 : 100 - Math.round(Math.abs(offset)),
              filter: isHover ? "drop-shadow(0 12px 24px rgba(0,0,0,0.5))" : "none",
              transition: `all 0.4s cubic-bezier(0.25, 1, 0.5, 1) ${i * 0.04}s`,
            } : {
              position: "absolute", left: "50%", bottom: 0,
              transform: `translateX(-63px) rotate(${(Math.random() - 0.5) * 8}deg) scale(0.85)`,
              zIndex: i,
              opacity: 0.7,
              transition: `all 0.35s cubic-bezier(0.25, 1, 0.5, 1) ${i * 0.03}s`,
            };

            return renderCard(item, i, arcStyle, isHover,
              () => setHoverIdx(i), () => setHoverIdx(null),
              () => handleSelect(item)
            );
          })}
        </div>
      </div>
      {phase === "arc" && (
        <div style={{ position: "absolute", top: GAP.xxl, right: GAP.xxl, zIndex: 1000 }}>
          <button onClick={handleClose} style={{
            background: "rgba(246,241,234,0.1)", border: "1px solid rgba(220,210,195,0.15)",
            borderRadius: GAP.base, padding: `${GAP.md}px 14px`, cursor: "pointer",
            fontSize: FONT_SIZE.base, color: "rgba(220,210,195,0.6)", display: "flex", alignItems: "center", gap: GAP.xs,
            transition: "all 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(246,241,234,0.2)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(246,241,234,0.1)"}
          ><X size={FONT_SIZE.lg} />收起</button>
        </div>
      )}
    </div>
  );
}
