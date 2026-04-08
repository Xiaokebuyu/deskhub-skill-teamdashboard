import { useState, useEffect } from "react";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import StarRate from "../../components/ui/StarRate.jsx";
import { FInput } from "../../components/ui/Form.jsx";
import MarkdownInput from "../../components/ui/MarkdownInput.jsx";
import { td } from "../../utils/helpers.js";

/**
 * 评测打分面板 — 测试员专用
 * 选方案 → 编写评测文档（Markdown，可多份）→ 打分 → 提交
 */
export default function ScorePanel({ show, onClose, wo, dims, onSubmitScores }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selVarId, setSelVarId] = useState(null);
  const [scores, setScores] = useState({});
  const [tester, setTester] = useState("");
  const [comment, setComment] = useState("");
  const [evalDocs, setEvalDocs] = useState([]);

  const activeDims = (dims || []).filter(d => d.active);

  useEffect(() => {
    if (show) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!mounted) return null;
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

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 800,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxHeight: "85vh",
        background: COLOR.gradModal,
        border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
        boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
      }}>
        {/* 标题栏 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}`,
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>评测打分</div>
          <div onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: COLOR.borderLt, transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = COLOR.borderMd}
            onMouseLeave={e => e.currentTarget.style.background = COLOR.borderLt}
          >
            <X size={14} color={COLOR.text5} strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: `${GAP.xl}px ${GAP.xxl}px` }}>
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
            <FInput label="测试人" value={tester} onChange={e => setTester(e.target.value)} placeholder="你的名字" />
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

            {evalDocs.length === 0 && (
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
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: `0 ${GAP.xxl}px ${GAP.xl}px`, flexShrink: 0 }}>
          <button onClick={handleSubmit} style={{
            width: "100%", padding: `${GAP.base}px`, borderRadius: GAP.md,
            cursor: allFilled ? "pointer" : "not-allowed",
            fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, fontWeight: 500,
            background: allFilled ? COLOR.btn : COLOR.borderLt,
            color: allFilled ? COLOR.btnText : "#b5b0a5",
            border: allFilled ? `1px solid ${COLOR.btn}` : `1px solid ${COLOR.borderMd}`,
            opacity: allFilled ? 1 : 0.6,
            transition: "all 0.15s",
          }}>提交评测</button>
        </div>
      </div>
    </div>
  );
}
