import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, Pencil } from "lucide-react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import StarRate from "../../components/ui/StarRate.jsx";
import { FInput } from "../../components/ui/Form.jsx";
import MarkdownInput from "../../components/ui/MarkdownInput.jsx";
import SheetModal, { SheetCloseBtn } from "../../components/ui/SheetModal.jsx";
import { td } from "../../utils/helpers.js";

/**
 * 评测打分面板 — 测试员专用
 * 选方案 → 编写评测文档（Markdown，可多份）→ 打分 → 提交
 * 支持编辑模式 (editData) + 历史评分管理
 */
export default function ScorePanel({ show, onClose, wo, dims, onSubmitScores, editData, onEditScore, onDeleteScore, role, user }) {
  const [tab, setTab] = useState("new"); // "new" | "history"
  const [selVarId, setSelVarId] = useState(null);
  const [scores, setScores] = useState({});
  const [tester, setTester] = useState("");
  const [comment, setComment] = useState("");
  const [evalDocs, setEvalDocs] = useState([]);
  const [editingScoreIds, setEditingScoreIds] = useState(null); // editing mode: array of score IDs

  const activeDims = (dims || []).filter(d => d.active);

  // 打开瞬间按 editData 预填表单
  useEffect(() => {
    if (!show) {
      // 关闭后清 editing 态（延迟到动画结束后由 SheetModal 卸载内容）
      setEditingScoreIds(null);
      return;
    }
    if (editData) {
      setTab("new");
      setSelVarId(editData.variantId);
      setTester(editData.tester || user || "");
      setEditingScoreIds(editData.scores || null);
      const preScores = {};
      (editData.dims || []).forEach(d => { preScores[d.dimId] = d.value; });
      setScores(preScores);
    } else {
      setTab("new");
      setTester(user || "");
      setEditingScoreIds(null);
    }
  }, [show]);

  if (!wo) return null;

  const allFilled = selVarId && tester.trim() && activeDims.every(d => scores[d.id] > 0);

  const addDoc = () => setEvalDocs(prev => [...prev, { title: "", content: "" }]);
  const removeDoc = (idx) => setEvalDocs(prev => prev.filter((_, i) => i !== idx));
  const updateDoc = (idx, field, val) => setEvalDocs(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const handleSubmit = () => {
    if (!allFilled) return;

    const validDocs = evalDocs.filter(d => d.content.trim());
    const evalDocJson = validDocs.length > 0
      ? JSON.stringify(validDocs.map(d => ({ title: d.title.trim() || "评测文档", content: d.content.trim() })))
      : null;

    const scoreEntries = activeDims.map(d => ({
      tester: tester.trim(),
      dimId: d.id,
      value: scores[d.id] || 0,
      comment: comment.trim(),
      date: td(),
      ...(evalDocJson ? { evalDoc: evalDocJson } : {}),
    }));
    onSubmitScores(wo.id, selVarId, scoreEntries);
    setScores({});
    setTester("");
    setComment("");
    setEvalDocs([]);
    setSelVarId(null);
  };

  const handleEditSubmit = () => {
    if (!allFilled || !editingScoreIds) return;
    // Update each score by ID
    editingScoreIds.forEach(sid => {
      const dimScore = activeDims.find(d => {
        const existing = wo.variants.find(v => v.id === selVarId)?.scores?.find(s => s.id === sid);
        return existing && d.id === existing.dimId;
      });
      if (!dimScore) return;
      const existing = wo.variants.find(v => v.id === selVarId)?.scores?.find(s => s.id === sid);
      if (!existing) return;
      onEditScore && onEditScore(wo.id, selVarId, sid, {
        value: scores[existing.dimId] ?? existing.value,
        comment: comment.trim(),
      });
    });
    setEditingScoreIds(null);
    setScores({});
    setComment("");
    setSelVarId(null);
    onClose();
  };

  return (
    <SheetModal show={show} onClose={onClose} width={480}>
        {/* 标题栏 + tab 切换 */}
        <div style={{
          padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: GAP.base }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>
              {editingScoreIds ? "编辑评分" : "评测打分"}
            </div>
            <SheetCloseBtn onClick={onClose} />
          </div>
          {!editingScoreIds && (
            <div style={{ display: "flex", gap: GAP.lg }}>
              {["new", "history"].map(t => (
                <div key={t} onClick={() => setTab(t)} style={{
                  fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, cursor: "pointer",
                  color: tab === t ? COLOR.text : COLOR.sub,
                  borderBottom: tab === t ? `2px solid ${COLOR.text}` : "2px solid transparent",
                  paddingBottom: GAP.xs, transition: "all 0.15s",
                }}>
                  {t === "new" ? "新建评分" : "历史评分"}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px ${GAP.xxl}px` }}>

          {/* === 历史评分 tab === */}
          {tab === "history" && !editingScoreIds && (
            <HistoryScores wo={wo} dims={activeDims} role={role} user={user}
              onEdit={(data) => {
                setSelVarId(data.variantId);
                setTester(data.tester);
                setEditingScoreIds(data.scoreIds);
                const preScores = {};
                data.dims.forEach(d => { preScores[d.dimId] = d.value; });
                setScores(preScores);
                setTab("new");
              }}
              onDelete={(planId, variantId, scoreIds) => {
                if (window.confirm("确认删除此评分？")) {
                  scoreIds.forEach(sid => onDeleteScore && onDeleteScore(planId, variantId, sid));
                }
              }}
            />
          )}

          {/* === 新建/编辑评分 tab === */}
          {tab === "new" && <>
          {/* 方案选择 */}
          <div style={{ marginBottom: GAP.xl }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>选择方案</div>
            <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap" }}>
              {wo.variants.map(v => (
                <div key={v.id} onClick={() => setSelVarId(v.id)} style={{
                  padding: `${GAP.md}px ${GAP.lg}px`, borderRadius: GAP.md, cursor: "pointer",
                  border: selVarId === v.id ? `2px solid ${COLOR.text}` : `1px solid ${COLOR.borderMd}`,
                  background: selVarId === v.id ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.02)",
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500 }}>{v.name}</div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginTop: 2 }}>{v.uploader}</div>
                </div>
              ))}
            </div>
            {wo.variants.length === 0 && (
              <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: "#b5a898" }}>暂无方案可评测</div>
            )}
          </div>

          {/* 逐项评分 */}
          <div style={{ marginBottom: GAP.xl }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.base }}>逐项评分</div>
            {activeDims.map(d => (
              <div key={d.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: GAP.base,
              }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text2 }}>{d.name}</span>
                <StarRate value={scores[d.id] || 0} max={d.max} onChange={val => setScores(prev => ({ ...prev, [d.id]: val }))} />
              </div>
            ))}
          </div>

          {/* 测试人 + 评语 */}
          <div style={{ marginBottom: GAP.md }}>
            <div style={{ marginBottom: GAP.lg }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xl, color: COLOR.text3, marginBottom: GAP.xs }}>测试人</div>
              <div style={{ padding: `${GAP.md}px ${GAP.base}px`, background: "rgba(0,0,0,0.03)", borderRadius: GAP.md, fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text }}>{user || tester}</div>
            </div>
          </div>
          <div style={{ marginBottom: GAP.xl }}>
            <FInput label="评语" value={comment} onChange={e => setComment(e.target.value)} placeholder="选填" multiline />
          </div>

          {/* 评测文档（Markdown，可多份） */}
          <div style={{ marginBottom: GAP.lg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: GAP.md }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3 }}>
                评测文档 <span style={{ color: "#b5a898", fontWeight: 400 }}>（Markdown，选填，支持拖拽 .md 文件）</span>
              </div>
              <div onClick={addDoc} style={{
                display: "flex", alignItems: "center", gap: 3,
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.blue,
                cursor: "pointer", userSelect: "none",
              }}>
                <Plus size={12} />添加文档
              </div>
            </div>

            {evalDocs.map((doc, i) => (
              <div key={i} style={{
                border: `1px solid ${COLOR.borderMd}`, borderRadius: GAP.base,
                padding: GAP.lg, marginBottom: GAP.md,
                background: "rgba(0,0,0,0.015)",
              }}>
                <div style={{ display: "flex", gap: GAP.md, alignItems: "center", marginBottom: GAP.md }}>
                  <FileText size={13} color={COLOR.blue} />
                  <input
                    value={doc.title}
                    onChange={e => updateDoc(i, "title", e.target.value)}
                    placeholder={`评测文档 ${i + 1}`}
                    style={{
                      flex: 1, padding: "4px 8px", border: "none",
                      borderBottom: "1px dashed rgba(0,0,0,0.1)",
                      background: "transparent", fontFamily: FONT_SANS,
                      fontSize: FONT_SIZE.base, color: COLOR.text, outline: "none",
                    }}
                  />
                  <div onClick={() => removeDoc(i)} style={{ cursor: "pointer", display: "flex", padding: 2 }}>
                    <Trash2 size={13} color={COLOR.error} />
                  </div>
                </div>
                <MarkdownInput
                  value={doc.content}
                  onChange={val => updateDoc(i, "content", val)}
                  placeholder={"# 评测结论\n\n## 测试场景\n- 场景一：...\n\n## 发现问题\n..."}
                  minHeight={120}
                />
              </div>
            ))}

            {evalDocs.length === 0 && !editingScoreIds && (
              <div
                onClick={addDoc}
                style={{
                  border: "1px dashed rgba(0,0,0,0.1)", borderRadius: GAP.md,
                  padding: `${GAP.base}px`, textAlign: "center", cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
              >
                <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.sub }}>
                  点击添加 Markdown 评测文档
                </div>
              </div>
            )}
          </div>
          </>}
        </div>

        {/* 提交/保存按钮 */}
        {tab === "new" && (
        <div style={{ padding: `0 ${GAP.xxl}px ${GAP.xl}px`, flexShrink: 0 }}>
          <button onClick={editingScoreIds ? handleEditSubmit : handleSubmit} style={{
            width: "100%", padding: `${GAP.base}px`, borderRadius: GAP.md,
            cursor: allFilled ? "pointer" : "not-allowed",
            fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
            background: allFilled ? COLOR.btn : COLOR.borderLt,
            color: allFilled ? COLOR.btnText : "#b5b0a5",
            border: allFilled ? `1px solid ${COLOR.btn}` : `1px solid ${COLOR.borderMd}`,
            opacity: allFilled ? 1 : 0.6,
            transition: "all 0.15s",
          }}>{editingScoreIds ? "保存修改" : "提交评测"}</button>
        </div>
        )}
    </SheetModal>
  );
}

/** 历史评分列表子组件 */
function HistoryScores({ wo, dims, role, user, onEdit, onDelete }) {
  if (!wo) return null;

  // Collect all score groups across variants
  const allGroups = [];
  wo.variants.forEach(v => {
    if (!v.scores || v.scores.length === 0) return;
    const groups = {};
    v.scores.forEach(s => {
      const key = `${s.tester}-${s.date}`;
      if (!groups[key]) groups[key] = { tester: s.tester, date: s.date, variantName: v.name, variantId: v.id, scoreIds: [], dims: [] };
      groups[key].scoreIds.push(s.id);
      const dim = dims.find(d => d.id === s.dimId);
      if (dim) groups[key].dims.push({ dimId: s.dimId, dimName: dim.name, value: s.value, max: dim.max });
    });
    Object.values(groups).forEach(g => allGroups.push(g));
  });

  // Filter: tester sees own, admin sees all
  const visible = role === "admin" ? allGroups : allGroups.filter(g => g.tester === user);
  const isDone = wo.status === "done";

  if (visible.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: GAP.xxl, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub }}>
        {role === "admin" ? "暂无评分记录" : "暂无你的评分记录"}
      </div>
    );
  }

  return (
    <div>
      {visible.map((g, idx) => (
        <div key={idx} style={{
          padding: `${GAP.base}px ${GAP.lg}px`, marginBottom: GAP.sm,
          borderRadius: GAP.md, border: `1px solid ${COLOR.borderLt}`,
          background: "rgba(0,0,0,0.015)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: GAP.sm }}>
            <div>
              <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500 }}>{g.variantName}</span>
              <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginLeft: GAP.md }}>{g.tester} · {g.date}</span>
            </div>
            {!isDone && (
              <div style={{ display: "flex", gap: GAP.md }}>
                <Pencil size={14}
                  style={{ color: COLOR.dim, cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = COLOR.text3}
                  onMouseLeave={e => e.currentTarget.style.color = COLOR.dim}
                  onClick={() => onEdit({ variantId: g.variantId, tester: g.tester, scoreIds: g.scoreIds, dims: g.dims })}
                />
                <Trash2 size={14}
                  style={{ color: COLOR.dim, cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = COLOR.error}
                  onMouseLeave={e => e.currentTarget.style.color = COLOR.dim}
                  onClick={() => onDelete(wo.id, g.variantId, g.scoreIds)}
                />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: GAP.lg, flexWrap: "wrap" }}>
            {g.dims.map(d => (
              <span key={d.dimId} style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text3 }}>
                {d.dimName} <strong>{d.value}</strong>/{d.max || 10}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
