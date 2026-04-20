import { useState, useRef } from "react";
import { X, Upload, File, ChevronDown } from "lucide-react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { FInput, FBtn } from "../../components/ui/Form.jsx";
import MarkdownInput from "../../components/ui/MarkdownInput.jsx";
import Accordion from "../../components/ui/Accordion.jsx";
import SheetModal, { SheetCloseBtn } from "../../components/ui/SheetModal.jsx";
import { uploadFiles } from "../../services/workService.js";

/**
 * 方案管理面板 — 编辑/删除已有方案
 * 手风琴展开 → 编辑名称/描述/链接/文档/附件 → 保存/删除
 */
export default function VariantManager({ show, onClose, wo, role, user, token, onEditVariant, onDeleteVariant, dims }) {
  const [expandedVar, setExpandedVar] = useState(null);
  const [editState, setEditState] = useState({});
  const fileInputRef = useRef(null);
  const activeFileVar = useRef(null);

  if (!wo) return null;

  const isDone = wo.status === "done";

  // Filter variants: admin sees all, others see only their own
  const filteredVariants = role === "admin"
    ? wo.variants
    : wo.variants.filter(v => v.uploader === user);

  // Populate edit state when accordion opens
  const handleToggle = (varId) => {
    if (expandedVar === varId) {
      setExpandedVar(null);
      return;
    }
    setExpandedVar(varId);
    if (!editState[varId]) {
      const v = wo.variants.find(x => x.id === varId);
      if (v) {
        setEditState(prev => ({
          ...prev,
          [varId]: {
            name: v.name || "",
            desc: v.desc || "",
            link: v.link || "",
            content: v.content || "",
            attachments: v.attachments ? [...v.attachments] : [],
            showDoc: false,
          },
        }));
      }
    }
  };

  const updateField = (varId, field, value) => {
    setEditState(prev => ({
      ...prev,
      [varId]: { ...prev[varId], [field]: value },
    }));
  };

  const handleSave = (varId) => {
    const state = editState[varId];
    if (!state) return;
    onEditVariant(wo.id, varId, {
      name: state.name,
      desc: state.desc,
      link: state.link,
      content: state.content,
      attachments: state.attachments,
    });
    setExpandedVar(null);
  };

  const handleDelete = (varId) => {
    const v = wo.variants.find(x => x.id === varId);
    const name = v ? v.name : varId;
    if (!window.confirm(`确定删除方案「${name}」吗？此操作不可撤销。`)) return;
    onDeleteVariant(wo.id, varId);
    setExpandedVar(null);
    setEditState(prev => {
      const next = { ...prev };
      delete next[varId];
      return next;
    });
  };

  const triggerFileUpload = (varId) => {
    activeFileVar.current = varId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const varId = activeFileVar.current;
    if (!varId) return;
    try {
      const uploaded = await uploadFiles(files, token);
      setEditState(prev => ({
        ...prev,
        [varId]: {
          ...prev[varId],
          attachments: [...(prev[varId]?.attachments || []), ...uploaded],
        },
      }));
    } catch (err) {
      console.error("Upload failed:", err);
    }
    e.target.value = "";
  };

  const removeAttachment = (varId, idx) => {
    setEditState(prev => ({
      ...prev,
      [varId]: {
        ...prev[varId],
        attachments: prev[varId].attachments.filter((_, i) => i !== idx),
      },
    }));
  };

  const canDelete = (v) => {
    if (isDone) return false;
    if (role === "admin") return true;
    return !v.scores || v.scores.length === 0;
  };

  const accordionItems = filteredVariants.map(v => {
    const state = editState[v.id] || {};
    return {
      key: v.id,
      header: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 500 }}>
              {v.name}
            </span>
            <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginLeft: GAP.md }}>
              {v.uploader}
            </span>
          </div>
          {v.scores && v.scores.length > 0 && (
            <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.blue }}>
              {v.scores.length} 条评分
            </span>
          )}
        </div>
      ),
      content: (
        <div>
          {/* Name */}
          <FInput
            label="方案名称"
            value={state.name || ""}
            onChange={e => updateField(v.id, "name", e.target.value)}
            placeholder="方案名称"
          />

          {/* Description */}
          <FInput
            label="方案描述"
            value={state.desc || ""}
            onChange={e => updateField(v.id, "desc", e.target.value)}
            placeholder="简要描述"
            multiline
          />

          {/* Link */}
          <FInput
            label="相关链接"
            value={state.link || ""}
            onChange={e => updateField(v.id, "link", e.target.value)}
            placeholder="https://..."
          />

          {/* Markdown doc toggle */}
          <div style={{ marginBottom: GAP.lg }}>
            <div
              onClick={() => updateField(v.id, "showDoc", !state.showDoc)}
              style={{
                display: "flex", alignItems: "center", gap: GAP.sm,
                cursor: "pointer", userSelect: "none", marginBottom: state.showDoc ? GAP.md : 0,
              }}
            >
              <ChevronDown
                size={13}
                style={{
                  color: COLOR.sub, flexShrink: 0,
                  transform: state.showDoc ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
                }}
              />
              <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3 }}>
                方案文档
              </span>
              <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.dim }}>
                (Markdown)
              </span>
            </div>
            {state.showDoc && (
              <MarkdownInput
                value={state.content || ""}
                onChange={val => updateField(v.id, "content", val)}
                placeholder={"# 方案详情\n\n## 实现思路\n..."}
                minHeight={120}
              />
            )}
          </div>

          {/* Attachments */}
          <div style={{ marginBottom: GAP.lg }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text3, marginBottom: GAP.md }}>
              附件
            </div>

            {(state.attachments || []).map((att, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", gap: GAP.md,
                padding: `${GAP.sm}px ${GAP.base}px`,
                background: "rgba(0,0,0,0.02)", borderRadius: GAP.sm,
                marginBottom: GAP.xs,
              }}>
                <File size={13} color={COLOR.blue} style={{ flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {att.originalName || att.path}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.sub, flexShrink: 0 }}>
                  {att.size ? (att.size / 1024).toFixed(1) + "KB" : ""}
                </span>
                {!isDone && (
                  <div
                    onClick={() => removeAttachment(v.id, idx)}
                    style={{ cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}
                  >
                    <X size={12} color={COLOR.error} />
                  </div>
                )}
              </div>
            ))}

            {!isDone && (
              <div
                onClick={() => triggerFileUpload(v.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: GAP.xs,
                  fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.blue,
                  cursor: "pointer", userSelect: "none",
                  padding: `${GAP.xs}px 0`, marginTop: GAP.xs,
                }}
              >
                <Upload size={12} />
                <span>上传文件</span>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          {!isDone && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: GAP.base,
              borderTop: `1px solid ${COLOR.borderLt}`,
            }}>
              <FBtn label="保存修改" onClick={() => handleSave(v.id)} />
              {canDelete(v) && (
                <div
                  onClick={() => handleDelete(v.id)}
                  style={{
                    fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.error,
                    cursor: "pointer", userSelect: "none",
                    padding: `${GAP.xs}px ${GAP.md}px`,
                    borderRadius: GAP.xs,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(184,58,42,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  删除方案
                </div>
              )}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <SheetModal show={show} onClose={onClose} width={480}>
      {/* Title bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${GAP.xl}px ${GAP.xxl}px ${GAP.lg}px`, borderBottom: `1px solid ${COLOR.border}`,
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.xxl, fontWeight: 600, color: COLOR.text }}>方案管理</div>
        <SheetCloseBtn onClick={onClose} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: `${GAP.base}px 0` }}>
        {filteredVariants.length === 0 ? (
          <div style={{
            padding: `${GAP.xxl}px`, textAlign: "center",
            fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.sub,
          }}>
            {role === "admin" ? "暂无方案" : "暂无你提交的方案"}
          </div>
        ) : (
          <Accordion
            items={accordionItems}
            expandedKey={expandedVar}
            onToggle={handleToggle}
          />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </SheetModal>
  );
}
