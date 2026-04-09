/**
 * MCP 工具权限检查
 * 在 tool handler 内调用，角色不符时抛出错误（MCP 返回 error content）
 */

/** 检查角色是否在允许列表中，不符合则抛出 */
export function assertRole(auth, ...allowed) {
  if (!auth || !auth.role) {
    throw new Error('未认证，请提供有效的 Bearer token');
  }
  if (!allowed.includes(auth.role)) {
    const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
    throw new Error(`角色「${roleMap[auth.role] || auth.role}」无权执行此操作，需要：${allowed.map(r => roleMap[r] || r).join('/')}`);
  }
}

/** 检查是否是资源所有者（admin 跳过检查） */
export function assertOwnerOrAdmin(auth, ownerUsername) {
  if (!auth || !auth.role) {
    throw new Error('未认证');
  }
  if (auth.role === 'admin') return;
  if (auth.username !== ownerUsername) {
    throw new Error('只能操作自己的资源');
  }
}
