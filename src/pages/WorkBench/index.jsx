import { useState, useCallback, useMemo, useRef } from "react";
import { Settings2, Flame, ScrollText, BadgeCheck } from "lucide-react";
import { INIT_DIMS } from "../../constants/mock-data.js";
import { PLAN_PHASE, PLAN_RESULT } from "../../constants/status.js";
import { PRI } from "../../constants/priority.js";
import { FONT_SANS } from "../../constants/theme.js";
import { getPhase, avgScore } from "../../utils/helpers.js";
import { nDid } from "../../utils/helpers.js";
import Stat from "../../components/ui/Stat.jsx";
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import { FormModal, FInput, FSelect, FBtn } from "../../components/ui/Form.jsx";
import WoSection from "./WoSection.jsx";
import WoDeskRow from "./WoDeskRow.jsx";
import WoBrowse from "./WoBrowse.jsx";
import WoFullPanel from "./WoFullPanel.jsx";
import DocReader from "./DocReader.jsx";
import ScorePanel from "./ScorePanel.jsx";
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

  // DocReader + ScorePanel 状态
  const [docReaderData, setDocReaderData] = useState(null);
  const [showDocReader, setShowDocReader] = useState(false);
  const [showScorePanel, setShowScorePanel] = useState(false);

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

  // 卡片飞回回调 — FullPanel 关闭后触发卡片收回动画
  const cardReturnRef = useRef(null);

  // 展开 FullPanel（接收 originRect 和卡片飞回回调）
  const handleExpandFull = useCallback((wo, rect, cardReturnFn) => {
    const latest = plans.find(p => p.id === wo.id) || wo;
    setFullWo(latest);
    setFullOriginRect(rect || { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 180, width: 360, height: 200 });
    cardReturnRef.current = cardReturnFn || null;
    setTimeout(() => setShowFull(true), 50);
  }, [plans]);

  const handleCloseFull = useCallback(() => {
    setShowFull(false);
    // FullPanel 收缩动画 500ms → 触发卡片飞回动画
    setTimeout(() => {
      setFullWo(null);
      setFullOriginRect(null);
      if (cardReturnRef.current) {
        cardReturnRef.current(); // condense → fly-back
        cardReturnRef.current = null;
      }
    }, 450);
  }, []);

  // DocReader
  const openDocReader = (variant) => {
    if (variant.content) {
      setDocReaderData({ title: variant.name, content: variant.content });
      setShowDocReader(true);
    }
  };
  const closeDocReader = () => {
    setShowDocReader(false);
    setTimeout(() => setDocReaderData(null), 450);
  };

  // ScorePanel
  const openScorePanel = () => setShowScorePanel(true);
  const closeScorePanel = () => setShowScorePanel(false);
  const handleScoreSubmit = (planId, variantId, scoreEntries) => {
    ops.submitScores(planId, variantId, scoreEntries);
    setTimeout(() => {
      const latest = plans.find(p => p.id === planId);
      if (latest) setFullWo({ ...latest });
    }, 50);
    setShowScorePanel(false);
  };

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
    // 自动选中评分最高的方案，但管理员可以改
    const activeDimsLocal = dims.filter(d => d.active);
    const ranked = [...wo.variants].map(v => ({ ...v, avg: avgScore(v, activeDimsLocal) })).sort((a, b) => b.avg - a.avg);
    const topVariant = ranked.find(v => v.avg > 0);
    setFMode("complete");
    setFData({ planId: wo.id, result: "adopted", selectedVariantId: topVariant?.id || null, variants: ranked });
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
  const addDim = () => { if (!newDim.trim()) return; setDims(prev => [...prev, { id: nDid(), name: newDim.trim(), max: 10, active: true }]); setNewDim(""); };
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
          role={role} onAddVariant={openAddVar} onMarkComplete={openMarkComplete}
          onOpenScorePanel={openScorePanel} onOpenDocReader={openDocReader} />
        {formUI()}
        {docReaderData && <DocReader show={showDocReader} onClose={closeDocReader} title={docReaderData.title} content={docReaderData.content} />}
        {showScorePanel && fullWo && <ScorePanel show={true} onClose={closeScorePanel} wo={fullWo} dims={dims} onSubmitScores={handleScoreSubmit} />}
      </>
    );
  }

  function formUI() {
    if (!fMode) return null;

    const titles = { create: "新建工单", addVar: "添加方案", complete: "定稿" };

    return (
      <div onClick={() => setFMode(null)} style={{
        position: "fixed", inset: 0, zIndex: 800,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: 1, transition: "opacity 0.3s",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: fMode === "complete" ? 400 : 380,
          background: "linear-gradient(180deg, #fdfcfa 0%, #fff 30%)",
          border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
          boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
          overflow: "hidden",
          transform: "scale(1) translateY(0)",
          transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
        }}>
          {/* 标题栏 */}
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600, color: "#3a2a18" }}>
              {titles[fMode]}
            </div>
          </div>

          {/* 表单内容 */}
          <div style={{ padding: "16px 20px" }}>
            {fMode === "create" && <>
              <FInput label="工单名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 PPT生成优化" />
              <FSelect label="类型" value={fData.type} onChange={v => setFData(p => ({ ...p, type: v }))} options={[{ v: "skill", l: "Skill" }, { v: "mcp", l: "MCP" }]} />
              <FSelect label="优先级" value={fData.priority} onChange={v => setFData(p => ({ ...p, priority: v }))} options={[{ v: "high", l: "高", c: "#b83a2a" }, { v: "medium", l: "中", c: "#b8861a" }, { v: "low", l: "低", c: "#5a8a5a" }]} />
              <FInput label="描述" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} multiline />
            </>}
            {fMode === "addVar" && <>
              <FInput label="方案名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 NotebookLM 方案" />
              <FInput label="上传人" value={fData.uploader} onChange={e => setFData(p => ({ ...p, uploader: e.target.value }))} />
              <FInput label="方案说明" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} placeholder="简述技术路线、优缺点等" multiline />
              <FInput label="文件/链接" value={fData.link} onChange={e => setFData(p => ({ ...p, link: e.target.value }))} placeholder="方案文档地址（选填）" />
            </>}
            {fMode === "complete" && <>
              {/* 结论选择 */}
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>定稿结论</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { v: "adopted", l: "采纳方案", desc: "选定方案，内置上线" },
                  { v: "shelved", l: "搁置", desc: "暂不推进，保留记录" },
                ].map(o => (
                  <div key={o.v} onClick={() => setFData(p => ({ ...p, result: o.v }))}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      border: fData.result === o.v ? "2px solid #3a2a18" : "1px solid rgba(0,0,0,0.08)",
                      background: fData.result === o.v ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.02)",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 600, color: "#3a2a18", marginBottom: 4 }}>{o.l}</div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#8a7a62" }}>{o.desc}</div>
                  </div>
                ))}
              </div>

              {/* 采纳时：方案排名 + 选择 */}
              {fData.result === "adopted" && fData.variants && fData.variants.length > 0 && <>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>选定采纳方案</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                  {fData.variants.map((v, i) => (
                    <div key={v.id} onClick={() => setFData(p => ({ ...p, selectedVariantId: v.id }))}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        border: fData.selectedVariantId === v.id ? "2px solid #3a2a18" : "1px solid rgba(0,0,0,0.06)",
                        background: fData.selectedVariantId === v.id ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.01)",
                        transition: "all 0.15s",
                      }}>
                      <div>
                        <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18", fontWeight: 500 }}>
                          {i === 0 && v.avg > 0 && <span style={{ marginRight: 4 }}>🥇</span>}
                          {i === 1 && v.avg > 0 && <span style={{ marginRight: 4 }}>🥈</span>}
                          {i === 2 && v.avg > 0 && <span style={{ marginRight: 4 }}>🥉</span>}
                          {v.name}
                        </div>
                        <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginTop: 2 }}>
                          {v.uploader} · {v.uploaded}
                        </div>
                      </div>
                      <div style={{
                        fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600,
                        color: v.avg > 0 ? (i === 0 ? "#8a6a3a" : "#3a2a18") : "#c4bfb5",
                      }}>
                        {v.avg > 0 ? v.avg.toFixed(1) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </>}
            </>}
          </div>

          {/* 底部按钮 */}
          <div style={{ padding: "0 20px 16px", display: "flex", gap: 10 }}>
            <button onClick={() => setFMode(null)} style={{
              flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
              fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
              background: "rgba(0,0,0,0.04)", color: "#5a5550",
              border: "1px solid rgba(0,0,0,0.08)", transition: "all 0.15s",
            }}>取消</button>
            <button onClick={save} style={{
              flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
              fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
              background: "#2d2418", color: "#f5f0e8",
              border: "1px solid #2d2418", transition: "all 0.15s",
            }}>{fMode === "create" ? "创建" : fMode === "addVar" ? "添加" : "确认定稿"}</button>
          </div>
        </div>
      </div>
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
                fullPanelOpen={showFull}
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
                fullPanelOpen={showFull}
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
                fullPanelOpen={showFull}
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
        role={role} onAddVariant={openAddVar} onMarkComplete={openMarkComplete}
        onOpenScorePanel={openScorePanel} onOpenDocReader={openDocReader} />

      {/* 表单 */}
      {formUI()}

      {/* DocReader + ScorePanel */}
      {docReaderData && <DocReader show={showDocReader} onClose={closeDocReader} title={docReaderData.title} content={docReaderData.content} />}
      {showScorePanel && fullWo && <ScorePanel show={true} onClose={closeScorePanel} wo={fullWo} dims={dims} onSubmitScores={handleScoreSubmit} />}

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
