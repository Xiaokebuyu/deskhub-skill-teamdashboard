import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SHEET, COLOR } from "../../constants/theme.js";

/**
 * SheetModal —— 业务表单/设置类弹窗的统一壳
 *
 * 定位策略（跟 FullPanel 同源）：
 *   - 读 [data-page-area]（Stage，sidebar 右侧）→ 只盖页面区，不跨 sidebar
 *   - 取不到则回退全 viewport（向后兼容）
 *   - Portal 到 body —— 脱离 PageCardStack 的 transform 祖先，position:fixed 才真正相对 viewport
 *
 * 动画：
 *   - overlay fade（opacity 0 → 1，跟 mounted/visible 状态机耦合）
 *   - content scale+translateY pop-in（跟老 ScorePanel 同款）
 *   - 不做 Container Transform，触发点多样（sidebar 按钮/工单顶栏/维度齿轮），强塞别扭
 *
 * 消费者只关心内容，不再重写 overlay / 定位 / 动画 / zIndex。
 * 用法：<SheetModal show onClose width={480}>{body}</SheetModal>
 */

function getPageAreaRect() {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-page-area]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function SheetModal({ show, onClose, width = 480, maxHeight = "85vh", children }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageRect, setPageRect] = useState(null);

  useEffect(() => {
    if (show) {
      setMounted(true);
      setPageRect(getPageAreaRect());  // 打开瞬间快照
      let done = false;
      const toVisible = () => { if (!done) { done = true; setVisible(true); } };
      requestAnimationFrame(() => requestAnimationFrame(toVisible));
      const timer = setTimeout(toVisible, 60);
      return () => clearTimeout(timer);
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  // 展开期间窗口 resize → 重新贴合
  useEffect(() => {
    if (!visible) return;
    const onResize = () => setPageRect(getPageAreaRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible]);

  if (!mounted) return null;

  const area = pageRect || { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };

  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed",
      top: area.top, left: area.left, width: area.width, height: area.height,
      zIndex: SHEET.zIndex,
      background: SHEET.overlay,
      backdropFilter: SHEET.blur,
      WebkitBackdropFilter: SHEET.blur,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: `opacity ${SHEET.fadeMs}ms ease`,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width, maxHeight,
        background: SHEET.bg,
        border: SHEET.border,
        borderRadius: SHEET.radius,
        boxShadow: SHEET.shadow,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        transform: visible ? SHEET.scaleVisible : SHEET.scaleHidden,
        transition: SHEET.transition,
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * SheetCloseBtn —— 统一的右上角关闭按钮
 * 消费者：<SheetCloseBtn onClick={onClose} />
 */
export function SheetCloseBtn({ onClick }) {
  return (
    <div onClick={onClick} style={{
      width: SHEET.closeBtnSize, height: SHEET.closeBtnSize,
      borderRadius: SHEET.closeBtnRadius,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", background: SHEET.closeBtnBg,
      transition: "background 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = SHEET.closeBtnBgHover}
      onMouseLeave={e => e.currentTarget.style.background = SHEET.closeBtnBg}
    >
      <X size={14} color={COLOR.text5} strokeWidth={1.5} />
    </div>
  );
}
