let _pid = 10;
export function nPid() { return "p" + (_pid++); }

let _vid = 100;
export function nVid() { return "v" + (_vid++); }

let _did = 10;
export function nDid() { return "d" + (_did++); }

export function td() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/**
 * 自动推断进行中工单的子阶段
 * @param {object} plan - 工单对象
 * @param {array} activeDims - 启用的评测维度列表
 * @returns {"collecting"|"evaluating"|"finalizing"}
 */
export function getPhase(plan, activeDims) {
  if (!plan.variants || plan.variants.length === 0) return "collecting";

  const dimIds = activeDims.map(d => d.id);
  const allScored = plan.variants.every(v => {
    if (!v.scores || v.scores.length === 0) return false;
    return dimIds.every(did => v.scores.some(s => s.dimId === did));
  });

  return allScored ? "finalizing" : "evaluating";
}

/**
 * 计算方案在各维度的均分
 * 对每个维度取该方案所有测试员最新一次打分的平均值，再对维度取平均
 * @param {object} variant - 方案对象
 * @param {array} activeDims - 启用的评测维度列表
 * @returns {number} 均分，无评分时返回 0
 */
export function avgScore(variant, activeDims) {
  if (!variant.scores || variant.scores.length === 0 || activeDims.length === 0) return 0;

  const dimScores = activeDims.map(d => {
    // 找出所有测试员对该维度的评分
    const entries = variant.scores.filter(s => s.dimId === d.id);
    if (entries.length === 0) return null;

    // 按测试员分组，取每人最新一次
    const byTester = {};
    entries.forEach(s => {
      if (!byTester[s.tester] || s.date > byTester[s.tester].date) {
        byTester[s.tester] = s;
      }
    });

    const values = Object.values(byTester).map(s => s.value);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }).filter(v => v !== null);

  if (dimScores.length === 0) return 0;
  return dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
}

/**
 * 按北京时间 endOfDay 判断 deadline 状态
 * @param {string} deadline - YYYY-MM-DD
 * @param {string} status - plan.status，done 时直接判定 neutral
 * @returns {{ text: string, color: string, bg: string, daysLeft: number|null }}
 *   text:  "剩 3 天" / "今日到期" / "已逾期 2 天" / "" (无 deadline)
 *   color: 文字色（emoji hex）
 *   bg:    背景色
 */
export function deadlineBadge(deadline, status) {
  if (!deadline) return { text: "", color: "", bg: "", daysLeft: null };
  if (status === "done") return { text: "", color: "", bg: "", daysLeft: null };

  // 按北京时间 endOfDay 计算剩余天数：deadline 当天 23:59+08 之前算"当天"。
  // 逾期与剩余分支独立算，避免 ceil/floor 单函数覆盖不全导致边界偏 1 天。
  const endOfDay = new Date(`${deadline}T23:59:59+08:00`).getTime();
  const now = Date.now();
  const msPerDay = 24 * 3600 * 1000;
  const diffMs = endOfDay - now;

  if (diffMs < 0) {
    const overdue = Math.ceil(-diffMs / msPerDay);
    return { text: `已逾期 ${overdue} 天`, color: "#b83a2a", bg: "rgba(184,58,42,0.10)", daysLeft: -overdue };
  }
  const daysLeft = Math.floor(diffMs / msPerDay);

  if (daysLeft === 0) {
    return { text: "今日到期", color: "#b83a2a", bg: "rgba(184,58,42,0.08)", daysLeft };
  }
  if (daysLeft === 1) {
    return { text: "剩 1 天", color: "#b83a2a", bg: "rgba(184,58,42,0.06)", daysLeft };
  }
  if (daysLeft <= 3) {
    return { text: `剩 ${daysLeft} 天`, color: "#c46a1a", bg: "rgba(196,106,26,0.08)", daysLeft };
  }
  if (daysLeft <= 7) {
    return { text: `剩 ${daysLeft} 天`, color: "#8a6a3a", bg: "rgba(138,106,58,0.08)", daysLeft };
  }
  return { text: `剩 ${daysLeft} 天`, color: "#7a8b9c", bg: "rgba(0,0,0,0.03)", daysLeft };
}
