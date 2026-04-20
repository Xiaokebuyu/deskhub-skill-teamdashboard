import { useState, useEffect } from "react";
import { Trash2, Copy, Check } from "lucide-react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { ROLES } from "../../constants/roles.js";
import { FInput, FSelect } from "../../components/ui/Form.jsx";
import SheetModal, { SheetCloseBtn } from "../../components/ui/SheetModal.jsx";
import { fetchUsers, createUser, deleteUser } from "../../services/workService.js";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const genPwd = (len = 8) => Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

const roleOpts = [
  { v: "admin", l: "管理员" },
  { v: "tester", l: "测试员" },
  { v: "member", l: "团队成员" },
];

/**
 * 用户管理面板 — admin 专用
 * Tab 1: 用户列表 + 删除
 * Tab 2: 创建用户 + 随机密码 + 一键复制
 */
export default function UserPanel({ show, onClose, token, currentUserId }) {
  const [tab, setTab] = useState("list");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 创建表单
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("member");

  // 创建成功一次性展示
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (show) {
      loadUsers();
      setTab("list");
      setError("");
      setCreatedUser(null);
    } else {
      setDeleteTarget(null);
      setCreatedUser(null);
    }
  }, [show]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsers(token);
      setUsers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newUsername.trim()) { setError("用户名必填"); return; }
    setError("");
    setLoading(true);
    const password = genPwd();
    try {
      await createUser({
        username: newUsername.trim(),
        password,
        role: newRole,
        displayName: newDisplayName.trim() || newUsername.trim(),
      }, token);
      setCreatedUser({ username: newUsername.trim(), password });
      setNewUsername("");
      setNewDisplayName("");
      setNewRole("member");
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id, token);
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败");
    }
  };

  const roleInfo = (id) => ROLES.find(r => r.id === id) || {};

  return (
    <SheetModal show={show} onClose={onClose} width={480}>
      {/* 标题栏 + tab */}
      <div style={{
        padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`,
        borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: GAP.base }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>
            用户管理
          </div>
          <SheetCloseBtn onClick={onClose} />
        </div>
          <div style={{ display: "flex", gap: GAP.lg }}>
            {[["list", "用户列表"], ["create", "创建用户"]].map(([k, l]) => (
              <div key={k} onClick={() => { setTab(k); setError(""); setCreatedUser(null); }} style={{
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, cursor: "pointer",
                color: tab === k ? COLOR.text : COLOR.sub,
                borderBottom: tab === k ? `2px solid ${COLOR.text}` : "2px solid transparent",
                paddingBottom: GAP.xs, transition: "all 0.15s",
              }}>{l}</div>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px ${GAP.xxl}px` }}>

          {error && (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.error, marginBottom: GAP.lg }}>
              {error}
            </div>
          )}

          {/* === 用户列表 === */}
          {tab === "list" && (
            <div>
              {loading && users.length === 0 && (
                <div style={{ textAlign: "center", padding: GAP.xxl, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub }}>
                  加载中...
                </div>
              )}
              {users.map(u => {
                const ri = roleInfo(u.role);
                const isDeleting = deleteTarget === u.id;
                return (
                  <div key={u.id} style={{
                    padding: `${GAP.base}px ${GAP.lg}px`, marginBottom: GAP.sm,
                    borderRadius: GAP.md, border: `1px solid ${COLOR.borderLt}`,
                    background: isDeleting ? "rgba(184,58,42,0.04)" : "rgba(0,0,0,0.015)",
                    transition: "background 0.15s",
                  }}>
                    {isDeleting ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text }}>
                          确认删除 <strong>{u.displayName}</strong>？
                        </span>
                        <div style={{ display: "flex", gap: GAP.md }}>
                          <button onClick={() => handleDelete(u.id)} style={{
                            padding: `3px ${GAP.base}px`, borderRadius: GAP.sm, cursor: "pointer",
                            background: COLOR.error, color: "#fff", border: "none",
                            fontFamily: FONT_SANS, fontSize: FONT_SIZE.md,
                          }}>删除</button>
                          <button onClick={() => setDeleteTarget(null)} style={{
                            padding: `3px ${GAP.base}px`, borderRadius: GAP.sm, cursor: "pointer",
                            background: "rgba(0,0,0,0.06)", border: `1px solid ${COLOR.border}`,
                            fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text,
                          }}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: GAP.md, minWidth: 0 }}>
                          <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500 }}>
                            {u.displayName}
                          </span>
                          <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.sub }}>
                            @{u.username}
                          </span>
                          <span style={{
                            padding: `1px ${GAP.md}px`, borderRadius: 99,
                            background: ri.bg || "rgba(0,0,0,0.06)",
                            fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm,
                            color: ri.color || COLOR.text3,
                          }}>
                            {ri.label || u.role}
                          </span>
                        </div>
                        {u.id !== currentUserId && (
                          <Trash2 size={14}
                            style={{ color: COLOR.dim, cursor: "pointer", flexShrink: 0, transition: "color 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.color = COLOR.error}
                            onMouseLeave={e => e.currentTarget.style.color = COLOR.dim}
                            onClick={() => setDeleteTarget(u.id)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!loading && users.length === 0 && (
                <div style={{ textAlign: "center", padding: GAP.xxl, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub }}>
                  暂无用户
                </div>
              )}
            </div>
          )}

          {/* === 创建用户 === */}
          {tab === "create" && !createdUser && (
            <div>
              <FInput label="用户名" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="登录用的唯一标识" />
              <FInput label="显示名称" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="选填，默认同用户名" />
              <FSelect label="角色" value={newRole} onChange={setNewRole} options={roleOpts} />
              <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.sub, marginBottom: GAP.xl }}>
                密码将自动生成，创建后一次性展示
              </div>
              <button onClick={handleCreate} disabled={loading || !newUsername.trim()} style={{
                width: "100%", padding: `${GAP.base}px`, borderRadius: GAP.md,
                cursor: loading || !newUsername.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
                background: newUsername.trim() ? COLOR.btn : COLOR.borderLt,
                color: newUsername.trim() ? COLOR.btnText : "#b5b0a5",
                border: newUsername.trim() ? `1px solid ${COLOR.btn}` : `1px solid ${COLOR.borderMd}`,
                opacity: newUsername.trim() ? 1 : 0.6,
                transition: "all 0.15s",
              }}>{loading ? "创建中..." : "创建用户"}</button>
            </div>
          )}

          {/* === 创建成功 === */}
          {tab === "create" && createdUser && (
            <div>
              <div style={{
                textAlign: "center", marginBottom: GAP.xl,
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.success, fontWeight: 500,
              }}>
                用户创建成功
              </div>

              <div style={{
                padding: GAP.lg, borderRadius: GAP.md,
                background: "rgba(0,0,0,0.03)", border: `1px solid ${COLOR.border}`,
                marginBottom: GAP.lg,
              }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>
                  账号信息
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: GAP.sm }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub }}>用户名</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text }}>{createdUser.username}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub }}>密码</span>
                  <div style={{ display: "flex", alignItems: "center", gap: GAP.md }}>
                    <span style={{
                      fontFamily: FONT_MONO, fontSize: FONT_SIZE.lg, color: COLOR.text,
                      padding: `2px ${GAP.md}px`, background: "rgba(255,255,255,0.6)",
                      border: "1px dashed rgba(0,0,0,0.12)", borderRadius: GAP.sm,
                      letterSpacing: "0.05em",
                    }}>
                      {createdUser.password}
                    </span>
                    <div
                      onClick={() => handleCopy(`用户名: ${createdUser.username}\n密码: ${createdUser.password}`)}
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", background: copied ? "rgba(74,138,74,0.12)" : "rgba(0,0,0,0.06)",
                        border: `1px solid ${copied ? "rgba(74,138,74,0.2)" : COLOR.border}`,
                        transition: "all 0.15s",
                      }}
                      title="复制账号密码"
                    >
                      {copied ? <Check size={13} color={COLOR.success} /> : <Copy size={13} color={COLOR.text5} />}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.error,
                textAlign: "center", marginBottom: GAP.xl,
              }}>
                请立即保存此密码，关闭后无法再次查看
              </div>

              <div
                onClick={() => { setCreatedUser(null); setCopied(false); setError(""); }}
                style={{
                  textAlign: "center", fontFamily: FONT_SANS, fontSize: FONT_SIZE.base,
                  color: COLOR.blue, cursor: "pointer", padding: GAP.md,
                }}
              >
                继续创建
              </div>
            </div>
          )}
        </div>
    </SheetModal>
  );
}
