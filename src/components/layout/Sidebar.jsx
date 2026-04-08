import { useState } from "react";
import { ChevronLeft, ChevronUp, BadgeCheck, Settings2 } from "lucide-react";
import { TABS } from "../../constants/tabs.js";
import { ROLES } from "../../constants/roles.js";
import { COLOR, GAP, FONT_SIZE, FONT_MONO, FONT_SANS } from "../../constants/theme.js";

const COLLAPSED_W = 56;
const EASE = "0.3s cubic-bezier(0.25, 1, 0.5, 1)";
// ─── 固定宽度图标列：展开/收起时图标零位移 ───
const COL_PAD = 4;                           // 所有区域统一水平 padding
const ICON_COL = COLLAPSED_W - COL_PAD * 2;  // 48px — 图标列宽度
// 图标居中于 ICON_COL → 中心始终在 COL_PAD + ICON_COL/2 = 4+24 = 28px = COLLAPSED_W/2

export default function Sidebar({ tab, setTab, role, setRole, collapsed, setCollapsed, onResetBrowse, onOpenDimMgr }) {
  const [roleOpen, setRoleOpen] = useState(false);

  const iconCol = { width: ICON_COL, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 };

  return (
    <div style={{
      width: collapsed ? COLLAPSED_W : 200, flexShrink: 0,
      background: COLOR.bgSide,
      borderRight: `1px solid ${COLOR.border}`,
      display: "flex", flexDirection: "column",
      transition: `width ${EASE}`,
      overflow: "hidden", position: "relative",
    }}>
      {/* 折叠按钮 — 展开右对齐 / 收起居中 */}
      <div style={{
        padding: collapsed ? `${GAP.lg}px 0` : `${GAP.lg}px 14px ${GAP.lg}px 0`,
        display: "flex", justifyContent: collapsed ? "center" : "flex-end",
        transition: `padding ${EASE}`,
      }}>
        <button onClick={() => setCollapsed(c => !c)} style={{
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

      {/* 品牌区 — SVG 在 ICON_COL 内居中 */}
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

      {/* 导航区 — icon 16px 在 ICON_COL 内居中 */}
      <div style={{ padding: `${GAP.lg}px ${COL_PAD}px`, flex: 1 }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); onResetBrowse(); }} title={collapsed ? t.label : undefined}
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

      {/* 身份区 */}
      <div style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(255,255,255,0.5)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.03)",
        position: "relative",
      }}>
        {/* 角色选择弹出面板 — 展开 */}
        {roleOpen && !collapsed && (
          <div style={{
            position: "absolute", bottom: "100%", left: 0, right: 0,
            background: COLOR.bgModal, borderTop: `1px solid ${COLOR.border}`,
            boxShadow: `0 -4px 16px ${COLOR.borderMd}`,
            padding: `${GAP.md}px ${GAP.sm}px`,
            animation: "roleSlideUp 0.2s ease-out",
          }}>
            <style>{`@keyframes roleSlideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, padding: `${GAP.xs}px ${GAP.md}px ${GAP.sm}px`, letterSpacing: 1 }}>切换角色</div>
            {ROLES.map(r => {
              const active = role === r.id;
              return (
                <button key={r.id} onClick={() => { setRole(r.id); setRoleOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: GAP.md, width: "100%",
                    padding: `${GAP.md}px`, marginBottom: 2,
                    background: active ? r.bg : "transparent",
                    border: active ? `1px solid ${r.color}30` : "1px solid transparent",
                    borderRadius: GAP.md, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: active ? r.color : "#d5d0c8",
                    color: COLOR.bgWhite, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    <r.Icon size={13} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, fontWeight: active ? 600 : 400, color: active ? r.color : "#6a5a42" }}>{r.label}</div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, marginTop: 1 }}>{r.desc}</div>
                  </div>
                  {active && <BadgeCheck size={13} style={{ color: r.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
        {/* 角色选择弹出面板 — 收起 */}
        {roleOpen && collapsed && (
          <div style={{
            position: "absolute", bottom: 0, left: COLLAPSED_W,
            background: COLOR.bgModal, border: `1px solid ${COLOR.borderMd}`,
            borderRadius: GAP.base, boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            padding: `${GAP.md}px ${GAP.sm}px`, width: 180, zIndex: 100,
            animation: "roleSlideUp 0.2s ease-out",
          }}>
            <style>{`@keyframes roleSlideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, padding: `${GAP.xs}px ${GAP.md}px ${GAP.sm}px`, letterSpacing: 1 }}>切换角色</div>
            {ROLES.map(r => {
              const active = role === r.id;
              return (
                <button key={r.id} onClick={() => { setRole(r.id); setRoleOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: GAP.md, width: "100%",
                    padding: `${GAP.md}px`, marginBottom: 2,
                    background: active ? r.bg : "transparent",
                    border: active ? `1px solid ${r.color}30` : "1px solid transparent",
                    borderRadius: GAP.md, cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? r.color : "#d5d0c8", color: COLOR.bgWhite, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <r.Icon size={11} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, fontWeight: active ? 600 : 400, color: active ? r.color : "#6a5a42" }}>{r.label}</div>
                  </div>
                  {active && <BadgeCheck size={12} style={{ color: r.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
        {/* 当前角色 — avatar 在 ICON_COL 内居中 */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 0, padding: `${GAP.md}px ${COL_PAD}px` }}>
          <button onClick={() => setRoleOpen(o => !o)} style={{
            display: "flex", alignItems: "center", flex: 1, minWidth: 0,
            padding: `${GAP.xs}px 0`,
            background: "none", border: "none", cursor: "pointer",
          }}>
            <div style={iconCol}>
              {(() => { const cr = ROLES.find(r => r.id === role); return (
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
            {!collapsed && (() => { const cr = ROLES.find(r => r.id === role); return (<>
              <div style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, fontWeight: 600, color: COLOR.btn, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cr.label}</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: COLOR.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cr.desc}</div>
              </div>
              <ChevronUp size={12} style={{ color: COLOR.sub, flexShrink: 0, transform: roleOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </>); })()}
          </button>
          {/* 维度设置 — 角色栏右侧常驻按钮 */}
          {onOpenDimMgr && !collapsed && (
            <div onClick={e => { e.stopPropagation(); onOpenDimMgr(); }} title="评分维度设置" style={{
              width: 30, height: 30, borderRadius: GAP.md, marginRight: GAP.xs,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: COLOR.sub,
              background: "rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.05)",
              transition: "all 0.15s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = COLOR.text; e.currentTarget.style.background = "rgba(0,0,0,0.07)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = COLOR.sub; e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            >
              <Settings2 size={14} strokeWidth={1.5} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
