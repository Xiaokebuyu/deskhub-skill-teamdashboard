import { z } from 'zod';
import * as ops from '../db-ops.js';

export function registerQueryTools(server, auth) {
  // 查询工具所有角色都可用，auth 参数保留但不做权限检查

  server.tool(
    'list_plans',
    '列出工单，可按类型和状态筛选',
    {
      type: z.enum(['skill', 'mcp']).optional().describe('按类型筛选'),
      status: z.enum(['next', 'active', 'done']).optional().describe('按状态筛选'),
    },
    async ({ type, status }) => {
      const plans = ops.listPlans({ type, status });

      if (!plans || plans.length === 0) {
        return { content: [{ type: 'text', text: '没有找到工单' }] };
      }

      const statusMap = { next: '待开始', active: '进行中', done: '已完成' };
      const priMap = { high: '高', medium: '中', low: '低' };
      const lines = plans.map(p => {
        const varCount = p.variants?.length || 0;
        const resultTag = p.result ? (p.result === 'adopted' ? ' [已采纳]' : ' [已搁置]') : '';
        return `- ${p.id} | ${p.name} | ${p.type} | ${statusMap[p.status] || p.status}${resultTag} | 优先级:${priMap[p.priority] || p.priority} | ${varCount}个方案`;
      });

      return { content: [{ type: 'text', text: `共 ${plans.length} 个工单：\n\n${lines.join('\n')}` }] };
    }
  );

  server.tool(
    'get_plan_detail',
    '查看工单详情：方案列表、评分记录、当前阶段',
    { plan_id: z.string().describe('工单 ID') },
    async ({ plan_id }) => {
      const plan = ops.getPlanDetail(plan_id);
      if (!plan) {
        return { content: [{ type: 'text', text: `工单 ${plan_id} 不存在` }] };
      }

      const dims = ops.getDimensions();
      const activeDims = dims.filter(d => d.active);

      let phase = '征集方案';
      if (plan.variants && plan.variants.length > 0) {
        const dimIds = activeDims.map(d => d.id);
        const allScored = plan.variants.every(v => {
          if (!v.scores || v.scores.length === 0) return false;
          return dimIds.every(did => v.scores.some(s => s.dimId === did));
        });
        phase = allScored ? '待定稿' : '评测中';
      }

      const statusMap = { next: '待开始', active: '进行中', done: '已完成' };
      const priMap = { high: '高', medium: '中', low: '低' };

      let text = `工单详情：${plan.name}\n`;
      text += `━━━━━━━━━━━━━━━━━━\n`;
      text += `ID: ${plan.id}\n`;
      text += `类型: ${plan.type}\n`;
      text += `状态: ${statusMap[plan.status] || plan.status}`;
      if (plan.status === 'active') text += ` (${phase})`;
      if (plan.result) text += ` [${plan.result === 'adopted' ? '已采纳' : '已搁置'}]`;
      text += `\n`;
      text += `优先级: ${priMap[plan.priority] || plan.priority}\n`;
      if (plan.owner) text += `负责人: ${plan.owner}\n`;
      if (plan.deadline) text += `截止: ${plan.deadline}\n`;
      if (plan.desc) text += `描述: ${plan.desc}\n`;

      text += `\n方案 (${plan.variants?.length || 0})：\n`;
      if (!plan.variants || plan.variants.length === 0) {
        text += `  暂无方案\n`;
      } else {
        for (const v of plan.variants) {
          let avg = 0;
          if (v.scores && v.scores.length > 0 && activeDims.length > 0) {
            const dimScores = activeDims.map(d => {
              const entries = v.scores.filter(s => s.dimId === d.id);
              if (entries.length === 0) return null;
              const byTester = {};
              entries.forEach(s => {
                if (!byTester[s.tester] || s.date > byTester[s.tester].date) byTester[s.tester] = s;
              });
              const vals = Object.values(byTester).map(s => s.value);
              return vals.reduce((a, b) => a + b, 0) / vals.length;
            }).filter(x => x !== null);
            if (dimScores.length > 0) avg = dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
          }

          text += `\n  ┌ ${v.name} (${v.id})\n`;
          text += `  │ 提交人: ${v.uploader} | 日期: ${v.uploaded}\n`;
          if (v.desc) text += `  │ 描述: ${v.desc}\n`;
          if (v.link) text += `  │ 链接: ${v.link}\n`;
          text += `  │ 均分: ${avg > 0 ? avg.toFixed(1) : '未评分'}\n`;

          if (v.scores && v.scores.length > 0) {
            for (const d of activeDims) {
              const dimEntries = v.scores.filter(s => s.dimId === d.id);
              if (dimEntries.length > 0) {
                const latest = {};
                dimEntries.forEach(s => {
                  if (!latest[s.tester] || s.date > latest[s.tester].date) latest[s.tester] = s;
                });
                const vals = Object.values(latest);
                const avgDim = vals.reduce((a, b) => a + b.value, 0) / vals.length;
                const details = vals.map(s => `${s.tester}:${s.value}`).join(', ');
                text += `  │ ${d.name}: ${avgDim.toFixed(1)}/${d.max} (${details})\n`;
              }
            }
          }
          text += `  └─\n`;
        }
      }

      return { content: [{ type: 'text', text }] };
    }
  );

  server.tool(
    'get_dimensions',
    '查看当前所有评测维度',
    {},
    async () => {
      const dims = ops.getDimensions();
      if (!dims || dims.length === 0) {
        return { content: [{ type: 'text', text: '暂无评测维度' }] };
      }

      const lines = dims.map(d => {
        const status = d.active ? '启用' : '停用';
        return `- ${d.id} | ${d.name} | 满分:${d.max} | ${status}`;
      });

      return { content: [{ type: 'text', text: `评测维度 (${dims.length})：\n\n${lines.join('\n')}` }] };
    }
  );
}
