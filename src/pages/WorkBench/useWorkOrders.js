import { useCallback, useRef } from "react";
import { nPid, nVid, td } from "../../utils/helpers.js";
import * as api from "../../services/workService.js";

const USE_API = import.meta.env.VITE_USE_API !== 'false';

/**
 * 工单 CRUD hook — 乐观更新 + 后端持久化
 * 操作流程：立即更新本地 state → 异步调 API → 失败回滚
 */
export default function useWorkOrders(plans, setPlans, role = 'admin', user = '', token = '') {

  const rollbackRef = useRef(null);

  /** 保存回滚快照 */
  const snap = () => { rollbackRef.current = plans; };
  /** 回滚 */
  const rollback = (err) => {
    console.error('[workOrders] API 失败，回滚:', err?.message || err);
    if (rollbackRef.current) setPlans(rollbackRef.current);
  };

  // --- 工单 ---

  const addPlan = useCallback((data) => {
    const tempId = nPid();
    const plan = {
      id: tempId, name: data.name || "新工单", type: data.type || "skill",
      status: data.status || "next", priority: data.priority || "medium",
      created: td(), desc: data.desc || "", result: null,
      owner: data.owner || "", deadline: data.deadline || "",
      variants: [],
    };
    setPlans(prev => [...prev, plan]);

    if (USE_API) {
      api.createPlan({
        name: plan.name, type: plan.type, priority: plan.priority,
        desc: plan.desc, status: plan.status,
        owner: plan.owner, deadline: plan.deadline,
      }, token)
        .then(serverPlan => {
          setPlans(prev => prev.map(p => p.id === tempId ? {
            ...p, id: serverPlan.id, created: serverPlan.created,
            owner: serverPlan.owner, deadline: serverPlan.deadline,
          } : p));
        })
        .catch(rollback);
    }
    return plan;
  }, [setPlans, plans, token]);

  const editPlan = useCallback((id, data) => {
    snap();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    if (USE_API) api.editPlan(id, data, token).catch(rollback);
  }, [setPlans, plans, token]);

  const deletePlan = useCallback((id) => {
    snap();
    setPlans(prev => prev.filter(p => p.id !== id));
    if (USE_API) api.deletePlan(id, token).catch(rollback);
  }, [setPlans, plans, token]);

  const updatePlan = useCallback((updatedWo) => {
    setPlans(prev => prev.map(p => p.id === updatedWo.id ? updatedWo : p));
  }, [setPlans]);

  const activatePlan = useCallback((id) => {
    snap();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "active" } : p));
    if (USE_API) api.updatePlanStatus(id, { status: "active" }, token).catch(rollback);
  }, [setPlans, plans, token]);

  const completePlan = useCallback((id, result) => {
    snap();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "done", result: result || "adopted" } : p));
    if (USE_API) api.updatePlanStatus(id, { status: "done", result: result || "adopted" }, token).catch(rollback);
  }, [setPlans, plans, token]);

  const shelvePlan = useCallback((id) => {
    snap();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "done", result: "shelved" } : p));
    if (USE_API) api.updatePlanStatus(id, { status: "done", result: "shelved" }, token).catch(rollback);
  }, [setPlans, plans, token]);

  const reopenPlan = useCallback((id) => {
    snap();
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "active", result: null } : p));
    if (USE_API) api.updatePlanStatus(id, { status: "active" }, token).catch(rollback);
  }, [setPlans, plans, token]);

  // --- 方案 ---

  const addVariant = useCallback((planId, data) => {
    const tempId = nVid();
    const variant = {
      id: tempId, name: data.name || "新方案", uploader: data.uploader || "未知",
      uploaded: td(), desc: data.desc || "", link: data.link || "",
      content: data.content || null, attachments: data.attachments || [], scores: [],
    };
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, variants: [...p.variants, variant] } : p));

    if (USE_API) {
      api.createVariant(planId, { name: variant.name, uploader: variant.uploader, desc: variant.desc, link: variant.link, content: variant.content, attachments: variant.attachments }, token)
        .then(serverVar => {
          setPlans(prev => prev.map(p => p.id === planId ? {
            ...p, variants: p.variants.map(v => v.id === tempId ? { ...v, id: serverVar.id, uploaded: serverVar.uploaded } : v),
          } : p));
        })
        .catch(rollback);
    }
    return variant;
  }, [setPlans, plans, token]);

  const editVariant = useCallback((planId, variantId, data) => {
    snap();
    setPlans(prev => prev.map(p => p.id === planId ? {
      ...p, variants: p.variants.map(v => v.id === variantId ? { ...v, ...data } : v),
    } : p));
    if (USE_API) api.editVariant(variantId, data, token).catch(rollback);
  }, [setPlans, plans, token]);

  const deleteVariant = useCallback((planId, variantId) => {
    snap();
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, variants: p.variants.filter(v => v.id !== variantId) } : p));
    if (USE_API) api.deleteVariant(variantId, token).catch(rollback);
  }, [setPlans, plans, token]);

  // --- 评分 ---

  const submitScores = useCallback((planId, variantId, scoreEntries) => {
    snap();
    setPlans(prev => prev.map(p => p.id === planId ? {
      ...p,
      variants: p.variants.map(v => v.id === variantId ? { ...v, scores: [...(v.scores || []), ...scoreEntries] } : v),
    } : p));

    if (USE_API) {
      const body = {
        tester: scoreEntries[0]?.tester,
        scores: scoreEntries.map(s => ({ dim_id: s.dimId, value: s.value, comment: s.comment || '' })),
        evalDoc: scoreEntries[0]?.evalDoc || null,
      };
      api.submitScores(variantId, body, token)
        .then(data => {
          if (!data?.scores) return;
          // 用服务端返回的 scores（带真实 id）替换本地乐观插入的临时条目
          setPlans(prev => prev.map(p => p.id === planId ? {
            ...p,
            variants: p.variants.map(v => {
              if (v.id !== variantId) return v;
              // 去掉本次乐观插入的（无 id 的），换上服务端的
              const oldScores = v.scores.filter(s => s.id);
              return { ...v, scores: [...oldScores, ...data.scores.map(s => ({ ...s, date: scoreEntries[0]?.date }))] };
            }),
          } : p));
        })
        .catch(rollback);
    }
  }, [setPlans, plans, token]);

  const editScore = useCallback((planId, variantId, scoreId, data) => {
    snap();
    setPlans(prev => prev.map(p => p.id === planId ? {
      ...p,
      variants: p.variants.map(v => v.id === variantId ? {
        ...v, scores: v.scores.map(s => s.id === scoreId ? { ...s, ...data } : s),
      } : v),
    } : p));
    if (USE_API) api.editScore(scoreId, data, token).catch(rollback);
  }, [setPlans, plans, token]);

  const deleteScore = useCallback((planId, variantId, scoreId) => {
    snap();
    setPlans(prev => prev.map(p => p.id === planId ? {
      ...p,
      variants: p.variants.map(v => v.id === variantId ? {
        ...v, scores: v.scores.filter(s => s.id !== scoreId),
      } : v),
    } : p));
    if (USE_API) api.deleteScore(scoreId, token).catch(rollback);
  }, [setPlans, plans, token]);

  return {
    addPlan, editPlan, deletePlan, updatePlan,
    activatePlan, completePlan, shelvePlan, reopenPlan,
    addVariant, editVariant, deleteVariant,
    submitScores, editScore, deleteScore,
  };
}
