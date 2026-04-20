import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * 页转场 v10 —— Layer 自带 bg 当遮罩 + 稳定 key + 内容懒挂载
 *
 * 方案演变：
 *   v7：Layer 内嵌 BgFor，切 tab 时 bg + 重组件同一个 commit，paint 被内容卡住
 *       且 transition 结束时 Layer 换 key 导致 video 重挂一次（"覆盖完又 load 一遍"）
 *   v8：bg 抽到 Stage 常驻 + Layer 透明 —— 解耦了但失去"新页盖住旧页"的覆盖感
 *   v9：回 Layer 自带 bg 但忘了稳定 key，video 还是会在 transition 结束时重挂
 *   v10：Layer key = tab 名 —— 同一个 Layer 实例跨越 static ↔ enter-up/idle ↔ static 持续存在
 *        进入的 tab 的 video 只挂载一次，覆盖结束不重 load
 *        用 useLayoutEffect 在 paint 前重置 active，避免持久 Layer 切 exit-down 时位置跳动
 *        内容懒挂载（双 rAF）—— bg 先上屏，下一帧再 commit 重组件
 *
 * Layer 生命周期（stable key = tab 名）：
 *   forward  (A → B)：
 *     A: static → idle → [unmount at transition end]
 *     B: [fresh mount] enter-up → static（video 只挂一次，持续播放到离开 B）
 *   backward (B → A)：
 *     A: [fresh mount] idle → static（video 只挂一次）
 *     B: static → exit-down → [unmount at transition end]
 */

const TAB_ORDER = ["dashboard", "mcp", "workbench"];
const ANIM_MS = 600;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const BG_MAP = {
  dashboard: { type: "video", src: "/hero-bg.webm" },
  workbench: { type: "video", src: "/hero-bg-alt.webm" },
  mcp:       { type: "image", src: "/hero-mcp.webp" },
};

const VIGNETTE_DASHBOARD = "radial-gradient(ellipse at center, transparent 35%, rgba(250,248,245,0.10) 65%, rgba(250,248,245,0.25) 90%, rgba(250,248,245,0.45) 100%)";
const VIGNETTE_OTHER     = "radial-gradient(ellipse at center, transparent 30%, rgba(250,248,245,0.18) 60%, rgba(250,248,245,0.40) 85%, rgba(250,248,245,0.60) 100%)";
const TOP_WASH           = "linear-gradient(to bottom, rgba(250,248,245,0.55) 0%, rgba(250,248,245,0.30) 45%, rgba(250,248,245,0) 100%)";

export default function PageCardStack({ tab, pages }) {
  const [currentTab, setCurrentTab] = useState(tab);
  const [transition, setTransition] = useState(null);
  const lastTabRef = useRef(tab);

  useEffect(() => {
    if (tab === lastTabRef.current) return;
    const prev = lastTabRef.current;
    const prevIdx = TAB_ORDER.indexOf(prev);
    const newIdx = TAB_ORDER.indexOf(tab);
    const direction = newIdx > prevIdx ? "forward" : "backward";

    setTransition({ from: prev, to: tab, direction });
    setCurrentTab(tab);
    lastTabRef.current = tab;

    const t = setTimeout(() => setTransition(null), ANIM_MS + 60);
    return () => clearTimeout(t);
  }, [tab]);

  if (!transition) {
    return (
      <Stage>
        <Layer key={currentTab} mode="static" tabId={currentTab}>{pages[currentTab]}</Layer>
      </Stage>
    );
  }

  if (transition.direction === "forward") {
    // 旧页 (from) 原位不动，新页 (to) 从底部滑入覆盖
    // key = tab 名 —— enter-up 的 Layer 在 transition 结束后继续作为 static 存在，video 不重挂
    return (
      <Stage>
        <Layer key={transition.from} mode="idle" tabId={transition.from}>{pages[transition.from]}</Layer>
        <Layer key={transition.to} mode="enter-up" tabId={transition.to}>{pages[transition.to]}</Layer>
      </Stage>
    );
  }
  // backward：新页 (to) 静静躺在底，旧页 (from) 向下滑出
  return (
    <Stage>
      <Layer key={transition.to} mode="idle" tabId={transition.to}>{pages[transition.to]}</Layer>
      <Layer key={transition.from} mode="exit-down" tabId={transition.from}>{pages[transition.from]}</Layer>
    </Stage>
  );
}

function Stage({ children }) {
  return (
    <div data-page-area style={{
      position: "relative",
      flex: 1, minWidth: 0,
      height: "100%",
      overflow: "hidden",
      backgroundColor: "#f5efe5",
    }}>
      {children}
    </div>
  );
}

function initialState(mode) {
  switch (mode) {
    case "enter-up":  return { tf: "translateY(100%)" };
    case "exit-down": return { tf: "translateY(0)" };
    default:          return { tf: "translateY(0)" };
  }
}

function targetState(mode) {
  switch (mode) {
    case "enter-up":  return { tf: "translateY(0)" };
    case "exit-down": return { tf: "translateY(100%)" };
    default:          return { tf: "translateY(0)" };
  }
}

function Layer({ children, mode, tabId }) {
  const [active, setActive] = useState(false);
  // 内容懒挂载：只在"新挂载"的 enter-up / idle 需要延迟；static / exit-down 都是持久 Layer 上次已经挂好的内容
  const [contentReady, setContentReady] = useState(mode === "static" || mode === "exit-down");

  // mode 变化时同步重置 active —— 必须用 useLayoutEffect（paint 前生效），否则持久 Layer
  // 从 static 切到 exit-down 时，旧的 active=true 会让 transform 直接跳到 translateY(100%)
  useLayoutEffect(() => {
    if (mode === "enter-up" || mode === "exit-down") {
      setActive(false);  // 从 initial state（translateY(100%) or translateY(0)）开始
    } else {
      setActive(true);   // static / idle —— initial 和 target 都是 translateY(0)，哪个都行
    }
  }, [mode]);

  // 下一帧触发滑动目标态（只对 enter-up / exit-down 生效）
  useEffect(() => {
    if (mode !== "enter-up" && mode !== "exit-down") return;
    let done = false;
    const go = () => { if (!done) { done = true; setActive(true); } };
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(go); });
    const timer = setTimeout(go, 60);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [mode]);

  // 内容懒挂载：首次挂载若 contentReady=false（enter-up 或 idle-to 的 fresh mount），
  // 双 rAF 后再让内容 commit —— bg 已经在首次 paint 时上屏，重组件不再卡背景
  useEffect(() => {
    if (contentReady) return;
    const mount = () => setContentReady(true);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(mount); });
    const timer = setTimeout(mount, 80);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, []);

  const state = active ? targetState(mode) : initialState(mode);
  const isMoving = mode === "enter-up" || mode === "exit-down";

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: isMoving ? 2 : 1,
      transform: state.tf,
      transition: isMoving ? `transform ${ANIM_MS}ms ${EASING}` : "none",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      backgroundColor: "#f5efe5",  // bg 未解码时兜底暖色
    }}>
      <BgFor tab={tabId} />

      {/* vignette wash（中心清晰、边缘雾化）*/}
      <div style={{
        position: "absolute", inset: 0,
        background: tabId === "dashboard" ? VIGNETTE_DASHBOARD : VIGNETTE_OTHER,
        pointerEvents: "none",
        zIndex: 1,
      }} />
      {/* 顶部 wash —— 给 header 一块"纸"*/}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 260,
        background: TOP_WASH,
        pointerEvents: "none",
        zIndex: 1,
      }} />

      <div style={{
        position: "relative", zIndex: 2,
        flex: 1, overflowY: "auto", overflowX: "hidden",
        color: "#1a1d18",
      }}>
        {contentReady ? children : null}
      </div>
    </div>
  );
}

function BgFor({ tab }) {
  const bg = BG_MAP[tab] || BG_MAP.dashboard;
  if (bg.type === "video") {
    return (
      <video
        autoPlay loop muted playsInline
        src={bg.src}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          zIndex: 0, pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: `url('${bg.src}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}
