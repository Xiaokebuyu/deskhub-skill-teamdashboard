import { useState } from "react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../constants/theme.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = loading || !username.trim() || !password.trim();

  const handleSubmit = async () => {
    if (disabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "登录失败");
        return;
      }
      const result = data.data || data;
      onLogin(result.token, result.user);
    } catch (e) {
      setError(e.message || "网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const inputStyle = {
    width: "100%",
    padding: `${GAP.base}px ${GAP.lg}px`,
    background: "rgba(255,255,255,0.4)",
    border: `1px solid ${COLOR.border}`,
    borderRadius: GAP.md,
    fontFamily: FONT_SANS,
    fontSize: FONT_SIZE.lg,
    color: COLOR.text,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle = {
    fontFamily: FONT_SANS,
    fontSize: FONT_SIZE.md,
    color: COLOR.text3,
    marginBottom: GAP.xs,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLOR.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: COLOR.gradModal,
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 16,
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
          padding: `${GAP.xxl + 8}px ${GAP.xxl + 4}px ${GAP.xxl}px`,
        }}
      >
        {/* Logo area */}
        <div
          style={{
            textAlign: "center",
            marginBottom: GAP.xxl + 4,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 24,
              fontWeight: 600,
              color: COLOR.text,
              letterSpacing: "-0.02em",
            }}
          >
            DeskSkill
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: FONT_SIZE.base,
              color: COLOR.sub,
              marginTop: GAP.xs,
            }}
          >
            TeamBoard
          </div>
        </div>

        {/* Username */}
        <div style={{ marginBottom: GAP.lg }}>
          <div style={labelStyle}>用户名</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入用户名"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = COLOR.borderHv;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLOR.border;
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: GAP.lg }}>
          <div style={labelStyle}>密码</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入密码"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = COLOR.borderHv;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLOR.border;
            }}
          />
        </div>

        {/* Login button */}
        <button
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            width: "100%",
            padding: `${GAP.base + 2}px 0`,
            borderRadius: GAP.md,
            background: COLOR.btn,
            color: COLOR.btnText,
            border: "none",
            fontFamily: FONT_SANS,
            fontSize: FONT_SIZE.lg,
            fontWeight: 500,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "all 0.15s",
            marginTop: GAP.md,
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.target.style.background = COLOR.btnHover;
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.target.style.background = COLOR.btn;
          }}
        >
          {loading ? "登录中..." : "登录"}
        </button>

        {/* Error message */}
        {error && (
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: FONT_SIZE.md,
              color: COLOR.error,
              textAlign: "center",
              marginTop: GAP.lg,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: GAP.xxl,
            fontFamily: FONT_SANS,
            fontSize: FONT_SIZE.md,
            color: COLOR.sub,
          }}
        >
          团队协作看板
        </div>
      </div>
    </div>
  );
}
