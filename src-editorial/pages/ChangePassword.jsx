import { useState, useEffect } from "react";
import { FONT_SANS, COLOR, GAP, FONT_SIZE } from "../constants/theme.js";
import { FInput } from "../components/ui/Form.jsx";
import SheetModal, { SheetCloseBtn } from "../components/ui/SheetModal.jsx";
import { changePassword } from "../services/workService.js";

/**
 * 修改密码弹窗 — 所有登录用户可用
 */
export default function ChangePassword({ show, onClose, token }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (show) {
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
      setError(""); setSuccess(false);
    }
  }, [show]);

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
    <SheetModal show={show} onClose={onClose} width={380}>
      {/* 标题栏 */}
      <div style={{
        padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`,
        borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>
          修改密码
        </div>
        <SheetCloseBtn onClick={onClose} />
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
    </SheetModal>
  );
}
