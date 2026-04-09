import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../constants/theme.js";
import { FInput } from "../components/ui/Form.jsx";
import { changePassword } from "../services/workService.js";

/**
 * 修改密码弹窗 — 所有登录用户可用
 */
export default function ChangePassword({ show, onClose, token }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
      setError(""); setSuccess(false);
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!mounted) return null;

  const canSubmit = oldPwd && newPwd && confirmPwd && !loading && !success;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (newPwd.length < 6) { setError("新密码至少6位"); return; }
    if (newPwd !== confirmPwd) { setError("两次密码不一致"); return; }
    setError("");
    setLoading(true);
    try {
      await changePassword({ oldPassword: oldPwd, newPassword: newPwd }, token);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 800,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0, transition: "opacity 0.3s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 380, maxHeight: "85vh",
        background: COLOR.gradModal,
        border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
        boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
      }}>
        {/* 标题栏 */}
        <div style={{
          padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`,
          borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>
            修改密码
          </div>
          <div onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: COLOR.borderLt, transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = COLOR.borderMd}
            onMouseLeave={e => e.currentTarget.style.background = COLOR.borderLt}
          >
            <X size={14} color={COLOR.text5} strokeWidth={1.5} />
          </div>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px ${GAP.xxl}px` }}>
          {success ? (
            <div style={{
              textAlign: "center", padding: `${GAP.xxl}px 0`,
              fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.success, fontWeight: 500,
            }}>
              密码修改成功
            </div>
          ) : (
            <>
              <FInput label="旧密码" type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} placeholder="请输入当前密码" />
              <FInput label="新密码" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="至少6位" />
              <FInput label="确认新密码" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="再次输入新密码" />

              {error && (
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.error, marginBottom: GAP.lg }}>
                  {error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={!canSubmit} style={{
                width: "100%", padding: `${GAP.base}px`, borderRadius: GAP.md,
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
                background: canSubmit ? COLOR.btn : COLOR.borderLt,
                color: canSubmit ? COLOR.btnText : "#b5b0a5",
                border: canSubmit ? `1px solid ${COLOR.btn}` : `1px solid ${COLOR.borderMd}`,
                opacity: canSubmit ? 1 : 0.6,
                transition: "all 0.15s",
              }}>{loading ? "提交中..." : "确认修改"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
