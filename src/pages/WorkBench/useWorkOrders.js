import { useCallback } from "react";
import { nPid, nVid, td } from "../../utils/helpers.js";

/**
 * 工单 CRUD hook — 封装所有数据变更操作
 */
export default function useWorkOrders(plans, setPlans) {

  const addPlan = useCallback((data) => {
    const plan = {
      id: nPid(),
      name: data.name || "新工单",
      type: data.type || "skill",
      status: data.status || "next",
      priority: data.priority || "medium",
      created: td(),
      desc: data.desc || "",
      result: null,
      variants: [],
    };
    setPlans(prev => [...prev, plan]);
    return plan;
  }, [setPlans]);

  const editPlan = useCallback((id, data) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [setPlans]);

  const deletePlan = useCallback((id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  }, [setPlans]);

  const updatePlan = useCallback((updatedWo) => {
    setPlans(prev => prev.map(p => p.id === updatedWo.id ? updatedWo : p));
  }, [setPlans]);

  // 状态流转
  const activatePlan = useCallback((id) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "active" } : p));
  }, [setPlans]);

  const completePlan = useCallback((id, result) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "done", result: result || "adopted" } : p));
  }, [setPlans]);

  const shelvePlan = useCallback((id) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, status: "done", result: "shelved" } : p));
  }, [setPlans]);

  // 方案操作
  const addVariant = useCallback((planId, data) => {
    const variant = {
      id: nVid(),
      name: data.name || "新方案",
      uploader: data.uploader || "未知",
      uploaded: td(),
      desc: data.desc || "",
      link: data.link || "",
      scores: [],
    };
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, variants: [...p.variants, variant] } : p));
    return variant;
  }, [setPlans]);

  const deleteVariant = useCallback((planId, variantId) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, variants: p.variants.filter(v => v.id !== variantId) } : p));
  }, [setPlans]);

  // 提交评分
  const submitScores = useCallback((planId, variantId, scoreEntries) => {
    setPlans(prev => prev.map(p => p.id === planId ? {
      ...p,
      variants: p.variants.map(v => v.id === variantId ? { ...v, scores: [...(v.scores || []), ...scoreEntries] } : v),
    } : p));
  }, [setPlans]);

  return {
    addPlan, editPlan, deletePlan, updatePlan,
    activatePlan, completePlan, shelvePlan,
    addVariant, deleteVariant, submitScores,
  };
}
