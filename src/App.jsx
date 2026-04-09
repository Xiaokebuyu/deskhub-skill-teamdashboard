import { useState, useEffect } from "react";
import { INIT_PLANS, INIT_DIMS } from "./constants/mock-data.js";
import { fetchPlans, fetchDimensions } from "./services/workService.js";
import { COLOR, GAP } from "./constants/theme.js";
import Sidebar from "./components/layout/Sidebar.jsx";
import Dashboard from "./pages/Dashboard/index.jsx";
import WorkBench from "./pages/WorkBench/index.jsx";
import SpellBook from "./pages/MCP/index.jsx";
import Login from "./pages/Login.jsx";
import UserPanel from "./pages/WorkBench/UserPanel.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";

const USE_API = import.meta.env.VITE_USE_API !== 'false';
const AUTH_KEY = 'deskskill_auth';

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [plans, setPlans] = useState(USE_API ? [] : INIT_PLANS);
  const [dims, setDims] = useState(USE_API ? [] : INIT_DIMS);
  const [showDimMgr, setShowDimMgr] = useState(false);
  const [showUserMgr, setShowUserMgr] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  // 登录态: { token, user: { userId, username, role, displayName } }
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const role = auth?.user?.role || 'member';
  const user = auth?.user?.username || '';
  const token = auth?.token || '';

  // 初始化：从 localStorage 恢复登录态
  useEffect(() => {
    if (!USE_API) {
      setAuthLoading(false);
      setAuth({ token: '', user: { userId: 'mock', username: 'admin', role: 'admin', displayName: '管理员' } });
      return;
    }
    const saved = localStorage.getItem(AUTH_KEY);
    if (!saved) { setAuthLoading(false); return; }
    try {
      const { token: savedToken } = JSON.parse(saved);
      if (!savedToken) { setAuthLoading(false); return; }
      // 验证 token
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(json => {
          setAuth({ token: savedToken, user: json.data });
        })
        .catch(() => {
          localStorage.removeItem(AUTH_KEY);
        })
        .finally(() => setAuthLoading(false));
    } catch {
      localStorage.removeItem(AUTH_KEY);
      setAuthLoading(false);
    }
  }, []);

  // 登录成功后加载 plans + dims
  useEffect(() => {
    if (!USE_API || !auth?.token) return;
    let cancelled = false;
    Promise.allSettled([fetchPlans(auth.token), fetchDimensions(auth.token)])
      .then(([plansRes, dimsRes]) => {
        if (cancelled) return;
        if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value)) {
          setPlans(plansRes.value);
        }
        if (dimsRes.status === "fulfilled" && Array.isArray(dimsRes.value)) {
          setDims(dimsRes.value);
        }
      });
    return () => { cancelled = true; };
  }, [auth?.token]);

  const handleLogin = (loginToken, loginUser) => {
    const authData = { token: loginToken, user: loginUser };
    setAuth(authData);
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  };

  const handleLogout = () => {
    if (!window.confirm("确定退出登录吗？")) return;
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuth(null);
    localStorage.removeItem(AUTH_KEY);
    setPlans([]);
    setDims([]);
    setTab("dashboard");
  };

  // 加载中
  if (authLoading) return null;

  // 未登录 → 登录页
  if (USE_API && !auth) return <Login onLogin={handleLogin} />;

  return (
    <div style={{ display: "flex", height: "100vh", background: COLOR.bg, overflow: "hidden" }}>
      <Sidebar
        tab={tab} setTab={setTab}
        role={role}
        user={auth?.user}
        onLogout={handleLogout}
        collapsed={collapsed} setCollapsed={setCollapsed}
        onResetBrowse={() => {}}
        onOpenDimMgr={role === "admin" ? () => {
          if (tab !== "workbench") setTab("workbench");
          setShowDimMgr(true);
        } : null}
        onOpenUserMgr={role === "admin" ? () => setShowUserMgr(true) : null}
        onOpenChangePwd={() => setShowChangePwd(true)}
      />

      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: `0 ${GAP.xxl}px` }}>
          <div style={{ padding: `${GAP.xxl}px 0 ${GAP.page}px` }}>
            {tab === "dashboard" && <Dashboard />}
            {tab === "workbench" && <WorkBench plans={plans} setPlans={setPlans} role={role} user={user} token={token} dims={dims} setDims={setDims} showDimMgr={showDimMgr} setShowDimMgr={setShowDimMgr} />}
            {tab === "mcp" && <SpellBook />}
          </div>
        </div>
      </div>

      <UserPanel show={showUserMgr} onClose={() => setShowUserMgr(false)} token={token} currentUserId={auth?.user?.userId} />
      <ChangePassword show={showChangePwd} onClose={() => setShowChangePwd(false)} token={token} />
    </div>
  );
}
