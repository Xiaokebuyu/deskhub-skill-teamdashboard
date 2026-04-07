import { useState, useEffect, useRef, useCallback } from "react";
import { DESK } from "../constants/theme.js";

export default function useDeskRow(items, getKey) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [handOpen, setHandOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(null);
  const [focusPhase, setFocusPhase] = useState(null);
  const [focusItem, setFocusItem] = useState(null);

  const deskRef = useRef(null);
  const [deskW, setDeskW] = useState(700);
  const offsets = useRef({});

  // Generate random offsets for stacked cards
  items.slice(0, DESK.maxHand).forEach(item => {
    const k = getKey(item);
    if (!offsets.current[k]) offsets.current[k] = {
      rx: (Math.random() - 0.5) * 6,
      ry: (Math.random() - 0.5) * 4,
      rot: (Math.random() - 0.5) * 10,
    };
  });

  // Track container width
  useEffect(() => {
    const measure = () => { if (deskRef.current) setDeskW(deskRef.current.getBoundingClientRect().width); };
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Layout calculations
  const handCards = items.slice(0, DESK.maxHand);
  const handExtra = items.length - DESK.maxHand;
  const HN = handCards.length;
  const maxSpread = deskW - DESK.cardW - 40;
  const spacing = HN > 1 ? Math.min(maxSpread / (HN - 1), 110) : 0;
  const totalW = HN > 1 ? spacing * (HN - 1) + DESK.cardW : DESK.cardW;
  const startX = (deskW - totalW) / 2;
  const hCenter = (HN - 1) / 2;
  const maxAngle = Math.min(HN * 2.5, 16);
  const arcK = Math.min(2.5, 30 / Math.max(HN, 1));

  // Focus animation
  const handleCardFocus = useCallback((item, i) => {
    if (focusPhase) return;
    setFocusIdx(i); setFocusItem(item); setHoverIdx(null);
    setFocusPhase("fly-up");
    setTimeout(() => setFocusPhase("dissolve"), 450);
    setTimeout(() => setFocusPhase("detail"), 750);
  }, [focusPhase]);

  const handleDetailClose = useCallback(() => {
    setFocusPhase("condense");
    setTimeout(() => setFocusPhase("fly-back"), 300);
    setTimeout(() => { setFocusPhase(null); setFocusIdx(null); setFocusItem(null); }, 750);
  }, []);

  // 静默清理焦点 — 不触发回收动画，用于第二层直接过渡到第三层
  const clearFocusSilent = useCallback(() => {
    setFocusPhase(null); setFocusIdx(null); setFocusItem(null);
  }, []);

  const getCenterDelta = (i) => {
    const offset = i - hCenter;
    const yUp = offset * offset * arcK;
    const cl = startX + i * spacing;
    const ct = DESK.stackY + yUp;
    const r = deskRef.current?.getBoundingClientRect();
    if (!r) return { dx: 0, dy: -120, cl, ct };
    return {
      dx: (window.innerWidth / 2) - r.left - cl - DESK.cardW / 2,
      dy: (window.innerHeight * 0.38) - r.top - ct - 82,
      cl, ct,
    };
  };

  // Compute card style for index i
  const getCardStyle = (i) => {
    const item = handCards[i];
    const k = getKey(item);
    const hovered = hoverIdx === i;

    if (!handOpen) {
      const po = offsets.current[k] || { rx: 0, ry: 0, rot: 0 };
      if (i < 5) {
        return { left: 20 + i * 38 + po.rx, top: DESK.stackY + po.ry, transform: "rotate(" + po.rot + "deg)" + (hovered ? " translateY(-6px) scale(1.05)" : ""), zIndex: hovered ? 50 : i + 1, transition: "all 0.35s ease" };
      }
      return { left: 20 + 4 * 38 + po.rx, top: DESK.stackY + po.ry, transform: "rotate(" + po.rot + "deg) scale(0.92)", zIndex: 0, opacity: 0, transition: "all 0.35s ease" };
    }

    const offset = i - hCenter;
    const normOff = HN > 1 ? offset / hCenter : 0;
    const angle = normOff * maxAngle;
    const yUp = offset * offset * arcK;
    const isFocused = focusIdx === i;
    const otherFocused = focusIdx !== null && focusIdx !== i;

    if (isFocused && focusPhase) {
      const { dx, dy, cl, ct } = getCenterDelta(i);
      switch (focusPhase) {
        case "fly-up":
          return { left: cl, top: ct, transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.25)`, opacity: 1, zIndex: 500, filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))", transition: "all 0.45s cubic-bezier(0.34, 1.4, 0.64, 1)" };
        case "dissolve":
          return { left: cl, top: ct, transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.6)`, opacity: 0, zIndex: 500, transition: "all 0.3s ease-in" };
        case "detail":
          return { left: cl, top: ct, transform: `translate(${dx}px, ${dy}px) scale(1.6)`, opacity: 0, zIndex: 0, transition: "none" };
        case "condense":
          return { left: cl, top: ct, transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.25)`, opacity: 1, zIndex: 500, filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))", transition: "all 0.3s ease-out" };
        default:
          return { left: startX + i * spacing, top: DESK.stackY + yUp, transform: `rotate(${angle}deg) scale(1)`, opacity: 1, zIndex: 100, transition: "all 0.45s cubic-bezier(0.25, 1, 0.5, 1)" };
      }
    }

    return {
      left: startX + i * spacing,
      top: hovered && !otherFocused ? Math.max(2, 16 - yUp) : DESK.stackY + yUp,
      transform: `rotate(${hovered && !otherFocused ? 0 : angle}deg) scale(${otherFocused ? 0.92 : hovered ? 1.12 : 1})`,
      zIndex: hovered && !otherFocused ? 200 : 100 - Math.round(Math.abs(offset)),
      filter: hovered && !otherFocused ? "drop-shadow(0 8px 20px rgba(0,0,0,0.4))" : "none",
      opacity: otherFocused ? 0.3 : 1,
      transition: `all 0.4s cubic-bezier(0.25, 1, 0.5, 1) ${focusIdx !== null ? 0 : i * 0.04}s`,
    };
  };

  return {
    deskRef, deskW, handOpen, setHandOpen,
    hoverIdx, setHoverIdx,
    focusIdx, focusPhase, focusItem,
    handleCardFocus, handleDetailClose, clearFocusSilent,
    handCards, handExtra,
    getCardStyle,
    count: items.length,
  };
}
