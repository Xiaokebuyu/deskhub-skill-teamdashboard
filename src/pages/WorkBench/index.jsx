import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Flame, ScrollText, BadgeCheck, Upload, File, X } from "lucide-react";
import { PLAN_PHASE, PLAN_RESULT } from "../../constants/status.js";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { getPhase, avgScore } from "../../utils/helpers.js";
import { nDid } from "../../utils/helpers.js";
import Stat from "../../components/ui/Stat.jsx";
import ToggleSwitch from "../../components/ui/ToggleSwitch.jsx";
import { FInput, FSelect } from "../../components/ui/Form.jsx";
import MarkdownInput from "../../components/ui/MarkdownInput.jsx";
import WoSection from "./WoSection.jsx";
import WoDeskRow from "./WoDeskRow.jsx";
import WoBrowse from "./WoBrowse.jsx";
import WoFullPanel from "./WoFullPanel.jsx";
import DocReader from "./DocReader.jsx";
import ScorePanel from "./ScorePanel.jsx";
import VariantManager from "./VariantManager.jsx";
import useWorkOrders from "./useWorkOrders.js";
import * as workApi from "../../services/workService.js";

const USE_API = import.meta.env.VITE_USE_API !== 'false';

const TYPE_OPTIONS = [
  { id: "skill", label: "Skill" },
  { id: "mcp", label: "MCP" },
];

export default function WorkBench({ plans, setPlans, role, user, token, dims, setDims, showDimMgr, setShowDimMgr }) {
  const [typeFilter, setTypeFilter] = useState("skill");
  const [fMode, setFMode] = useState(null);
  const [fData, setFData] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [browseSection, setBrowseSection] = useState(null);
  const [newDim, setNewDim] = useState("");

  // 第三层 FullPanel 状态
  const [fullWo, setFullWo] = useState(null);
  const [showFull, setShowFull] = useState(false);
  const [fullOriginRect, setFullOriginRect] = useState(null);

  // DocReader + ScorePanel + VariantManager 状态
  const [docReaderData, setDocReaderData] = useState(null);
  const [showDocReader, setShowDocReader] = useState(false);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [scoreEditData, setScoreEditData] = useState(null);
  const [showVarMgr, setShowVarMgr] = useState(false);

  // 添加方案附件上传
  const addVarFileRef = useRef(null);
  const handleAddVarFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const uploaded = await workApi.uploadFiles(files, token);
      setFData(p => ({ ...p, attachments: [...(p.attachments || []), ...uploaded] }));
    } catch (err) {
      console.error("Upload failed:", err);
    }
    e.target.value = "";
  };

  // 维度回滚机制
  const dimsSnapRef = useRef(null);
  const snapDims = () => { dimsSnapRef.current = dims; };
  const rollbackDims = (err) => {
    console.error('[dims] API 失败，回滚:', err?.message || err);
    if (dimsSnapRef.current) setDims(dimsSnapRef.current);
  };

  const ops = useWorkOrders(plans, setPlans, role, user, token);
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

  // fullWo 与 plans 自动同步 — 任何 plans 变更自动反映到 FullPanel
  useEffect(() => {
    if (fullWo) {
      const latest = plans.find(p => p.id === fullWo.id);
      if (latest && latest !== fullWo) setFullWo(latest);
    }
  }, [plans]);

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

  // DocReader — 接受 {name,content}(方案) 或 {title,content}(评测文档)
  const openDocReader = (doc) => {
    const content = doc.content;
    if (!content) return;
    setDocReaderData({ title: doc.title || doc.name || "文档", content });
    setShowDocReader(true);
  };
  const closeDocReader = () => {
    setShowDocReader(false);
    setTimeout(() => setDocReaderData(null), 450);
  };

  // ScorePanel
  const openScorePanel = (editData) => {
    setScoreEditData(editData || null);
    setShowScorePanel(true);
  };
  const closeScorePanel = () => {
    setShowScorePanel(false);
    setTimeout(() => setScoreEditData(null), 400);
  };
  const handleScoreSubmit = (planId, variantId, scoreEntries) => {
    ops.submitScores(planId, variantId, scoreEntries);
    setShowScorePanel(false);
  };

  // VariantManager
  const openVarMgr = () => setShowVarMgr(true);
  const closeVarMgr = () => setShowVarMgr(false);

  // 表单操作 — mount 后下一帧再展开，确保入场动画生效
  const openForm = (mode, data) => {
    setFMode(mode);
    setFData(data);
    requestAnimationFrame(() => requestAnimationFrame(() => setShowForm(true)));
  };
  const closeForm = () => {
    setShowForm(false);
    setTimeout(() => { setFMode(null); setFData({}); }, 400);
  };

  const openCreate = () => openForm("create", {
    name: "", type: typeFilter, status: "next", priority: "medium", desc: "",
    deadline: "", owner: "",
  });
  const openAddVar = (wo) => openForm("addVar", { planId: wo.id, name: "", uploader: user, desc: "", link: "", content: "", attachments: [], showDocEditor: false });
  const openMarkComplete = (wo) => {
    const activeDimsLocal = dims.filter(d => d.active);
    const vars = wo?.variants || [];
    const ranked = vars.map(v => ({ id: v.id, name: v.name, uploader: v.uploader, uploaded: v.uploaded, avg: avgScore(v, activeDimsLocal) })).sort((a, b) => b.avg - a.avg);
    const topVariant = ranked.find(v => v.avg > 0);
    openForm("complete", { planId: wo.id, result: "adopted", selectedVariantId: topVariant?.id || null, variants: ranked });
  };

  const save = () => {
    if (fMode === "create") {
      ops.addPlan(fData);
      closeForm();
    } else if (fMode === "addVar" && fData.planId) {
      ops.addVariant(fData.planId, fData);
      closeForm();
    } else if (fMode === "complete" && fData.planId) {
      ops.completePlan(fData.planId, fData.result);
      // 串行关闭：先关 formUI，完全消失后再关 FullPanel
      closeForm();
      setTimeout(() => handleCloseFull(), 500);
    }
  };

  // 维度管理 — 乐观更新 + API 持久化
  const addDim = () => {
    if (!newDim.trim()) return;
    const tempId = nDid();
    const dim = { id: tempId, name: newDim.trim(), max: 10, active: true };
    setDims(prev => [...prev, dim]);
    setNewDim("");
    if (USE_API) {
      workApi.createDimension({ name: dim.name, max: dim.max }, token)
        .then(serverDim => {
          setDims(prev => prev.map(d => d.id === tempId ? { ...d, id: serverDim.id } : d));
        })
        .catch(err => {
          console.error('[dims/add] failed:', err?.message);
          setDims(prev => prev.filter(d => d.id !== tempId));
        });
    }
  };
  const delDim = id => {
    snapDims();
    setDims(prev => prev.filter(d => d.id !== id));
    if (USE_API) workApi.deleteDimension(id, token).catch(rollbackDims);
  };
  const toggleDim = id => {
    snapDims();
    const current = dims.find(d => d.id === id);
    setDims(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
    if (USE_API) workApi.editDimension(id, { active: !(current?.active) }, token).catch(rollbackDims);
  };
  const editDim = (id, field, val) => {
    snapDims();
    setDims(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));
    if (USE_API) workApi.editDimension(id, { [field]: val }, token).catch(rollbackDims);
  };

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
          role={role} user={user} onAddVariant={openAddVar} onMarkComplete={openMarkComplete}
          onOpenScorePanel={openScorePanel} onOpenDocReader={openDocReader}
          onActivate={wo => ops.activatePlan(wo.id)}
          onReopen={wo => ops.reopenPlan(wo.id)}
          onOpenVariantManager={openVarMgr}
          onEditScore={(data) => openScorePanel(data)}
          onDeleteScore={(planId, variantId, scoreId) => ops.deleteScore(planId, variantId, scoreId)} />
        {formUI()}
        {docReaderData && <DocReader show={showDocReader} onClose={closeDocReader} title={docReaderData.title} content={docReaderData.content} />}
        {fullWo && <ScorePanel show={showScorePanel} onClose={closeScorePanel} wo={fullWo} dims={dims}
        onSubmitScores={handleScoreSubmit} editData={scoreEditData} role={role} user={user}
        onEditScore={(planId, variantId, scoreId, data) => ops.editScore(planId, variantId, scoreId, data)}
        onDeleteScore={(planId, variantId, scoreId) => ops.deleteScore(planId, variantId, scoreId)} />}
      {fullWo && <VariantManager show={showVarMgr} onClose={closeVarMgr} wo={fullWo} role={role} user={user} token={token} dims={dims}
        onEditVariant={(planId, variantId, data) => ops.editVariant(planId, variantId, data)}
        onDeleteVariant={(planId, variantId) => ops.deleteVariant(planId, variantId)} />}
      </>
    );
  }

  function formUI() {
    if (!fMode) return null;

    const titles = { create: "新建工单", addVar: "添加方案", complete: "定稿" };

    return (
      <div onClick={closeForm} style={{
        position: "fixed", inset: 0, zIndex: 800,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: showForm ? 1 : 0, transition: "opacity 0.3s",
        pointerEvents: showForm ? "auto" : "none",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: fMode === "create" ? 440 : fMode === "complete" ? 400 : 460,
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          background: COLOR.gradModal,
          border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
          boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
          overflow: "hidden",
          transform: showForm ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
          transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
        }}>
          {/* 标题栏 */}
          <div style={{ padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}` }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>
              {titles[fMode]}
            </div>
          </div>

          {/* 表单内容 */}
          <div style={{ padding: `${GAP.xl}px ${GAP.xxl}px`, flex: 1, overflowY: "auto" }}>
            {fMode === "create" && <>
              <FInput label="工单名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 PPT生成优化" />
              <div style={{ display: "flex", gap: GAP.base }}>
                <div style={{ flex: 1 }}><FSelect label="类型" value={fData.type} onChange={v => setFData(p => ({ ...p, type: v }))} options={[{ v: "skill", l: "Skill" }, { v: "mcp", l: "MCP" }]} /></div>
                <div style={{ flex: 1 }}><FSelect label="优先级" value={fData.priority} onChange={v => setFData(p => ({ ...p, priority: v }))} options={[{ v: "high", l: "高", c: "#b83a2a" }, { v: "medium", l: "中", c: "#b8861a" }, { v: "low", l: "低", c: "#5a8a5a" }]} /></div>
              </div>
              <FSelect label="状态" value={fData.status} onChange={v => setFData(p => ({ ...p, status: v }))} options={[{ v: "next", l: "规划中", c: "#3a6a3a" }, { v: "active", l: "立即开始", c: "#b85c1a" }]} />
              <FInput label="描述" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} placeholder="目标和要求说明" multiline />
              <div style={{ display: "flex", gap: GAP.base }}>
                <div style={{ flex: 1 }}><FInput label="负责人" value={fData.owner} onChange={e => setFData(p => ({ ...p, owner: e.target.value }))} placeholder="发起人姓名" /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: GAP.lg }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xl, color: COLOR.text3, marginBottom: GAP.xs }}>截止日期</div>
                    <input type="date" value={fData.deadline} onChange={e => setFData(p => ({ ...p, deadline: e.target.value }))}
                      style={{ width: "100%", padding: `${GAP.md}px ${GAP.base}px`, background: "rgba(255,255,255,0.4)", border: `1px solid ${COLOR.border}`, borderRadius: GAP.md, fontFamily: FONT_SANS, fontSize: FONT_SIZE.h2, color: COLOR.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
            </>}
            {fMode === "addVar" && <>
              <FInput label="方案名称" value={fData.name} onChange={e => setFData(p => ({ ...p, name: e.target.value }))} placeholder="如 NotebookLM 方案" />
              <div style={{ marginBottom: GAP.lg }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xl, color: COLOR.text3, marginBottom: GAP.xs }}>提交人</div>
                <div style={{ padding: `${GAP.md}px ${GAP.base}px`, background: "rgba(0,0,0,0.03)", borderRadius: GAP.md, fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text }}>{user}</div>
              </div>
              <FInput label="方案说明" value={fData.desc} onChange={e => setFData(p => ({ ...p, desc: e.target.value }))} placeholder="简述技术路线、优缺点等" multiline />
              <FInput label="外部链接" value={fData.link} onChange={e => setFData(p => ({ ...p, link: e.target.value }))} placeholder="参考文档 URL（选填）" />
              {/* 方案文档 — Markdown 内容编辑 */}
              <div style={{ marginBottom: GAP.lg }}>
                <div
                  onClick={() => setFData(p => ({ ...p, showDocEditor: !p.showDocEditor }))}
                  style={{
                    fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.blue, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: GAP.xs, marginBottom: fData.showDocEditor ? GAP.sm : 0,
                    userSelect: "none",
                  }}>
                  <span style={{ fontSize: FONT_SIZE.xs, transform: fData.showDocEditor ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
                  方案文档（Markdown）
                  {fData.content && <span style={{ fontSize: FONT_SIZE.sm, color: COLOR.success, marginLeft: GAP.xs }}>已填写</span>}
                </div>
                {fData.showDocEditor && (
                  <MarkdownInput
                    value={fData.content}
                    onChange={val => setFData(p => ({ ...p, content: val }))}
                    placeholder={"# 方案标题\n\n## 技术方案\n- 要点一\n- 要点二\n\n## 预期效果\n..."}
                    minHeight={160}
                  />
                )}
              </div>
              {/* 附件上传 */}
              <div style={{ marginBottom: GAP.lg }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>附件</div>
                {(fData.attachments || []).map((att, idx) => (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: GAP.md,
                    padding: `${GAP.sm}px ${GAP.base}px`,
                    background: "rgba(0,0,0,0.02)", borderRadius: GAP.sm,
                    marginBottom: GAP.xs,
                  }}>
                    <File size={13} color={COLOR.blue} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {att.originalName || att.path}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.sub, flexShrink: 0 }}>
                      {att.size ? (att.size / 1024).toFixed(1) + "KB" : ""}
                    </span>
                    <div onClick={() => setFData(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== idx) }))}
                      style={{ cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}>
                      <X size={12} color={COLOR.error} />
                    </div>
                  </div>
                ))}
                <div onClick={() => addVarFileRef.current?.click()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: GAP.xs,
                    fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.blue,
                    cursor: "pointer", userSelect: "none", padding: `${GAP.xs}px 0`,
                  }}>
                  <Upload size={12} /><span>上传文件</span>
                </div>
                <input ref={addVarFileRef} type="file" multiple style={{ display: "none" }} onChange={handleAddVarFiles} />
              </div>
            </>}
            {fMode === "complete" && <>
              {/* 结论选择 */}
              <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>定稿结论</div>
              <div style={{ display: "flex", gap: GAP.base, marginBottom: GAP.xl }}>
                {[
                  { v: "adopted", l: "采纳方案", desc: "选定方案，内置上线" },
                  { v: "shelved", l: "搁置", desc: "暂不推进，保留记录" },
                ].map(o => (
                  <div key={o.v} onClick={() => setFData(p => ({ ...p, result: o.v }))}
                    style={{
                      flex: 1, padding: `${GAP.lg}px`, borderRadius: GAP.base, cursor: "pointer",
                      border: fData.result === o.v ? `2px solid ${COLOR.text}` : `1px solid ${COLOR.borderMd}`,
                      background: fData.result === o.v ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.02)",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 600, color: COLOR.text, marginBottom: GAP.xs }}>{o.l}</div>
                    <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text5 }}>{o.desc}</div>
                  </div>
                ))}
              </div>

              {/* 采纳时：方案排名 + 选择 */}
              {fData.result === "adopted" && Array.isArray(fData.variants) && fData.variants.length > 0 && (
                <div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>选定采纳方案</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: GAP.sm, marginBottom: GAP.md }}>
                    {fData.variants.map((v, i) => (
                      <div key={v.id || i} onClick={() => setFData(p => ({ ...p, selectedVariantId: v.id }))}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: `${GAP.base}px ${GAP.lg}px`, borderRadius: GAP.md, cursor: "pointer",
                          border: fData.selectedVariantId === v.id ? `2px solid ${COLOR.text}` : `1px solid ${COLOR.border}`,
                          background: fData.selectedVariantId === v.id ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.01)",
                          transition: "all 0.15s",
                        }}>
                        <div>
                          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500 }}>
                            {i === 0 && v.avg > 0 && "🥇 "}
                            {i === 1 && v.avg > 0 && "🥈 "}
                            {i === 2 && v.avg > 0 && "🥉 "}
                            {v.name || "未命名"}
                          </div>
                          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginTop: 2 }}>
                            {v.uploader || ""} {v.uploaded ? `· ${v.uploaded}` : ""}
                          </div>
                        </div>
                        <div style={{
                          fontFamily: FONT_MONO, fontSize: FONT_SIZE.xl, fontWeight: 600,
                          color: v.avg > 0 ? (i === 0 ? COLOR.brown : COLOR.text) : COLOR.dim,
                        }}>
                          {typeof v.avg === "number" && v.avg > 0 ? v.avg.toFixed(1) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>}
          </div>

          {/* 底部按钮 */}
          <div style={{ padding: `0 ${GAP.xxl}px ${GAP.xl}px`, display: "flex", gap: GAP.base }}>
            <button onClick={closeForm} style={{
              flex: 1, padding: `${GAP.base}px`, borderRadius: GAP.md, cursor: "pointer",
              fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
              background: COLOR.borderLt, color: COLOR.text3,
              border: `1px solid ${COLOR.borderMd}`, transition: "all 0.15s",
            }}>取消</button>
            <button onClick={save} style={{
              flex: 1, padding: `${GAP.base}px`, borderRadius: GAP.md, cursor: "pointer",
              fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
              background: COLOR.btn, color: COLOR.btnText,
              border: `1px solid ${COLOR.btn}`, transition: "all 0.15s",
            }}>{fMode === "create" ? "创建" : fMode === "addVar" ? "添加" : "确认定稿"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      {/* 顶部栏 */}
      <div style={{ display: "flex", alignItems: "center", gap: GAP.lg, marginBottom: 14, flexWrap: "wrap" }}>
        <ToggleSwitch options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
        <div style={{ flex: 1 }} />
        {role === "admin" && (
          <div onClick={openCreate} style={{
            padding: `7px ${GAP.xl}px`, borderRadius: GAP.md, cursor: "pointer",
            fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, fontWeight: 500,
            background: COLOR.btn, color: COLOR.btnText,
            border: `1px solid ${COLOR.btn}`,
            display: "flex", alignItems: "center", gap: GAP.xs,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = COLOR.btnHover}
            onMouseLeave={e => e.currentTarget.style.background = COLOR.btn}
          >
            <span style={{ fontSize: FONT_SIZE.lg }}>+</span>新建工单
          </div>
        )}
      </div>

      {/* 指标栏 */}
      <div style={{ display: "flex", gap: GAP.md, marginBottom: GAP.xl, flexWrap: "wrap", alignItems: "stretch" }}>
        <Stat label="工单总数" value={filtered.length} color="#6a5a42" />
        <Stat label="进行中" value={active.length} color="#b85c1a" />
        <Stat label="下期规划" value={next.length} color="#3a6a3a" />
        <Stat label="总方案" value={filtered.reduce((a, p) => a + p.variants.length, 0)} color="#8a8580" />
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
        <div style={{ textAlign: "center", padding: `${GAP.page}px ${GAP.xxl}px`, fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, color: COLOR.sub }}>
          暂无 {typeFilter === "skill" ? "Skill" : "MCP"} 工单
        </div>
      )}

      {/* FullPanel 第三层 */}
      <WoFullPanel wo={fullWo} dims={dims} show={showFull} originRect={fullOriginRect} onClose={handleCloseFull}
        role={role} user={user} onAddVariant={openAddVar} onMarkComplete={openMarkComplete}
        onOpenScorePanel={openScorePanel} onOpenDocReader={openDocReader}
        onActivate={wo => ops.activatePlan(wo.id)}
        onReopen={wo => ops.reopenPlan(wo.id)}
        onOpenVariantManager={openVarMgr}
        onEditScore={(data) => openScorePanel(data)}
        onDeleteScore={(planId, variantId, scoreId) => ops.deleteScore(planId, variantId, scoreId)} />

      {/* 表单 */}
      {formUI()}

      {/* DocReader + ScorePanel */}
      {docReaderData && <DocReader show={showDocReader} onClose={closeDocReader} title={docReaderData.title} content={docReaderData.content} />}
      {fullWo && <ScorePanel show={showScorePanel} onClose={closeScorePanel} wo={fullWo} dims={dims}
        onSubmitScores={handleScoreSubmit} editData={scoreEditData} role={role} user={user}
        onEditScore={(planId, variantId, scoreId, data) => ops.editScore(planId, variantId, scoreId, data)}
        onDeleteScore={(planId, variantId, scoreId) => ops.deleteScore(planId, variantId, scoreId)} />}
      {fullWo && <VariantManager show={showVarMgr} onClose={closeVarMgr} wo={fullWo} role={role} user={user} token={token} dims={dims}
        onEditVariant={(planId, variantId, data) => ops.editVariant(planId, variantId, data)}
        onDeleteVariant={(planId, variantId) => ops.deleteVariant(planId, variantId)} />}

      {/* 维度管理 — z-800 弹窗，带展开/收起动画 */}
      {showDimMgr && (
        <div onClick={() => setShowDimMgr(false)} style={{
          position: "fixed", inset: 0, zIndex: 800,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: showDimMgr ? 1 : 0, transition: "opacity 0.3s",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 360,
            background: COLOR.gradModal,
            border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
            boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
            overflow: "hidden",
            transform: "scale(1) translateY(0)",
            transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
          }}>
            <div style={{ padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}` }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>评分维度设置</div>
            </div>
            <div style={{ padding: `${GAP.lg}px ${GAP.xxl}px`, maxHeight: "60vh", overflow: "auto" }}>
              {dims.map(d => (
                <div key={d.id} style={{ padding: `${GAP.base}px 0`, borderBottom: "1px solid rgba(0,0,0,0.05)", opacity: d.active ? 1 : 0.45, transition: "opacity 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: GAP.sm }}>
                    <input value={d.name} onChange={e => editDim(d.id, "name", e.target.value)} style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text, background: "transparent", border: "none", borderBottom: `1px dashed ${COLOR.borderMd}`, outline: "none", padding: "0 0 2px", width: 100 }} />
                    <div style={{ display: "flex", gap: GAP.sm, alignItems: "center" }}>
                      <button onClick={() => toggleDim(d.id)} style={{ padding: `3px ${GAP.base}px`, borderRadius: 6, cursor: "pointer", fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, border: d.active ? "1px solid rgba(74,138,74,0.3)" : `1px solid ${COLOR.border}`, background: d.active ? "rgba(74,138,74,0.1)" : COLOR.borderLt, color: d.active ? "#4a8a4a" : "#a89a78", transition: "all 0.15s" }}>{d.active ? "启用" : "禁用"}</button>
                      <button onClick={() => delDim(d.id)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.error }}>删除</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: GAP.sm }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: "#9a8a68" }}>满分</span>
                    {[3, 5, 10].map(n => (
                      <button key={n} onClick={() => editDim(d.id, "max", n)} style={{ padding: `2px ${GAP.md}px`, borderRadius: 5, cursor: "pointer", fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, border: d.max === n ? "1px solid rgba(0,0,0,0.15)" : `1px solid ${COLOR.border}`, background: d.max === n ? COLOR.borderMd : "transparent", color: COLOR.text2, transition: "all 0.15s" }}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: GAP.md, marginTop: 14 }}>
                <input value={newDim} onChange={e => setNewDim(e.target.value)} placeholder="新维度名称" style={{ flex: 1, padding: `${GAP.md}px ${GAP.lg}px`, background: "rgba(0,0,0,0.02)", border: `1px solid ${COLOR.border}`, borderRadius: GAP.md, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, outline: "none" }} />
                <button onClick={addDim} style={{ padding: `${GAP.md}px ${GAP.xl}px`, borderRadius: GAP.md, cursor: "pointer", fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, fontWeight: 500, background: COLOR.btn, color: COLOR.btnText, border: `1px solid ${COLOR.btn}`, transition: "all 0.15s" }}>添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
