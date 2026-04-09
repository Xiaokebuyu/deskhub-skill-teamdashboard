import { useState, useEffect } from "react";
import { ChevronLeft, LogOut, Settings2, Users, KeyRound, ChevronUp } from "lucide-react";
import { TABS } from "../../constants/tabs.js";
import { ROLES } from "../../constants/roles.js";
import { COLOR, GAP, FONT_SIZE, FONT_MONO, FONT_SANS } from "../../constants/theme.js";

const COLLAPSED_W = 56;
const EASE = "0.3s cubic-bezier(0.25, 1, 0.5, 1)";
const COL_PAD = 4;
const ICON_COL = COLLAPSED_W - COL_PAD * 2;

export default function Sidebar({ tab, setTab, role, user, onLogout, collapsed, setCollapsed, onResetBrowse, onOpenDimMgr, onOpenUserMgr, onOpenChangePwd }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sidebar 收起时自动关闭抽屉
  useEffect(() => {
    if (collapsed) setDrawerOpen(false);
  }, [collapsed]);

  const iconCol = { width: ICON_COL, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 };

  // 构建菜单项（按角色动态）
  const menuItems = [];
  if (onOpenUserMgr) menuItems.push({ icon: Users, label: "用户管理", onClick: onOpenUserMgr });
  if (onOpenChangePwd) menuItems.push({ icon: KeyRound, label: "修改密码", onClick: onOpenChangePwd });
  if (onOpenDimMgr) menuItems.push({ icon: Settings2, label: "维度设置", onClick: onOpenDimMgr });
  if (onLogout) menuItems.push({ icon: LogOut, label: "退出登录", onClick: onLogout, danger: true });

  const handleMenuItem = (item) => {
    setDrawerOpen(false);
    // 延迟执行回调，让抽屉动画先走
    setTimeout(() => item.onClick(), 150);
  };

  return (
    <div
      onClick={() => { if (drawerOpen) setDrawerOpen(false); }}
      style={{
        width: collapsed ? COLLAPSED_W : 200, flexShrink: 0,
        background: COLOR.bgSide,
        borderRight: `1px solid ${COLOR.border}`,
        display: "flex", flexDirection: "column",
        transition: `width ${EASE}`,
        overflow: "hidden", position: "relative",
      }}
    >
      {/* 折叠按钮 */}
      <div style={{
        padding: collapsed ? `${GAP.lg}px 0` : `${GAP.lg}px 14px ${GAP.lg}px 0`,
        display: "flex", justifyContent: collapsed ? "center" : "flex-end",
        transition: `padding ${EASE}`,
      }}>
        <button onClick={(e) => { e.stopPropagation(); setCollapsed(c => !c); }} style={{
          width: 30, height: 30, border: `1px solid ${COLOR.border}`, borderRadius: GAP.md,
          background: COLOR.bgWhite, cursor: "pointer", color: COLOR.text5,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 1px 3px ${COLOR.borderLt}`, transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = COLOR.bg; e.currentTarget.style.color = COLOR.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = COLOR.bgWhite; e.currentTarget.style.color = COLOR.text5; }}
        >
          <ChevronLeft size={14} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: `transform ${EASE}` }} />
        </button>
      </div>

      {/* 品牌区 */}
      <div style={{
        padding: `${GAP.base}px ${COL_PAD}px ${GAP.lg}px`,
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        display: "flex", alignItems: "center",
      }}>
        <div style={iconCol}>
          <svg viewBox="0 0 40 34" fill="none" stroke="#6a5a42" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: collapsed ? 28 : 32, height: collapsed ? 24 : 28, display: "block", transition: `all ${EASE}` }}>
            <path d="M22 8c5 0 9 3.5 9 8s-3 7-7 7c-3 0-5.5-2-5.5-5s1.8-4 3.5-4c1.2 0 2.2.8 2.2 2" strokeWidth="1.6" />
            <path d="M22 23c-3 0-6-.5-9-2" />
            <path d="M13 21c-1.5-1-2.5-2.5-2.5-4" />
            <line x1="14" y1="14" x2="11" y2="8" />
            <line x1="17" y1="13" x2="15.5" y2="8" />
            <circle cx="10.5" cy="7.5" r="1.5" fill="#6a5a42" stroke="none" />
            <circle cx="15" cy="7.5" r="1.5" fill="#6a5a42" stroke="none" />
            <path d="M10.5 17c-2 1-4 .5-5 0s-1.5-2-.5-2.5c1.2-.6 2 .3 2.5 1" strokeWidth="1.4" />
            <path d="M13 21c-1 2-2 3.5-4 3.5s-2-1-1.5-2c.6-1.2 1.8-1 2.5-.5" strokeWidth="1.4" />
            <line x1="16" y1="22" x2="14" y2="26" strokeWidth="1.2" />
            <line x1="19" y1="23" x2="18" y2="27" strokeWidth="1.2" />
            <line x1="22" y1="23" x2="22" y2="27.5" strokeWidth="1.2" />
          </svg>
        </div>
        {!collapsed && (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, fontWeight: 700, color: COLOR.text, letterSpacing: 0.8, lineHeight: 1.1 }}>DeskHub</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, marginTop: 2, letterSpacing: 2, textTransform: "uppercase", lineHeight: 1.1 }}>TEAMBOARD</div>
          </div>
        )}
      </div>

      {/* 导航区 */}
      <div style={{ padding: `${GAP.lg}px ${COL_PAD}px`, flex: 1 }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={(e) => { e.stopPropagation(); setTab(t.id); onResetBrowse(); }} title={collapsed ? t.label : undefined}
              style={{
                display: "flex", alignItems: "center",
                width: "100%", padding: `${GAP.base}px 0`,
                fontFamily: FONT_SANS,
                fontSize: FONT_SIZE.base, fontWeight: on ? 600 : 400,
                color: on ? COLOR.btn : COLOR.text5,
                background: on ? COLOR.bgWhite : "transparent",
                border: "none", borderRadius: GAP.base, cursor: "pointer",
                marginBottom: GAP.xs,
                boxShadow: on ? `0 1px 4px ${COLOR.border}` : "none",
                transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={iconCol}>
                <t.Icon size={16} strokeWidth={on ? 2.2 : 1.6} />
              </div>
              {!collapsed && <span style={{ textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>{t.label}</span>}
            </button>
          );
        })}
      </div>

      {/* 身份区 — 用户卡片 + 上拉抽屉 */}
      <div style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(255,255,255,0.5)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.03)",
        position: "relative",
      }}>
        {/* 抽屉 — 从卡片上方滑出 */}
        <div style={{
          overflow: "hidden",
          maxHeight: drawerOpen ? menuItems.length * 40 + 8 : 0,
          opacity: drawerOpen ? 1 : 0,
          transition: drawerOpen
            ? "max-height 0.25s ease-out, opacity 0.2s ease-out"
            : "max-height 0.2s ease-in, opacity 0.15s ease-in",
          borderBottom: drawerOpen ? `1px solid ${COLOR.border}` : "1px solid transparent",
        }}>
          <div style={{ padding: `${GAP.xs}px ${GAP.sm}px` }}>
            {menuItems.map((item, i) => (
              <div
                key={i}
                onClick={(e) => { e.stopPropagation(); handleMenuItem(item); }}
                style={{
                  display: "flex", alignItems: "center", gap: GAP.md,
                  padding: `${GAP.md}px ${GAP.base}px`,
                  borderRadius: GAP.sm, cursor: "pointer",
                  fontFamily: FONT_SANS, fontSize: FONT_SIZE.base,
                  color: COLOR.text3,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = item.danger ? "rgba(184,58,42,0.06)" : "rgba(0,0,0,0.05)";
                  e.currentTarget.style.color = item.danger ? COLOR.error : COLOR.text;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = COLOR.text3;
                }}
              >
                <item.icon size={15} strokeWidth={1.5} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 用户卡片（可点击） */}
        <div
          onClick={(e) => { e.stopPropagation(); if (!collapsed) setDrawerOpen(d => !d); }}
          style={{
            display: "flex", alignItems: "center", minWidth: 0,
            padding: `${GAP.md}px ${COL_PAD}px`,
            cursor: collapsed ? "default" : "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { if (!collapsed) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* 头像 */}
          <div style={iconCol}>
            {(() => { const cr = ROLES.find(r => r.id === role) || ROLES[2]; return (
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: cr.color, color: COLOR.bgWhite,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                transition: `background ${EASE}`,
              }}>
                <cr.Icon size={15} strokeWidth={2} />
              </div>
            ); })()}
          </div>
          {/* 用户名 + 角色 + 展开箭头 */}
          {!collapsed && (
            <>
              <div style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, fontWeight: 600, color: COLOR.btn, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.displayName || user?.username || '未登录'}
                </div>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(ROLES.find(r => r.id === role) || {}).label || role}
                </div>
              </div>
              <div style={{
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, color: COLOR.dim,
                transition: "transform 0.25s ease, color 0.15s",
                transform: drawerOpen ? "rotate(0deg)" : "rotate(180deg)",
              }}>
                <ChevronUp size={14} strokeWidth={1.5} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
