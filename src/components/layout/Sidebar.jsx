import { useState } from "react";
import { ChevronLeft, ChevronUp, BadgeCheck, Settings2 } from "lucide-react";
import { TABS } from "../../constants/tabs.js";
import { ROLES } from "../../constants/roles.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";

export default function Sidebar({ tab, setTab, role, setRole, collapsed, setCollapsed, onResetBrowse, onOpenDimMgr }) {
  const [roleOpen, setRoleOpen] = useState(false);

  return (
    <div style={{
      width: collapsed ? 56 : 200, flexShrink: 0,
      background: "#F3F2EE",
      borderRight: "1px solid rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column",
      transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
      overflow: "hidden", position: "relative",
    }}>
      {/* 折叠按钮 */}
      <div style={{ padding: "12px 0 12px 14px", display: "flex", justifyContent: "flex-start" }}>
        <button onClick={() => setCollapsed(c => !c)} style={{
          width: 30, height: 30, border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8,
          background: "#fff", cursor: "pointer", color: "#8a7a62",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F9F8F6"; e.currentTarget.style.color = "#3a2a18"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#8a7a62"; }}
        >
          <ChevronLeft size={14} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.3s" }} />
        </button>
      </div>

      {/* 品牌区 */}
      <div style={{ padding: collapsed ? "10px 0 12px" : "10px 16px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)", textAlign: "center" }}>
        <svg viewBox="0 0 40 34" fill="none" stroke="#6a5a42" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ width: collapsed ? 28 : 36, height: collapsed ? 24 : 30, display: "block", margin: "0 auto" }}>
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
        {!collapsed && (
          <>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: "#3a2a18", marginTop: 6, letterSpacing: 0.8 }}>DeskSkill</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", marginTop: 1, letterSpacing: 2, textTransform: "uppercase" }}>TeamBoard</div>
          </>
        )}
      </div>

      {/* 导航区 */}
      <div style={{ padding: "12px 8px", flex: 1 }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); onResetBrowse(); }} title={collapsed ? t.label : undefined}
              style={{
                display: "flex", alignItems: "center",
                width: "100%", padding: "9px 12px",
                justifyContent: "flex-start",
                fontFamily: FONT_SANS,
                fontSize: 13, fontWeight: on ? 600 : 400,
                color: on ? "#2d2418" : "#8a7a62",
                background: on ? "#fff" : "transparent",
                border: "none", borderRadius: 10, cursor: "pointer",
                marginBottom: 4,
                boxShadow: on ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              <t.Icon size={16} strokeWidth={on ? 2.2 : 1.6} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ flex: 1, textAlign: "center", paddingRight: 20, whiteSpace: "nowrap", overflow: "hidden" }}>{t.label}</span>}
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
        {/* 角色选择弹出面板 */}
        {roleOpen && !collapsed && (
          <div style={{
            position: "absolute", bottom: "100%", left: 0, right: 0,
            background: "#FDFCFA", borderTop: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
            padding: "8px 6px",
            animation: "roleSlideUp 0.2s ease-out",
          }}>
            <style>{`@keyframes roleSlideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", padding: "4px 8px 6px", letterSpacing: 1 }}>切换角色</div>
            {ROLES.map(r => {
              const active = role === r.id;
              return (
                <button key={r.id} onClick={() => { setRole(r.id); setRoleOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 8px", marginBottom: 2,
                    background: active ? r.bg : "transparent",
                    border: active ? `1px solid ${r.color}30` : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: active ? r.color : "#d5d0c8",
                    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    <r.Icon size={13} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? r.color : "#6a5a42" }}>{r.label}</div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", marginTop: 1 }}>{r.desc}</div>
                  </div>
                  {active && <BadgeCheck size={13} style={{ color: r.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
        {/* 折叠时的角色弹出 */}
        {roleOpen && collapsed && (
          <div style={{
            position: "absolute", bottom: 0, left: 56,
            background: "#FDFCFA", border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            padding: "8px 6px", width: 180, zIndex: 100,
            animation: "roleSlideUp 0.2s ease-out",
          }}>
            <style>{`@keyframes roleSlideUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", padding: "4px 8px 6px", letterSpacing: 1 }}>切换角色</div>
            {ROLES.map(r => {
              const active = role === r.id;
              return (
                <button key={r.id} onClick={() => { setRole(r.id); setRoleOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 8px", marginBottom: 2,
                    background: active ? r.bg : "transparent",
                    border: active ? `1px solid ${r.color}30` : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: active ? r.color : "#d5d0c8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <r.Icon size={11} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? r.color : "#6a5a42" }}>{r.label}</div>
                  </div>
                  {active && <BadgeCheck size={12} style={{ color: r.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
        {/* 当前角色 */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={() => setRoleOpen(o => !o)} style={{
            display: "flex", alignItems: "center", flex: 1,
            padding: "12px 12px", background: "none", border: "none", cursor: "pointer",
            justifyContent: "flex-start", gap: 8,
          }}>
            {(() => { const cr = ROLES.find(r => r.id === role); return (<>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: cr.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                transition: "background 0.3s",
              }}>
                <cr.Icon size={15} strokeWidth={2} />
              </div>
              {!collapsed && (
                <div style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: "#2d2418", whiteSpace: "nowrap" }}>{cr.label}</div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: "#a09888", whiteSpace: "nowrap" }}>{cr.desc}</div>
                </div>
              )}
              {!collapsed && <ChevronUp size={12} style={{ color: "#a09888", flexShrink: 0, transform: roleOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
            </>); })()}
          </button>
          {/* 维度设置 — 角色栏右侧常驻按钮 */}
          {onOpenDimMgr && !collapsed && (
            <div onClick={e => { e.stopPropagation(); onOpenDimMgr(); }} title="评分维度设置" style={{
              width: 30, height: 30, borderRadius: 8, marginRight: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#a09888",
              background: "rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.05)",
              transition: "all 0.15s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#3a2a18"; e.currentTarget.style.background = "rgba(0,0,0,0.07)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#a09888"; e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            >
              <Settings2 size={14} strokeWidth={1.5} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
