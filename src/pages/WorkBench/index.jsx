import { useState, useCallback, useMemo } from "react";
import { Settings2, Flame, ScrollText, BadgeCheck } from "lucide-react";
import { INIT_DIMS } from "../../constants/mock-data.js";
import { PLAN_PHASE, PLAN_RESULT } from "../../constants/status.js";
import { PRI } from "../../constants/priority.js";
import { FONT_SANS } from "../../constants/theme.js";
import { getPhase } from "../../utils/helpers.js";
import { nDid } from "../../utils/helpers.js";
import Stat from "../../components/ui/Stat.jsx";
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import { FormModal, FInput, FSelect, FBtn } from "../../components/ui/Form.jsx";
import WoSection from "./WoSection.jsx";
import WoDeskRow from "./WoDeskRow.jsx";
import WoBrowse from "./WoBrowse.jsx";
import WoFullPanel from "./WoFullPanel.jsx";
import useWorkOrders from "./useWorkOrders.js";

const TYPE_OPTIONS = [
  { id: "skill", label: "Skill" },
  { id: "mcp", label: "MCP" },
];

export default function WorkBench({ plans, setPlans, role }) {
  const [typeFilter, setTypeFilter] = useState("skill");
  const [dims, setDims] = useState(INIT_DIMS);
  const [fMode, setFMode] = useState(null);
  const [fData, setFData] = useState({});
  const [browseSection, setBrowseSection] = useState(null);
  const [showDimMgr, setShowDimMgr] = useState(false);
  const [newDim, setNewDim] = useState("");

  // 第三层 FullPanel 状态
  const [fullWo, setFullWo] = useState(null);
  const [showFull, setShowFull] = useState(false);
  const [fullOriginRect, setFullOriginRect] = useState(null);

  const ops = useWorkOrders(plans, setPlans);
  const activeDims = dims.filter(d => d.active);

  // 按类型过滤
  const filtered = useMemo(() => plans.filter(p => p.type === typeFilter), [plans, typeFilter]);

  // 分组
  const active = filtered.filter(p => p.status === "active");
  const next = filtered.filter(p => p.status === "next");
  const done = filtered.filter(p => p.status === "done");

  // 进行中按子阶段分组
  const activeByPhase = useMemo(() => {
    const groups = { collecting: [], evaluating: [], finalizing: [] };
    active.forEach(p => {
      const phase = getPhase(p, activeDims);
      groups[phase].push(p);
    });
    return groups;
  }, [active, activeDims]);

  // 下期规划按优先级分组
  const nextByPriority = useMemo(() => {
    const groups = { high: [], medium: [], low: [] };
    next.forEach(p => groups[p.priority].push(p));
    return groups;
  }, [next]);

  // 已完成按结果分组
  const doneByResult = useMemo(() => {
    const groups = { adopted: [], shelved: [] };
    done.forEach(p => groups[p.result || "adopted"].push(p));
    return groups;
  }, [done]);

  // 展开 FullPanel
  const handleExpandFull = useCallback(wo => {
    // 从 plans 取最新数据
    const latest = plans.find(p => p.id === wo.id) || wo;
    setFullWo(latest);
    // 简单的默认 originRect（页面中心）
    setFullOriginRect({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 150, width: 300, height: 200 });
    setTimeout(() => setShowFull(true), 50);
  }, [plans]);

  const handleCloseFull = useCallback(() => {
    setShowFull(false);
    setTimeout(() => { setFullWo(null); setFullOriginRect(null); }, 500);
  }, []);

  // 表单操作
  const openCreate = () => {
    setFMode("create");
    setFData({ name: "", type: typeFilter, status: "next", priority: "medium", desc: "" });
  };
  const openAddVar = (wo) => {
    setFMode("addVar");
    setFData({ planId: wo.id, name: "", uploader: "", desc: "", link: "" });
  };
  const openMarkComplete = (wo) => {
    setFMode("complete");
    setFData({ planId: wo.id, result: "adopted" });
  };

  const save = () => {
    if (fMode === "create") {
      ops.addPlan(fData);
    } else if (fMode === "addVar" && fData.planId) {
      ops.addVariant(fData.planId, fData);
      // 刷新 fullWo
      if (fullWo && fullWo.id === fData.planId) {
        setTimeout(() => {
          const latest = plans.find(p => p.id === fData.planId);
          if (latest) setFullWo({ ...latest });
        }, 50);
      }
    } else if (fMode === "complete" && fData.planId) {
      ops.completePlan(fData.planId, fData.result);
      handleCloseFull();
    }
    setFMode(null);
  };

  // 维度管理
  const addDim = () => { if (!newDim.trim()) return; setDims(prev => [...prev, { id: nDid(), name: newDim.trim(), max: 5, active: true }]); setNewDim(""); };
  const delDim = id => setDims(prev => prev.filter(d => d.id !== id));
  const toggleDim = id => setDims(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  const editDim = (id, field, val) => setDims(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));

  // 浏览模式
  if (browseSection) {
    let bWos = [];
    if (browseSection === "active") bWos = active;
    else if (browseSection === "next") bWos = next;
    else if (browseSection === "done") bWos = done;
    return (
      <>
        <WoBrowse label={browseSection === "active" ? "进行中" : browseSection === "next" ? "下期规划" : "已完成"} wos={bWos} onBack={() => setBrowseSection(null)} onSelect={handleExpandFull} />
        <WoFullPanel wo={fullWo} dims={dims} show={showFull} originRect={fullOriginRect} onClose={handleCloseFull}
          onUpdate={ops.updatePlan} role={role} onAddVariant={openAddVar} onMarkComplete={openMarkComplete} />
        {formUI()}
      </>
    );
  }

  function formUI() {
    if (!fMode) return null;
    return (
      <FormModal title={fMode === "create" ? "新建工单" : fMode === "addVar" ? "添加方案" : "标记完成"} show={true} onClose={() => setFMode(null)}>
        {fMode === "create" && <>
          <FInput label="工单名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 PPT生成优化" />
          <FSelect label="类型" value={fData.type} onChange={v => setFData(p => ({ ...p, type: v }))} options={[{ v: "skill", l: "Skill" }, { v: "mcp", l: "MCP" }]} />
          <FSelect label="优先级" value={fData.priority} onChange={v => setFData(p => ({ ...p, priority: v }))} options={[{ v: "high", l: "高", c: "#b83a2a" }, { v: "medium", l: "中", c: "#b8861a" }, { v: "low", l: "低", c: "#5a8a5a" }]} />
          <FInput label="描述" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} multiline />
          <FBtn label="创建" onClick={save} full />
        </>}
        {fMode === "addVar" && <>
          <FInput label="方案名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 NotebookLM 方案" />
          <FInput label="上传人" value={fData.uploader} onChange={e => setFData(p => ({ ...p, uploader: e.target.value }))} />
          <FInput label="方案说明" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} placeholder="简述技术路线、优缺点等" multiline />
          <FInput label="文件/链接" value={fData.link} onChange={e => setFData(p => ({ ...p, link: e.target.value }))} placeholder="方案文档地址（选填）" />
          <FBtn label="添加" onClick={save} full />
        </>}
        {fMode === "complete" && <>
          <FSelect label="完成结果" value={fData.result} onChange={v => setFData(p => ({ ...p, result: v }))} options={[{ v: "adopted", l: "已采纳", c: "#4a8a4a" }, { v: "shelved", l: "已搁置", c: "#8a8580" }]} />
          <FBtn label="确认" onClick={save} full />
        </>}
      </FormModal>
    );
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* 顶部栏 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <ToggleSwitch options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
        <div style={{ flex: 1 }} />
        {role === "admin" && (
          <div onClick={() => setShowDimMgr(true)} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "6px 12px", border: "1px dashed rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}>
            <Settings2 size={13} /><span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a09888" }}>维度</span>
          </div>
        )}
      </div>

      {/* 指标栏 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="工单总数" value={filtered.length} color="#6a5a42" />
        <Stat label="进行中" value={active.length} color="#b85c1a" />
        <Stat label="下期规划" value={next.length} color="#3a6a3a" />
        <Stat label="总方案" value={filtered.reduce((a, p) => a + p.variants.length, 0)} color="#8a8580" />
        {role === "admin" && (
          <div onClick={openCreate} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 10, padding: "8px 14px", border: "1px dashed rgba(0,0,0,0.08)", textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}>
            <span style={{ fontSize: 16 }}>+</span><span style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#a09888" }}>新建工单</span>
          </div>
        )}
      </div>

      {/* 🔥 进行中 */}
      {active.length > 0 && (
        <WoSection title="进行中" icon={<Flame size={15} strokeWidth={1.5} color="#b85c1a" />} count={active.length}>
          {Object.entries(activeByPhase).map(([phase, wos]) =>
            wos.length > 0 && (
              <WoDeskRow key={phase}
                label={PLAN_PHASE[phase].l} labelColor={PLAN_PHASE[phase].c}
                icon={null}
                wos={wos} dims={dims}
                onSelect={handleExpandFull}
                onViewAll={() => setBrowseSection("active")}
                onExpandFull={handleExpandFull}
              />
            )
          )}
        </WoSection>
      )}

      {/* 📋 下期规划 */}
      {next.length > 0 && (
        <WoSection title="下期规划" icon={<ScrollText size={15} strokeWidth={1.5} color="#3a6a3a" />} count={next.length}>
          {Object.entries(nextByPriority).map(([pri, wos]) =>
            wos.length > 0 && (
              <WoDeskRow key={pri}
                label={PRI[pri].l} labelColor={PRI[pri].c}
                icon={null}
                wos={wos} dims={dims}
                onSelect={handleExpandFull}
                onViewAll={() => setBrowseSection("next")}
                onExpandFull={handleExpandFull}
              />
            )
          )}
        </WoSection>
      )}

      {/* ✅ 已完成 */}
      {done.length > 0 && (
        <WoSection title="已完成" icon={<BadgeCheck size={15} strokeWidth={1.5} color="#5a4a30" />} count={done.length} collapsible defaultCollapsed>
          {Object.entries(doneByResult).map(([result, wos]) =>
            wos.length > 0 && (
              <WoDeskRow key={result}
                label={PLAN_RESULT[result].l} labelColor={PLAN_RESULT[result].c}
                icon={null}
                wos={wos} dims={dims}
                onSelect={handleExpandFull}
                onViewAll={() => setBrowseSection("done")}
                onExpandFull={handleExpandFull}
              />
            )
          )}
        </WoSection>
      )}

      {/* 空状态 */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: FONT_SANS, fontSize: 16, color: "#a09888" }}>
          暂无 {typeFilter === "skill" ? "Skill" : "MCP"} 工单
        </div>
      )}

      {/* FullPanel 第三层 */}
      <WoFullPanel wo={fullWo} dims={dims} show={showFull} originRect={fullOriginRect} onClose={handleCloseFull}
        onUpdate={ops.updatePlan} role={role} onAddVariant={openAddVar} onMarkComplete={openMarkComplete} />

      {/* 表单 */}
      {formUI()}

      {/* 维度管理 */}
      {showDimMgr && (
        <FormModal title="管理评分维度" show={true} onClose={() => setShowDimMgr(false)}>
          {dims.map(d => (
            <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", opacity: d.active ? 1 : 0.45 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <input value={d.name} onChange={e => editDim(d.id, "name", e.target.value)} style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#3a2a18", background: "transparent", border: "none", borderBottom: "1px dashed rgba(0,0,0,0.08)", outline: "none", padding: "0 0 2px", width: 100 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button onClick={() => toggleDim(d.id)} style={{ padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12, border: d.active ? "1px solid rgba(74,138,74,0.4)" : "1px solid rgba(0,0,0,0.06)", background: d.active ? "rgba(74,138,74,0.12)" : "rgba(0,0,0,0.05)", color: d.active ? "#4a8a4a" : "#a89a78", transition: "all 0.15s" }}>{d.active ? "启用中" : "已禁用"}</button>
                  <button onClick={() => delDim(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12, color: "#b83a2a" }}>删除</button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#9a8a68" }}>满分</span>
                {[3, 5, 10].map(n => (
                  <button key={n} onClick={() => editDim(d.id, "max", n)} style={{ padding: "1px 6px", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12, border: d.max === n ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(0,0,0,0.06)", background: d.max === n ? "rgba(0,0,0,0.08)" : "transparent", color: "#4a4540" }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={newDim} onChange={e => setNewDim(e.target.value)} placeholder="新维度名称" style={{ flex: 1, padding: "6px 10px", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: "#3a2a18", outline: "none" }} />
            <FBtn label="添加" onClick={addDim} />
          </div>
        </FormModal>
      )}
    </div>
  );
}
