/**
 * 小合 Bot 的 ability 权限系统（R1/R2）
 *
 * 设计要点：
 *   - 按动作粒度的正交权限（ability），跟 users.role（admin/tester/member）叠加
 *   - fallbackRoles：查 permissions 表查不到时按角色兜底（保第 1 轮工具迁移后行为等价）
 *   - fallbackRoles 含 null 表示允许未绑定用户（如 memory.self）
 *   - 未知 ability 默认拒绝（视为 fallbackRoles: []）
 *
 * 使用（代笔工具）：
 *   import { assertAbility } from './abilities.js';
 *   const user = assertAbility(context, 'plan.write');  // 失败抛错，成功返 boundUser（可能 null）
 */

import { hasPermission } from '../mcp/db-ops.js';

export const ABILITIES = {
  'plan.write':         { fallbackRoles: ['admin'] },
  'score.write':        { fallbackRoles: ['admin', 'tester'] },
  'variant.write':      { fallbackRoles: ['admin', 'tester', 'member'] },
  'memory.self':        { fallbackRoles: ['admin', 'tester', 'member', null] },
  'memory.peek_others': { fallbackRoles: [] },
  'patrol.config':      { fallbackRoles: ['admin'] },
  'dimension.crud':     { fallbackRoles: ['admin'] },
  'system.health':      { fallbackRoles: ['admin'] },
  'permissions.manage': { fallbackRoles: ['admin'] },
};

/** 所有合法 ability 名（工具参数校验用） */
export const ABILITY_NAMES = Object.keys(ABILITIES);

/**
 * 不抛错的布尔检查（给 grant_user_ability 做"不能 grant 自己没有的" 之类校验）
 */
export function checkAbility(context, ability) {
  const spec = ABILITIES[ability];
  if (!spec) return false;
  const user = context?.boundUser || null;
  const username = user?.username;

  // 1. DB 显式授权
  if (username) {
    try {
      if (hasPermission(username, ability)) return true;
    } catch (err) {
      console.warn(`[Bot/Abilities] hasPermission(${username}, ${ability}) 异常:`, err.message);
    }
  }

  // 2. 角色 fallback
  const role = user?.role ?? null;
  return spec.fallbackRoles.includes(role);
}

/**
 * 校验 ability；失败抛 Error（tools.js 的 classifyError 会归为 permission 类别）
 * 成功返 boundUser（可能 null，memory.self 允许 anon）
 */
export function assertAbility(context, ability) {
  if (!ABILITIES[ability]) {
    throw new Error(`未定义的 ability "${ability}"`);
  }
  if (checkAbility(context, ability)) {
    return context?.boundUser || null;
  }
  const user = context?.boundUser;
  const who = user ? `${user.username}（${user.role}）` : '未绑定用户';
  throw new Error(`角色无权执行此操作：${who} 不满足 ability "${ability}"`);
}
