import { useState, useEffect } from "react";
import { INIT_PLANS, INIT_DIMS } from "./constants/mock-data.js";
import { fetchPlans, fetchDimensions } from "./services/workService.js";
import { COLOR, GAP } from "./constants/theme.js";
import Sidebar from "./components/layout/Sidebar.jsx";
import Dashboard from "./pages/Dashboard/index.jsx";
import WorkBench from "./pages/WorkBench/index.jsx";
import SpellBook from "./pages/MCP/index.jsx";

const USE_API = import.meta.env.VITE_USE_API !== 'false';

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [plans, setPlans] = useState(USE_API ? [] : INIT_PLANS);
  const [role, setRole] = useState("admin");
  const [dims, setDims] = useState(USE_API ? [] : INIT_DIMS);
  const [showDimMgr, setShowDimMgr] = useState(false);

  // 从后端 API 加载 plans + dims
  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    Promise.allSettled([fetchPlans(), fetchDimensions()])
      .then(([plansRes, dimsRes]) => {
        if (cancelled) return;
        if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value)) {
          setPlans(plansRes.value);
        } else {
          console.warn("[App] plans API 不可用");
        }
        if (dimsRes.status === "fulfilled" && Array.isArray(dimsRes.value)) {
          setDims(dimsRes.value);
        } else {
          console.warn("[App] dims API 不可用");
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", background: COLOR.bg, overflow: "hidden" }}>
      <Sidebar
        tab={tab} setTab={setTab}
        role={role} setRole={setRole}
        collapsed={collapsed} setCollapsed={setCollapsed}
        onResetBrowse={() => {}}
        onOpenDimMgr={role === "admin" ? () => {
          if (tab !== "workbench") setTab("workbench");
          setShowDimMgr(true);
        } : null}
      />

      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: `0 ${GAP.xxl}px` }}>
          <div style={{ padding: `${GAP.xxl}px 0 ${GAP.page}px` }}>
            {tab === "dashboard" && <Dashboard />}
            {tab === "workbench" && <WorkBench plans={plans} setPlans={setPlans} role={role} dims={dims} setDims={setDims} showDimMgr={showDimMgr} setShowDimMgr={setShowDimMgr} />}
            {tab === "mcp" && <SpellBook />}
          </div>
        </div>
      </div>
    </div>
  );
}
