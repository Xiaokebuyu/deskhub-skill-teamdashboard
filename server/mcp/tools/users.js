import { z } from 'zod';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

export function registerUserTools(server, auth) {
  server.tool(
    'list_users',
    '列出所有系统用户。需要管理员权限。',
    {},
    async () => {
      assertRole(auth, 'admin');
      const users = ops.listUsers();
      if (!users || users.length === 0) {
        return { content: [{ type: 'text', text: '暂无用户' }] };
      }

      const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
      const lines = users.map(u =>
        `- ${u.id} | ${u.username} | ${roleMap[u.role] || u.role} | ${u.displayName}`
      );

      return { content: [{ type: 'text', text: `用户列表 (${users.length})：\n\n${lines.join('\n')}` }] };
    }
  );

  server.tool(
    'create_user',
    '创建新用户。需要管理员权限。',
    {
      username: z.string().describe('用户名'),
      password: z.string().describe('密码'),
      role: z.enum(['admin', 'tester', 'member']).default('member').describe('角色'),
      display_name: z.string().default('').describe('显示名称'),
    },
    async ({ username, password, role, display_name }) => {
      assertRole(auth, 'admin');
      const user = ops.createUser({ username, password, role, displayName: display_name });
      const roleMap = { admin: '管理员', tester: '测试员', member: '成员' };
      return { content: [{ type: 'text', text: `用户已创建\nID: ${user.id}\n用户名: ${user.username}\n角色: ${roleMap[user.role] || user.role}\n显示名: ${user.displayName}` }] };
    }
  );

  server.tool(
    'delete_user',
    '删除用户。需要管理员权限。',
    { user_id: z.string().describe('用户 ID') },
    async ({ user_id }) => {
      assertRole(auth, 'admin');
      ops.deleteUser(user_id);
      return { content: [{ type: 'text', text: `用户 ${user_id} 已删除` }] };
    }
  );
}
