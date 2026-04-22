/**
 * 小合 Bot 的 ability 权限枚举（R1：纯数据）
 *
 * 设计要点：
 *   - 按动作粒度的正交权限（ability），跟 users.role（admin/tester/member）叠加
 *   - fallbackRoles：查 permissions 表查不到时按角色兜底
 *   - fallbackRoles 含 null 表示允许未绑定用户（如 memory.self）
 *   - 未知 ability 默认拒绝（视为 fallbackRoles: []）
 *
 * 校验逻辑（assertAbility / checkAbility）在 R2 加入。
 */

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
