import { useState } from "react";
import { INIT_PLANS, INIT_DIMS } from "./constants/mock-data.js";
import Sidebar from "./components/layout/Sidebar.jsx";
import Dashboard from "./pages/Dashboard/index.jsx";
import WorkBench from "./pages/WorkBench/index.jsx";
import SpellBook from "./pages/MCP/index.jsx";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [plans, setPlans] = useState(INIT_PLANS);
  const [role, setRole] = useState("admin");
  const [dims, setDims] = useState(INIT_DIMS);
  const [showDimMgr, setShowDimMgr] = useState(false);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F9F8F6", overflow: "hidden" }}>
      <Sidebar
        tab={tab} setTab={setTab}
        role={role} setRole={setRole}
        collapsed={collapsed} setCollapsed={setCollapsed}
        onResetBrowse={() => {}}
        onOpenDimMgr={role === "admin" ? () => setShowDimMgr(true) : null}
      />

      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ padding: "20px 0 40px" }}>
            {tab === "dashboard" && <Dashboard />}
            {tab === "workbench" && <WorkBench plans={plans} setPlans={setPlans} role={role} dims={dims} setDims={setDims} showDimMgr={showDimMgr} setShowDimMgr={setShowDimMgr} />}
            {tab === "mcp" && <SpellBook />}
          </div>
        </div>
      </div>
    </div>
  );
}
