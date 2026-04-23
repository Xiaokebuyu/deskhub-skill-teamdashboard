import { useState } from "react";
import { Plus, FileText, Play, ClipboardCheck, Star, RotateCcw, ExternalLink, Pencil, Trash2, File, Download } from "lucide-react";
import Markdown from "react-markdown";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";
import { PRI } from "../../constants/priority.js";
import { PLAN_ST } from "../../constants/status.js";
import { avgScore } from "../../utils/helpers.js";
import FullPanel from "../../components/ui/FullPanel.jsx";
import Accordion from "../../components/ui/Accordion.jsx";
import ComparisonTable from "./ComparisonTable.jsx";

/**
 * 第三层完整面板 — 纯信息展示 + 单角色按钮
 */
export default function WoFullPanel({ wo, dims, show, originRect, onClose, role, user, onAddVariant, onMarkComplete, onOpenScorePanel, onOpenDocReader, onActivate, onReopen, onOpenVariantManager, onEditScore, onDeleteScore, onEditPlan }) {
  const [expandedVar, setExpandedVar] = useState(null);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const activeDims = (dims || []).filter(d => d.active);

  if (!wo) return null;

  const st = PLAN_ST[wo.status];

  // 构建 Accordion items — 纯展示，无表单
  const accordionItems = wo.variants.map(v => {
    const avg = avgScore(v, activeDims);
    const isAI = v.authorType === 'ai';
    const aiProxy = v.proxyAuthorId || v.uploader;

    return {
      key: v.id,
      header: (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
          // AI 态：header 整条加左侧橙条 + 淡橙底（通过负 margin 延伸覆盖整个 Accordion item 行）
          ...(isAI ? {
            background: "rgba(184,92,26,0.10)",
            borderLeft: "4px solid #b85c1a",
            padding: `${GAP.sm}px ${GAP.md}px`,
            margin: `-${GAP.base}px -${GAP.lg}px -${GAP.base}px -${GAP.lg}px`,
            borderRadius: 4,
          } : undefined),
        }}>
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: isAI ? "#b85c1a" : COLOR.text, fontWeight: isAI ? 600 : 400 }}>
              {v.name}
            </span>
            {isAI && <AIBadge title={`小合代 ${aiProxy} 代笔 · 你可以随时删改`} />}
            <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.sub, marginLeft: GAP.md }}>
              {isAI ? `🦀 代 ${aiProxy}` : v.uploader} · {v.uploaded}
            </span>
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: avg > 0 ? COLOR.text : COLOR.dim }}>
            {avg > 0 ? avg.toFixed(1) : "待测"}
          </span>
        </div>
      ),
      content: (
        <div style={isAI ? {
          background: 'rgba(184,92,26,0.08)',
          borderLeft: '4px solid #b85c1a',
          borderRadius: '0 8px 8px 0',
          padding: `${GAP.lg}px ${GAP.lg}px`,
          margin: `0 0 0 -${GAP.lg}px`,
        } : undefined}>
          {/* AI 代笔横幅 */}
          {isAI && (
            <div style={{
              display: "flex", alignItems: "center", gap: GAP.sm,
              padding: `${GAP.sm}px ${GAP.md}px`,
              marginBottom: GAP.base,
              background: "rgba(184,92,26,0.15)",
              border: "1px solid rgba(184,92,26,0.35)",
              borderRadius: 6,
              fontFamily: FONT_SANS, fontSize: FONT_SIZE.md,
              color: "#7a3d10",
            }}>
              <span style={{ fontSize: 16 }}>🦀</span>
              <span>
                <strong>小合代「{aiProxy}」代笔的方案</strong>
                <span style={{ color: "#9a5a2a", marginLeft: 6 }}>· 你可以随时删除或修改</span>
              </span>
            </div>
          )}
          {/* 方案说明 */}
          {v.desc && (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: COLOR.text2, lineHeight: 1.6, marginBottom: GAP.lg }}>
              {v.desc}
            </div>
          )}

          {/* 方案文档 — markdown 预览，点击打开阅读器 */}
          {v.content && (
            <div
              onClick={() => onOpenDocReader && onOpenDocReader(v)}
              style={{
                position: "relative", cursor: "pointer",
                background: "rgba(0,0,0,0.02)", border: `1px solid ${COLOR.border}`,
                borderRadius: GAP.md, padding: GAP.lg, marginBottom: GAP.lg,
                maxHeight: 120, overflow: "hidden",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = COLOR.border}
            >
              <div style={{ fontSize: FONT_SIZE.md, lineHeight: 1.5 }}>
                <Markdown components={previewMdComponents}>{v.content}</Markdown>
              </div>
              {/* 渐变遮罩 + 阅读全文提示 */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
                background: "linear-gradient(transparent 0%, rgba(253,252,250,0.95) 70%)",
                display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6,
              }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text5, fontWeight: 500 }}>
                  <FileText size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />阅读全文
                </span>
              </div>
            </div>
          )}

          {/* 外部链接 */}
          {v.link && (
            <div style={{ marginBottom: GAP.lg }}>
              <a href={ensureUrl(v.link)} target="_blank" rel="noopener noreferrer" style={{
                fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.blue,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6,
                background: "rgba(90,122,154,0.08)", border: "1px solid rgba(90,122,154,0.15)",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(90,122,154,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(90,122,154,0.08)"; }}
              >
                <ExternalLink size={11} />
                {v.link.length > 40 ? v.link.slice(0, 40) + "…" : v.link}
              </a>
            </div>
          )}

          {/* 附件列表 */}
          {v.attachments && v.attachments.length > 0 && (
            <div style={{ marginBottom: GAP.lg }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.text4, marginBottom: GAP.sm }}>附件</div>
              <div style={{ display: "flex", flexDirection: "column", gap: GAP.xs }}>
                {v.attachments.map((att, idx) => (
                  <a key={idx} href={`/api/${att.path}`} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: GAP.md,
                      padding: `${GAP.sm}px ${GAP.base}px`,
                      background: "rgba(0,0,0,0.02)", borderRadius: GAP.sm,
                      textDecoration: "none", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.02)"}
                  >
                    <File size={13} color={COLOR.blue} style={{ flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {att.originalName || att.path}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.sub, flexShrink: 0 }}>
                      {att.size ? (att.size / 1024).toFixed(1) + "KB" : ""}
                    </span>
                    <Download size={12} color={COLOR.dim} style={{ flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 评分记录 */}
          {v.scores && v.scores.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.text4, marginBottom: GAP.sm }}>评分记录</div>
              {groupScoresByTester(v.scores, activeDims).map((record, idx) => {
                const canEditScore = wo.status !== "done" && (role === "admin" || (role === "tester" && record.tester === user));
                return (
                <div key={idx} style={{
                  display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap",
                  padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.03)",
                  fontSize: FONT_SIZE.md, fontFamily: FONT_SANS,
                }}>
                  <span style={{ color: COLOR.text, fontWeight: 500, minWidth: 36, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {record.tester}
                    {record.authorType === 'ai' && <AIBadge tiny title={`小合代 ${record.proxyAuthorId || record.tester} 打分`} />}
                  </span>
                  <span style={{ color: COLOR.sub, minWidth: 40 }}>{record.date}</span>
                  <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap", flex: 1 }}>
                    {record.dims.map(ds => (
                      <span key={ds.dimId} style={{ color: COLOR.text3 }}>
                        {ds.dimName} <strong>{ds.value}</strong>/{ds.max || 10}
                      </span>
                    ))}
                  </div>
                  {/* 评分编辑/删除图标 */}
                  {canEditScore && (
                    <div style={{ display: "flex", gap: GAP.sm, alignItems: "center", marginLeft: "auto" }}>
                      <Pencil size={14}
                        style={{ color: COLOR.dim, cursor: "pointer", transition: "color 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.color = COLOR.text3}
                        onMouseLeave={e => e.currentTarget.style.color = COLOR.dim}
                        onClick={() => onEditScore && onEditScore({ planId: wo.id, variantId: v.id, tester: record.tester, scores: record.scoreIds, dims: record.dims })}
                      />
                      <Trash2 size={14}
                        style={{ color: COLOR.dim, cursor: "pointer", transition: "color 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.color = COLOR.error}
                        onMouseLeave={e => e.currentTarget.style.color = COLOR.dim}
                        onClick={() => {
                          if (window.confirm(`确认删除 ${record.tester} 的评分？`)) {
                            record.scoreIds.forEach(sid => onDeleteScore && onDeleteScore(wo.id, v.id, sid));
                          }
                        }}
                      />
                    </div>
                  )}
                  {record.comment && <span style={{ color: COLOR.text5, fontStyle: "italic", width: "100%", paddingLeft: 84 }}>"{record.comment}"</span>}
                  {record.evalDocs && record.evalDocs.length > 0 && (
                    <div style={{ width: "100%", paddingLeft: 84, display: "flex", gap: GAP.sm, flexWrap: "wrap", marginTop: GAP.xs }}>
                      {record.evalDocs.map((doc, di) => (
                        <span key={di}
                          onClick={() => onOpenDocReader && onOpenDocReader({ title: doc.title, content: doc.content })}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                            background: "rgba(90,122,154,0.08)", border: "1px solid rgba(90,122,154,0.12)",
                            fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.blue,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(90,122,154,0.16)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(90,122,154,0.08)"}
                        >
                          <FileText size={10} />{doc.title || `评测文档 ${di + 1}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {v.scores?.length === 0 && (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.dim, padding: `${GAP.xs}px 0` }}>暂无评分</div>
          )}
        </div>
      ),
    };
  });

  // 右上角操作按钮 — 按角色+状态决定，支持多按钮
  const actionBtn = (() => {
    const btns = [];

    if (wo.status === "next" && role === "admin") {
      btns.push(
        <button key="activate" onClick={() => onActivate && onActivate(wo)} style={btnAction}>
          <Play size={13} style={{ marginRight: 4 }} />激活工单
        </button>
      );
    }

    if (wo.status === "active") {
      // 主按钮
      if (role === "member") {
        btns.push(
          <button key="addVar" onClick={() => onAddVariant && onAddVariant(wo)} style={btnAction}>
            <Plus size={13} style={{ marginRight: 4 }} />添加方案
          </button>
        );
      }
      if (role === "tester") {
        btns.push(
          <button key="score" onClick={() => onOpenScorePanel && onOpenScorePanel()} style={btnAction}>
            <Star size={13} style={{ marginRight: 4 }} />评测打分
          </button>,
          <button key="addVar" onClick={() => onAddVariant && onAddVariant(wo)} style={btnActionSecondary}>
            <Plus size={13} style={{ marginRight: 4 }} />添加方案
          </button>
        );
      }
      if (role === "admin") {
        btns.push(
          <button key="complete" onClick={() => onMarkComplete && onMarkComplete(wo)} style={btnAction}>
            <ClipboardCheck size={13} style={{ marginRight: 4 }} />定稿
          </button>
        );
      }

      // 编辑方案副按钮（active 状态，所有角色可见）
      if (wo.variants.length > 0) {
        btns.push(
          <button key="editVar" onClick={() => onOpenVariantManager && onOpenVariantManager()} style={btnActionSecondary}>
            <Pencil size={13} style={{ marginRight: 4 }} />编辑方案
          </button>
        );
      }
    }

    if (wo.status === "done" && role === "admin") {
      btns.push(
        <button key="reopen" onClick={() => onReopen && onReopen(wo)} style={btnActionSecondary}>
          <RotateCcw size={13} style={{ marginRight: 4 }} />撤销定稿
        </button>
      );
    }

    return btns.length > 0 ? <div style={{ display: "flex", gap: GAP.sm, flexWrap: "wrap" }}>{btns}</div> : null;
  })();

  // 北京时间 endOfDay 语义：deadline=YYYY-MM-DD 的那一天 23:59+08 之前都不算逾期。
  // 之前用 new Date(wo.deadline) 会把它当 UTC 00:00 解析，东八区 08:00 就误判逾期。
  const isOverdue = wo.deadline && wo.status !== "done"
    && new Date(`${wo.deadline}T23:59:59+08:00`) < new Date();

  return (
    <FullPanel show={show} onClose={onClose} originRect={originRect} actions={actionBtn}>
      {/* Header — 标题 + 标签 + 元信息 */}
      <div style={{ marginBottom: GAP.xl }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.h1, color: COLOR.text, marginBottom: GAP.base }}>{wo.name}</div>

        {/* 标签行 */}
        <div style={{ display: "flex", gap: GAP.md, flexWrap: "wrap", alignItems: "center", marginBottom: GAP.lg }}>
          <span style={{ padding: "3px 8px", background: PRI[wo.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: PRI[wo.priority].c }}>{PRI[wo.priority].l}</span>
          {st && <span style={{ padding: "3px 8px", background: st.tagBg + "30", borderRadius: 6, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: st.c }}>{st.l}</span>}
          <span style={{ padding: "3px 8px", background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: wo.type === "skill" ? COLOR.brown : COLOR.blue }}>{wo.type === "skill" ? "Skill" : "MCP"}</span>
        </div>

        {/* 元信息栏：负责人 / 截止日 / 创建日 */}
        <div style={{
          display: "flex", gap: GAP.xl, flexWrap: "wrap", alignItems: "center",
          padding: `${GAP.base}px ${GAP.lg}px`, borderRadius: GAP.base,
          background: isOverdue ? "rgba(184,58,42,0.06)" : "rgba(0,0,0,0.025)",
          border: isOverdue ? "1px solid rgba(184,58,42,0.15)" : `1px solid ${COLOR.borderLt}`,
          marginBottom: GAP.lg,
        }}>
          {wo.owner && (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: COLOR.text5 }}>
              负责人 <span style={{ color: COLOR.text, fontFamily: FONT_MONO, fontWeight: 500 }}>{wo.owner}</span>
            </div>
          )}
          {(wo.deadline || role === 'admin') && (
            <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: isOverdue ? COLOR.error : COLOR.text5, display: 'flex', alignItems: 'center', gap: GAP.xs }}>
              <span>截止</span>
              {editingDeadline ? (
                <>
                  <input
                    type="date"
                    value={deadlineDraft}
                    autoFocus
                    onChange={e => setDeadlineDraft(e.target.value)}
                    style={{
                      fontFamily: FONT_MONO, fontSize: FONT_SIZE.md,
                      padding: '2px 6px', border: `1px solid ${COLOR.borderLt}`,
                      borderRadius: 4, color: COLOR.text, background: '#fff',
                    }}
                  />
                  <button
                    onClick={() => {
                      onEditPlan?.(wo.id, { deadline: deadlineDraft || '' });
                      setEditingDeadline(false);
                    }}
                    style={{
                      fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm,
                      padding: '2px 8px', border: 'none', borderRadius: 4,
                      background: COLOR.text, color: '#fff', cursor: 'pointer',
                    }}
                  >保存</button>
                  <button
                    onClick={() => setEditingDeadline(false)}
                    style={{
                      fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm,
                      padding: '2px 8px', border: `1px solid ${COLOR.borderLt}`,
                      borderRadius: 4, background: 'transparent', color: COLOR.text5, cursor: 'pointer',
                    }}
                  >取消</button>
                </>
              ) : (
                <>
                  <span style={{ color: isOverdue ? COLOR.error : COLOR.text, fontWeight: isOverdue ? 600 : 500, fontFamily: FONT_MONO }}>
                    {wo.deadline || '未设置'}
                  </span>
                  {isOverdue && <span style={{ marginLeft: GAP.xs, fontSize: FONT_SIZE.sm, fontWeight: 600 }}>已逾期</span>}
                  {role === 'admin' && (
                    <button
                      title="改截止日期"
                      onClick={() => { setDeadlineDraft(wo.deadline || ''); setEditingDeadline(true); }}
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        padding: '2px 4px', color: COLOR.sub, display: 'inline-flex', alignItems: 'center',
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.md, color: "#b5a898" }}>
            创建 <span style={{ fontFamily: FONT_MONO }}>{wo.created}</span>
          </div>
        </div>

        {wo.desc && (
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.lg, color: COLOR.text2, lineHeight: 1.6 }}>
            {wo.desc}
          </div>
        )}
      </div>

      {/* 对比表 */}
      <div style={{ marginBottom: GAP.md }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text3, marginBottom: GAP.md }}>方案对比</div>
        <ComparisonTable variants={wo.variants} dims={dims} />
      </div>

      {/* 方案详情 Accordion */}
      <div style={{ marginBottom: GAP.xl }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text3, marginBottom: GAP.md }}>
          方案详情 ({wo.variants.length})
        </div>
        {wo.variants.length > 0 ? (
          <Accordion
            items={accordionItems}
            expandedKey={expandedVar}
            onToggle={key => setExpandedVar(prev => prev === key ? null : key)}
          />
        ) : (
          <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.base, color: "#b5a898", padding: `${GAP.md}px 0` }}>暂无方案</div>
        )}
      </div>
    </FullPanel>
  );
}

const btnAction = {
  padding: `${GAP.sm}px ${GAP.lg}px`, borderRadius: GAP.md, cursor: "pointer",
  fontFamily: FONT_SANS,
  fontSize: FONT_SIZE.base, fontWeight: 500,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: COLOR.btn, color: COLOR.btnText,
  border: `1px solid ${COLOR.btn}`,
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  transition: "all 0.15s", whiteSpace: "nowrap",
};

const btnActionSecondary = {
  ...btnAction,
  background: COLOR.borderLt, color: COLOR.text3,
  border: `1px solid ${COLOR.borderHv}`,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

/** 确保链接有协议前缀 */
function ensureUrl(link) {
  if (!link) return "#";
  if (/^https?:\/\//i.test(link) || link.startsWith("//")) return link;
  return "https://" + link;
}

// markdown 预览的紧凑样式
const previewMdComponents = {
  h1: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.base, color: COLOR.text, fontWeight: 600, marginBottom: GAP.xs }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.md, color: COLOR.text2, fontWeight: 500, marginTop: GAP.sm, marginBottom: 2 }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.sm, color: COLOR.text3, fontWeight: 500, marginTop: GAP.xs }}>{children}</div>,
  p: ({ children }) => <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.text3, lineHeight: 1.5, marginBottom: 3 }}>{children}</div>,
  ul: ({ children }) => <div style={{ paddingLeft: GAP.lg, marginBottom: 3 }}>{children}</div>,
  ol: ({ children }) => <div style={{ paddingLeft: GAP.lg, marginBottom: 3 }}>{children}</div>,
  li: ({ children }) => <div style={{ fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.text3, lineHeight: 1.4 }}>- {children}</div>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  table: () => null, // 预览中隐藏表格
  code: ({ children }) => <code style={{ fontFamily: FONT_MONO, fontSize: FONT_SIZE.xs, background: COLOR.borderLt, padding: "0 3px", borderRadius: 2 }}>{children}</code>,
};

/** 按测试员+日期分组评分记录 */
function groupScoresByTester(scores, activeDims) {
  const groups = {};
  scores.forEach(s => {
    const key = `${s.tester}-${s.date}-${s.authorType || 'human'}`;   // AI 和真人同日分开
    if (!groups[key]) groups[key] = {
      tester: s.tester, date: s.date,
      comment: s.comment || "", evalDocs: [], dims: [], scoreIds: [],
      authorType: s.authorType || 'human',
      proxyAuthorId: s.proxyAuthorId || null,
    };
    const dim = activeDims.find(d => d.id === s.dimId);
    if (dim) groups[key].dims.push({ dimId: s.dimId, dimName: dim.name, value: s.value, max: dim.max });
    if (s.id) groups[key].scoreIds.push(s.id);
    if (s.comment) groups[key].comment = s.comment;
    if (s.evalDoc && groups[key].evalDocs.length === 0) {
      groups[key].evalDocs = parseEvalDocs(s.evalDoc);
    }
  });
  return Object.values(groups);
}

/** 解析 evalDoc：兼容 JSON 数组和旧版纯路径字符串 */
function parseEvalDocs(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(d => d.content);
  } catch { /* not JSON */ }
  return [];
}

/** 小合代笔徽章 — 橙棕风格 + 小螃蟹。tiny 版用于行内（评分行），default 更醒目 */
function AIBadge({ tiny = false, title = "小合代笔" }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        marginLeft: tiny ? 4 : 8,
        padding: tiny ? "0 5px" : "2px 8px",
        fontSize: tiny ? 10 : 12,
        fontFamily: FONT_MONO, fontWeight: 600,
        color: "#ffffff",
        background: "#b85c1a",
        border: "1px solid #9a4a12",
        borderRadius: tiny ? 3 : 4,
        lineHeight: 1.4,
        userSelect: "none",
        letterSpacing: 0.3,
      }}
    >
      🦀 {tiny ? "AI" : "AI 代笔"}
    </span>
  );
}
