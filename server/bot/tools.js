/**
 * 飞书机器人工具层
 * 只读查询 + send_notification + 小合代笔写入工具（proxy_*）
 *
 * 代笔工具设计：
 *   - 工具名以 proxy_ 开头：明确告诉 LLM 这是"以用户代理身份执行"，与普通 MCP 分开
 *   - 执行时从 context.boundUser 拿 username 作为 proxyAuthorId
 *   - db-ops 层写入时 author_type='ai' + proxy_author_id=委托者 + proxy_metadata=时间等元数据
 *   - 前端 WoFullPanel 读取 authorType 字段渲染 AI 徽章 + 淡橙底色
 *
 * 硬安全：
 *   - proxy_create_plan / proxy_edit_plan 要求 boundUser.role === 'admin'
 *   - proxy_submit_scores / edit_score / delete_score 要求 role ∈ {admin, tester}
 *   - activate_plan / complete_plan / reopen_plan / delete_plan / create_user / delete_user 永不授权（不定义给她）
 */

import {
  listPlans, getPlanDetail, getDimensions, listUsers, getRecentChanges,
  createPlan, editPlan, addVariant, editVariant, deleteVariant,
  submitScores, editScore, deleteScore, appendVariantFiles,
  grantPermission, revokePermission, listUserPermissions, listAllPermissionGrants,
  getPatrolConfig, setPatrolConfig, PATROL_CONFIG_KEYS, PATROL_CONFIG_SCHEMA,
  createDimension, editDimension, deleteDimension,
} from '../mcp/db-ops.js';
import {
  listDeskhubSkills, getDeskhubSkill, fetchDeskhubFile,
  getUmamiStats, getUmamiActive,
} from '../mcp/proxy-ops.js';
import db from '../db/init.js';
import { createAndSendCard, uploadFileToFeishu, sendFileMessage } from './feishu.js';
import { buildPersonalCard } from './card-templates.js';
import {
  loadUserMemory, saveUserMemory,
  upsertSection, removeSection, appendNote,
  checkSizeLimit, MEMORY_SIZE_SOFT_LIMIT, MEMORY_SIZE_HARD_LIMIT,
} from './memory/index.js';
import { assertAbility, checkAbility, ABILITIES, ABILITY_NAMES } from './abilities.js';
import { getActiveSessionCount } from './session.js';
import { getConcurrencyMetrics } from './concurrency.js';
import { beijingNowLine } from '../utils/time.js';

// ── 工具定义（Anthropic / MiniMax 兼容格式）──

export const TOOL_DEFINITIONS = [
  {
    name: 'list_plans',
    description: '查询工单列表。可按类型(skill/mcp)和状态(next/active/done)筛选。返回工单名称、状态、优先级、方案数等概览信息。',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['skill', 'mcp'], description: '工单类型筛选' },
        status: { type: 'string', enum: ['next', 'active', 'done'], description: '工单状态筛选' },
      },
    },
  },
  {
    name: 'get_plan_detail',
    description: '查询单个工单的完整详情，包括所有方案、各维度评分、当前阶段(征集方案/评测中/待定稿)。需要提供 plan_id。',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: '工单 ID，如 p1234abcd' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'get_dimensions',
    description: '查看当前所有评分维度（评估标准），包括维度名称和满分值。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_deskhub_skills',
    description: '查询 DeskHub 上已发布的技能列表。可按关键词搜索，返回技能名称、描述、状态等信息。',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '返回数量限制' },
      },
    },
  },
  {
    name: 'get_deskhub_skill',
    description: '查询 DeskHub 上某个技能的详细信息。需要提供技能的 slug（唯一标识）。',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: '技能 slug，如 ppt-generator' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_umami_stats',
    description: '查询网站访问统计数据（访问量、用户数、跳出率等）。需要指定时间范围，单位为毫秒时间戳。',
    input_schema: {
      type: 'object',
      properties: {
        start_at: { type: 'number', description: '开始时间（毫秒时间戳）' },
        end_at: { type: 'number', description: '结束时间（毫秒时间戳）' },
      },
      required: ['start_at', 'end_at'],
    },
  },
  {
    name: 'get_umami_active',
    description: '查询当前网站在线活跃用户数。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_users',
    description: '查询系统中的所有团队成员，包括用户名、角色（管理员/测试员/成员）和显示名。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_changes',
    description: '查询最近的工作台变更记录（新建工单、新增方案、提交评分、状态变更等）。',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回数量，默认 20' },
      },
    },
  },
  {
    name: 'send_notification',
    description: '给团队成员发送飞书私聊消息。只能发给 users 表中已注册且绑定了飞书的成员。用户要求时才用。',
    input_schema: {
      type: 'object',
      properties: {
        target_username: { type: 'string', description: '目标用户的 username' },
        message: { type: 'string', description: '消息内容（支持 markdown）' },
      },
      required: ['target_username', 'message'],
    },
  },

  // ========================================================
  //  代笔写入工具 (proxy_*)
  //  只在用户明确要求时才用。不允许自发判断"帮用户写"
  //  所有写入会自动打 AI 标识（author_type='ai' + proxy_author_id=当前对话用户）
  // ========================================================
  {
    name: 'proxy_create_plan',
    description: '[代笔] 以当前用户名义创建新工单。⚠️ 仅在管理员明确要求"创建工单/建个工单/新开工单"时才用，不要自己判断"应该建个工单"。需要管理员权限。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工单名称' },
        type: { type: 'string', enum: ['skill', 'mcp'], description: '工单类型' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级，默认 medium' },
        desc: { type: 'string', description: '工单描述' },
        owner: { type: 'string', description: '负责人 username' },
        deadline: { type: 'string', description: '截止日期 YYYY-MM-DD' },
        related_skill: { type: 'string', description: '关联技能 slug（可选）' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'proxy_edit_plan',
    description: '[代笔] 以当前用户名义编辑工单基本信息（名称/描述/优先级/负责人/截止/关联技能）。⚠️ 仅在管理员明确要求时用。需要管理员权限。注意：状态变更（激活/定稿/重启）不在此工具，必须管理员亲自在前端操作。',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        name: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        desc: { type: 'string' },
        owner: { type: 'string' },
        deadline: { type: 'string' },
        related_skill: { type: 'string' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'proxy_add_variant',
    description: '[代笔] 以当前用户名义给工单新增方案。当用户说"帮我写个方案"、"加一个方案"时用。该方案会被标记为 AI 代笔，用户可随时删除。',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: '所属工单 ID' },
        name: { type: 'string', description: '方案名称' },
        desc: { type: 'string', description: '方案描述' },
        link: { type: 'string', description: '外部链接（可选）' },
        content: { type: 'string', description: 'Markdown 格式的完整方案文档（可选）' },
      },
      required: ['plan_id', 'name'],
    },
  },
  {
    name: 'proxy_edit_variant',
    description: '[代笔] 编辑方案内容。⚠️ 只能编辑自己（小合）代笔过的方案，不能动真人的方案。',
    input_schema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string' },
        name: { type: 'string' },
        desc: { type: 'string' },
        link: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['variant_id'],
    },
  },
  {
    name: 'proxy_delete_variant',
    description: '[代笔] 删除方案。⚠️ 只能删自己代笔过的方案。',
    input_schema: {
      type: 'object',
      properties: { variant_id: { type: 'string' } },
      required: ['variant_id'],
    },
  },
  {
    name: 'proxy_submit_scores',
    description: '[代笔] 以当前用户名义提交评测分数。用户说"帮我给 X 方案打分"、"记一下评测"时用。需要 tester 或 admin 权限。',
    input_schema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: '方案 ID' },
        scores: {
          type: 'array',
          description: '多维度评分数组',
          items: {
            type: 'object',
            properties: {
              dim_id: { type: 'string', description: '维度 ID（如 d1, d2）' },
              value: { type: 'number', description: '分值' },
              comment: { type: 'string', description: '评语' },
            },
            required: ['dim_id', 'value'],
          },
        },
        evalDoc: { type: 'string', description: '整体评测文档链接（可选）' },
      },
      required: ['variant_id', 'scores'],
    },
  },
  {
    name: 'proxy_edit_score',
    description: '[代笔] 编辑已提交的评分。⚠️ 只能改自己代笔过的评分。',
    input_schema: {
      type: 'object',
      properties: {
        score_id: { type: 'string' },
        value: { type: 'number' },
        comment: { type: 'string' },
        evalDoc: { type: 'string' },
      },
      required: ['score_id'],
    },
  },
  {
    name: 'proxy_delete_score',
    description: '[代笔] 删除评分。⚠️ 只能删自己代笔过的评分。',
    input_schema: {
      type: 'object',
      properties: { score_id: { type: 'string' } },
      required: ['score_id'],
    },
  },
  {
    name: 'proxy_upload_file',
    description: '[代笔] 以当前用户名义上传一个文本文件附件到方案（内容由你直接生成，比如方案细化文档 / 评测记录 / 会议纪要等 markdown）。文件会挂在目标方案的附件区，带 AI 标识。',
    input_schema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: '目标方案 ID' },
        filename: { type: 'string', description: '文件名（带扩展名，如 "方案详述.md"）' },
        content: { type: 'string', description: '文件文本内容（通常是 markdown）' },
      },
      required: ['variant_id', 'filename', 'content'],
    },
  },

  // ========================================================
  //  记忆工具（per-user markdown）
  //  只在用户明确表达"记住/忘掉/改偏好"类意图时才写
  //  Public 段 = 可能在群聊对任何人提起；Private 段 = 仅当前私聊使用
  // ========================================================
  {
    name: 'update_memory_section',
    description: '在你对当前用户的记忆里新建或更新一个命名段落。用于记录"画像/偏好/协作方式/通知习惯/进行中的关注"等软信息。**不要**记事实数据（工单状态/评分数值/人名等——去查 DB）。只在用户明确表达"记住/以后这样/我的偏好"时调用。',
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: '段落标题（不含 ###，如"画像"、"协作偏好"、"通知偏好"）' },
        content: { type: 'string', description: '段落正文，几行即可；保持精炼、抽象、可复用' },
        segment: {
          type: 'string', enum: ['public', 'private'],
          description: 'public=群聊+私聊都可注入；private=仅私聊注入（群里永不泄露）。拿不准选 private',
        },
      },
      required: ['section', 'content', 'segment'],
    },
  },
  {
    name: 'append_memory_note',
    description: '在记忆里追加一条带日期的短笔记（≤30 字）。用于捕捉"今天他提到 X、他在跟进 Y"这类上下文锚点，不适合写进结构化段落的零散观察。',
    input_schema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: '一行短笔记（≤30 字）' },
        segment: { type: 'string', enum: ['public', 'private'] },
      },
      required: ['note', 'segment'],
    },
  },
  {
    name: 'forget_memory_section',
    description: '删除记忆里的某个命名段落（同名的 public 和 private 段都会删）。仅在用户说"忘了那件事/别再记住 X"时用。',
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: '要删除的段落标题' },
      },
      required: ['section'],
    },
  },

  // ========================================================
  //  系统健康检查（system.health）
  // ========================================================
  {
    name: 'get_system_health',
    description: '查看服务器健康指标：Node 进程（memory/uptime/cpu）+ 工作台基本统计（工单数/近24h变更/active session）+ 并发状态。用户问"服务器状态"、"系统还好吗"、"现在负载如何"时用。',
    input_schema: { type: 'object', properties: {} },
  },

  // ========================================================
  //  维度代笔（dimension.crud）
  // ========================================================
  {
    name: 'proxy_add_dimension',
    description: '[代笔] 新增一个评测维度。仅在管理员明确要求"加一个评测维度 XXX 满分 Y"时用。需要 dimension.crud 权限。',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '维度名称（如 "响应速度"、"可维护性"）' },
        max: { type: 'number', description: '满分，默认 10' },
      },
      required: ['name'],
    },
  },
  {
    name: 'proxy_edit_dimension',
    description: '[代笔] 编辑维度：改名 / 改满分 / 启用停用（active 字段）。需要 dimension.crud。关闭某个维度用 { dimension_id, active: false }。',
    input_schema: {
      type: 'object',
      properties: {
        dimension_id: { type: 'string' },
        name: { type: 'string' },
        max: { type: 'number' },
        active: { type: 'boolean', description: 'true=启用，false=停用（保留历史评分）' },
      },
      required: ['dimension_id'],
    },
  },
  {
    name: 'proxy_delete_dimension',
    description: '[代笔] 软删除维度（设 active=0，不物理删除，历史评分保留）。需要 dimension.crud。',
    input_schema: {
      type: 'object',
      properties: {
        dimension_id: { type: 'string' },
      },
      required: ['dimension_id'],
    },
  },

  // ========================================================
  //  巡检配置工具（patrol.config）
  // ========================================================
  {
    name: 'get_patrol_config',
    description: '读取当前巡检/通知配置（patrol_hour/patrol_enabled/deadline_alert_days/flush 窗口/通知群 ids）。用户问"巡检几点触发"、"到期预警阈值"时用。',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_patrol_config',
    description: '修改巡检/通知配置的某一项。合法 key：patrol_hour（0-23）/patrol_enabled（0/1）/deadline_alert_days（1-30）/high_flush_ms（5000-3600000）/normal_flush_ms（10000-86400000）/notify_chat_ids（逗号分隔）。热生效项：patrol_hour / patrol_enabled / deadline_alert_days / notify_chat_ids，flush_ms 改后需 pm2 restart。',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '配置键名' },
        value: { description: '新值（整数传数字，notify_chat_ids 传字符串）' },
      },
      required: ['key', 'value'],
    },
  },

  // ========================================================
  //  权限管理工具（permissions.manage）
  // ========================================================
  {
    name: 'grant_user_ability',
    description: '给目标用户授予某个 ability（按动作粒度的权限）。需要 permissions.manage。用于把 patrol.config / dimension.crud / system.health 等原本 admin-only 的能力下放给特定 tester 或 member。',
    input_schema: {
      type: 'object',
      properties: {
        target_username: { type: 'string', description: '目标用户 username（必须是 users 表里已存在的）' },
        ability: { type: 'string', description: '要授予的 ability 名（如 patrol.config、dimension.crud）' },
      },
      required: ['target_username', 'ability'],
    },
  },
  {
    name: 'revoke_user_ability',
    description: '撤销目标用户的某个 ability。仅撤销显式授权；不会影响角色 fallback（如 admin 依然自动拥有）。',
    input_schema: {
      type: 'object',
      properties: {
        target_username: { type: 'string' },
        ability: { type: 'string' },
      },
      required: ['target_username', 'ability'],
    },
  },
  {
    name: 'list_user_abilities',
    description: '列出某用户或所有用户的显式授权记录。不带 target_username 则返回全部 grant。注意：角色 fallback（admin 默认拥有所有）不体现在这里——只看 DB 表。',
    input_schema: {
      type: 'object',
      properties: {
        target_username: { type: 'string', description: '留空则返回所有 grant 记录' },
      },
    },
  },

  // ========================================================
  //  DeskHub 文件读取 + 飞书发附件
  // ========================================================
  {
    name: 'get_deskhub_skill_file',
    description: '读取 DeskHub 上某个技能里的单个文本文件内容（如 SKILL.md / 源码 / 示例）。传入技能 slug 和文件相对路径。返回文件内容文本。用户问"这个技能是怎么实现的"、"看看 XXX 技能的 SKILL.md" 时用。',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: '技能 slug，如 ppt-generator' },
        path: { type: 'string', description: '文件相对路径，如 "SKILL.md" 或 "scripts/agenda.py"' },
      },
      required: ['slug', 'path'],
    },
  },
  {
    name: 'send_file_to_user',
    description: '把一个文本文件以飞书附件消息发送给当前对话的用户。用户说"把 XXX 发给我"、"把你刚写的方案保存成文件给我"、"下载 XXX" 时用。文件内容由你直接提供（或先用 get_deskhub_skill_file 拿到内容再来这里发）。',
    input_schema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: '文件名（含扩展名，如 "方案v1.md"、"评测报告.md"）' },
        content: { type: 'string', description: '文件内容（UTF-8 文本，通常是 markdown）' },
      },
      required: ['filename', 'content'],
    },
  },
];

// 闲聊工具集（未绑定用户）— 不含平台数据查询和通知，但允许写自己的 anon memory
export const TOOL_DEFINITIONS_CHAT_ONLY = TOOL_DEFINITIONS.filter(t =>
  t.name === 'update_memory_section' ||
  t.name === 'append_memory_note' ||
  t.name === 'forget_memory_section'
);

/**
 * 给 tool 数组的最后一项加 cache_control，使整个 tools 列表进入 prompt cache
 * 工具定义稳定且体积大（~3000 token），缓存命中时输入价 ×0.1
 */
export function withToolsCache(tools) {
  if (!tools || tools.length === 0) return tools;
  const head = tools.slice(0, -1);
  const last = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } };
  return [...head, last];
}

// ── 工具执行器 ──

/** 构造代笔 metadata，每次写入记录时刻 + 模型信息 */
function buildProxyMetadata() {
  return {
    requested_at: new Date().toISOString(),
    actor: 'xiaohe-bot',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7-highspeed',
  };
}

// 写类工具（db_write 分类用）
const WRITE_TOOL_PREFIXES = ['proxy_'];
// 走外部 HTTP 的工具（DeskHub / Umami / 飞书）
const HTTP_TOOL_NAMES = new Set([
  'list_deskhub_skills', 'get_deskhub_skill', 'get_deskhub_skill_file',
  'get_umami_stats', 'get_umami_active',
  'send_notification', 'send_file_to_user',
]);

/**
 * 根据 err 和 toolName 分类错误，返回 { category, retryable, suggestion? }
 * 给 LLM 做 agentic 决策用，不在此处自动重试
 */
function classifyError(err, toolName) {
  const msg = err?.message || String(err);
  const code = err?.code || '';
  const name = err?.name || '';

  // AbortError（fetch 被 agent-loop 的 AbortController 取消）→ 视同 timeout，可重试
  if (name === 'AbortError' || code === 'ABORT_ERR') {
    return { category: 'timeout', retryable: true };
  }

  // SQLite 错误
  if (typeof code === 'string' && code.startsWith('SQLITE_')) {
    const isWrite = WRITE_TOOL_PREFIXES.some(p => toolName.startsWith(p));
    const category = isWrite ? 'db_write' : 'db_read';
    const retryable = code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
    return { category, retryable };
  }

  // 权限类（assertAbility / 业务所有权校验 抛出）
  if (msg.includes('无权执行') ||
      msg.includes('只能编辑自己代笔') ||
      msg.includes('只能删除自己代笔') ||
      msg.includes('未定义的 ability')) {
    return { category: 'permission', retryable: false };
  }

  // 参数/资源不存在类（LLM 换参或换资源可再试）
  if (msg.includes('必填') || msg.includes('不存在') ||
      msg.includes('未找到') || msg.includes('超过') ||
      msg.includes('内容为空') || msg.startsWith('未知工具') ||
      msg.includes('未绑定飞书') || msg.includes('需要整数') ||
      msg.includes('范围') || msg.includes('未知 patrol_config key') ||
      msg.includes('合法值：')) {
    return { category: 'invalid_input', retryable: true };
  }

  // 文件系统
  if (code === 'ENOENT' || code === 'EACCES' || code === 'EISDIR' || code === 'EPERM') {
    return { category: 'fs', retryable: false };
  }

  // HTTP
  if (HTTP_TOOL_NAMES.has(toolName) ||
      msg.includes('fetch failed') || msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') || msg.includes('socket hang up') ||
      msg.includes('network')) {
    return { category: 'http', retryable: true };
  }

  return { category: 'unknown', retryable: false };
}

export async function executeTool(name, input = {}, context = {}) {
  try {
    return await runToolInternal(name, input, context);
  } catch (err) {
    const { category, retryable, suggestion } = classifyError(err, name);
    const msg = err?.message || String(err);
    if (category === 'unknown') {
      console.error(`[Bot/Tool] ${name} 失败 (${category}):`, msg, err?.stack);
    } else {
      console.error(`[Bot/Tool] ${name} 失败 (${category}, retryable=${retryable}):`, msg);
    }
    const error = { category, message: msg, retryable, tool: name };
    if (suggestion) error.suggestion = suggestion;
    return { ok: false, error };
  }
}

async function runToolInternal(name, input, context) {
  switch (name) {
    case 'list_plans':
      return listPlans({ type: input.type, status: input.status });

    case 'get_plan_detail':
      return getPlanDetail(input.plan_id);

    case 'get_dimensions':
      return getDimensions();

    case 'list_deskhub_skills': {
      const query = {};
      if (input.search) query.search = input.search;
      if (input.limit) query.limit = String(input.limit);
      return listDeskhubSkills(query, { signal: context?.signal });
    }

    case 'get_deskhub_skill':
      return getDeskhubSkill(input.slug, { signal: context?.signal });

    case 'get_umami_stats':
      return getUmamiStats(input.start_at, input.end_at);

    case 'get_umami_active':
      return getUmamiActive();

    case 'list_users':
      return listUsers();

    case 'get_recent_changes':
      return getRecentChanges(input.limit || 20);

    case 'send_notification': {
      const { target_username, message } = input;
      console.log(`[Bot/Tool] send_notification 被调用: target=${target_username}, message=${message?.slice(0, 80)}`);
      if (!target_username || !message) {
        return { sent: false, reason: 'target_username 和 message 必填' };
      }

      // 校验目标用户存在且有飞书绑定
      const user = db.prepare(
        "SELECT username, feishu_open_id, display_name FROM users WHERE username = ?"
      ).get(target_username);

      if (!user) {
        return { sent: false, reason: `用户 ${target_username} 不存在` };
      }
      if (!user.feishu_open_id) {
        return { sent: false, reason: `用户 ${target_username} 未绑定飞书` };
      }

      // 发送个性化通知卡片
      const card = buildPersonalCard(message);
      await createAndSendCard(user.feishu_open_id, 'open_id', card);

      return { sent: true, target: target_username, displayName: user.display_name };
    }

    // ========================================================
    //  代笔写入（proxy_*）
    // ========================================================
    case 'proxy_create_plan': {
      const user = assertAbility(context, 'plan.write');
      const plan = createPlan({
        name: input.name, type: input.type,
        priority: input.priority || 'medium',
        desc: input.desc || '', owner: input.owner || user.username,
        deadline: input.deadline || '', related_skill: input.related_skill || '',
        authorType: 'ai',
        proxyAuthorId: user.username,
        proxyMetadata: buildProxyMetadata(),
      });
      return { ok: true, plan_id: plan.id, authorType: 'ai', proxy_author_id: user.username,
        note: `工单已创建（小合代${user.username}创建，author_type=ai）` };
    }

    case 'proxy_edit_plan': {
      const user = assertAbility(context, 'plan.write');
      const { plan_id, ...fields } = input;
      editPlan(plan_id, fields);
      return { ok: true, plan_id, note: `工单已更新（小合代${user.username}编辑）` };
    }

    case 'proxy_add_variant': {
      const user = assertAbility(context, 'variant.write');
      const v = addVariant(input.plan_id, {
        name: input.name,
        uploader: user.username,
        desc: input.desc || '',
        link: input.link || '',
        content: input.content ?? null,
        authorType: 'ai',
        proxyAuthorId: user.username,
        proxyMetadata: buildProxyMetadata(),
      });
      return { ok: true, variant_id: v.id, authorType: 'ai',
        note: `方案「${input.name}」已添加到工单 ${input.plan_id}（小合代${user.username}代笔）` };
    }

    case 'proxy_edit_variant': {
      const user = assertAbility(context, 'variant.write');
      // 校验：仅能改自己代笔的
      const detail = db.prepare('SELECT author_type, proxy_author_id, uploader FROM variants WHERE id = ?').get(input.variant_id);
      if (!detail) throw new Error('方案不存在');
      if (detail.author_type !== 'ai' || detail.proxy_author_id !== user.username) {
        throw new Error('只能编辑自己代笔过的方案（author_type=ai 且 proxy_author_id=你）');
      }
      const { variant_id, ...fields } = input;
      editVariant(variant_id, fields);
      return { ok: true, variant_id, note: '方案已更新' };
    }

    case 'proxy_delete_variant': {
      const user = assertAbility(context, 'variant.write');
      const detail = db.prepare('SELECT author_type, proxy_author_id FROM variants WHERE id = ?').get(input.variant_id);
      if (!detail) throw new Error('方案不存在');
      if (detail.author_type !== 'ai' || detail.proxy_author_id !== user.username) {
        throw new Error('只能删除自己代笔过的方案');
      }
      deleteVariant(input.variant_id);
      return { ok: true, variant_id: input.variant_id, note: '方案已删除' };
    }

    case 'proxy_submit_scores': {
      const user = assertAbility(context, 'score.write');
      const result = submitScores(input.variant_id, {
        tester: user.username,
        scores: input.scores,
        evalDoc: input.evalDoc,
        authorType: 'ai',
        proxyAuthorId: user.username,
        proxyMetadata: buildProxyMetadata(),
      });
      return { ok: true, variant_id: input.variant_id, count: result?.length || input.scores.length,
        authorType: 'ai',
        note: `已提交 ${input.scores.length} 项评分（小合代${user.username}打分）` };
    }

    case 'proxy_edit_score': {
      const user = assertAbility(context, 'score.write');
      const detail = db.prepare('SELECT author_type, proxy_author_id FROM scores WHERE id = ?').get(input.score_id);
      if (!detail) throw new Error('评分不存在');
      if (detail.author_type !== 'ai' || detail.proxy_author_id !== user.username) {
        throw new Error('只能编辑自己代笔过的评分');
      }
      const { score_id, ...fields } = input;
      editScore(score_id, fields);
      return { ok: true, score_id, note: '评分已更新' };
    }

    case 'proxy_delete_score': {
      const user = assertAbility(context, 'score.write');
      const detail = db.prepare('SELECT author_type, proxy_author_id FROM scores WHERE id = ?').get(input.score_id);
      if (!detail) throw new Error('评分不存在');
      if (detail.author_type !== 'ai' || detail.proxy_author_id !== user.username) {
        throw new Error('只能删除自己代笔过的评分');
      }
      deleteScore(input.score_id);
      return { ok: true, score_id: input.score_id, note: '评分已删除' };
    }

    // ========================================================
    //  记忆工具
    // ========================================================
    case 'update_memory_section': {
      assertAbility(context, 'memory.self');
      const openId = context?.chatContext?.openId;
      if (!openId) throw new Error('记忆工具需要当前对话 open_id');
      const boundUser = context?.boundUser || null;
      const loaded = await loadUserMemory(openId, boundUser);
      const updated = upsertSection(loaded.content, {
        section: input.section,
        body: input.content,
        segment: input.segment || 'public',
      });
      const sz = checkSizeLimit(updated);
      if (sz.overHard) {
        return { ok: false, error: {
          category: 'invalid_input',
          message: `记忆超过硬上限 ${MEMORY_SIZE_HARD_LIMIT} 字节（当前 ${sz.sizeBytes}），请先调 forget_memory_section 删点再写`,
          retryable: false, tool: name,
        } };
      }
      const saved = await saveUserMemory(openId, boundUser, updated);
      return {
        ok: true, section: input.section, segment: input.segment || 'public',
        sizeBytes: saved.sizeBytes, overSoft: saved.overSoft,
        note: saved.overSoft
          ? `已更新段落「${input.section}」（${input.segment||'public'}），**记忆超软上限 ${MEMORY_SIZE_SOFT_LIMIT} 字节，下次写入前建议先整理冗余**`
          : `已更新段落「${input.section}」（${input.segment||'public'}）`,
      };
    }

    case 'append_memory_note': {
      assertAbility(context, 'memory.self');
      const openId = context?.chatContext?.openId;
      if (!openId) throw new Error('记忆工具需要当前对话 open_id');
      const boundUser = context?.boundUser || null;
      const loaded = await loadUserMemory(openId, boundUser);
      const updated = appendNote(loaded.content, {
        note: input.note,
        segment: input.segment || 'public',
      });
      const sz = checkSizeLimit(updated);
      if (sz.overHard) {
        return { ok: false, error: {
          category: 'invalid_input',
          message: `记忆超过硬上限 ${MEMORY_SIZE_HARD_LIMIT} 字节，请先清理`,
          retryable: false, tool: name,
        } };
      }
      const saved = await saveUserMemory(openId, boundUser, updated);
      return { ok: true, segment: input.segment || 'public', sizeBytes: saved.sizeBytes,
        note: `已追加笔记到「${input.segment || 'public'}」段` };
    }

    case 'forget_memory_section': {
      assertAbility(context, 'memory.self');
      const openId = context?.chatContext?.openId;
      if (!openId) throw new Error('记忆工具需要当前对话 open_id');
      const boundUser = context?.boundUser || null;
      const loaded = await loadUserMemory(openId, boundUser);
      const updated = removeSection(loaded.content, { section: input.section });
      const saved = await saveUserMemory(openId, boundUser, updated);
      return { ok: true, section: input.section, sizeBytes: saved.sizeBytes,
        note: `已忘记「${input.section}」段落` };
    }

    // ========================================================
    //  系统健康检查
    // ========================================================
    case 'get_system_health': {
      assertAbility(context, 'system.health');
      const mem = process.memoryUsage();
      const mb = (n) => Math.round(n / 1024 / 1024 * 10) / 10;
      const cpu = process.cpuUsage();

      const planStats = db.prepare(`
        SELECT status, COUNT(*) AS c FROM plans GROUP BY status
      `).all();
      const planCount = { total: 0, next: 0, active: 0, done: 0 };
      for (const { status, c } of planStats) {
        planCount[status] = c;
        planCount.total += c;
      }

      const changes24h = db.prepare(`
        SELECT COUNT(*) AS c FROM change_log WHERE datetime(created_at) >= datetime('now', '-1 day')
      `).get().c;

      return {
        node: {
          uptimeSeconds: Math.round(process.uptime()),
          memoryMB: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed), heapTotal: mb(mem.heapTotal), external: mb(mem.external) },
          cpuUserMs: Math.round(cpu.user / 1000),
          cpuSystemMs: Math.round(cpu.system / 1000),
          nodeVersion: process.version,
        },
        workbench: {
          planCount,
          changesLast24h: changes24h,
          activeSessions: getActiveSessionCount(),
        },
        concurrency: getConcurrencyMetrics(),
        now: beijingNowLine(),
      };
    }

    // ========================================================
    //  维度代笔
    // ========================================================
    case 'proxy_add_dimension': {
      const user = assertAbility(context, 'dimension.crud');
      const dim = createDimension({ name: input.name, max: input.max ?? 10 });
      return { ok: true, dimension: dim,
        note: `维度「${dim.name}」已创建（id=${dim.id}，满分=${dim.max}，by ${user?.username}）` };
    }

    case 'proxy_edit_dimension': {
      const user = assertAbility(context, 'dimension.crud');
      const { dimension_id, ...fields } = input;
      editDimension(dimension_id, fields);
      return { ok: true, dimension_id,
        note: `维度 ${dimension_id} 已更新（by ${user?.username}）` };
    }

    case 'proxy_delete_dimension': {
      const user = assertAbility(context, 'dimension.crud');
      deleteDimension(input.dimension_id);
      return { ok: true, dimension_id: input.dimension_id,
        note: `维度 ${input.dimension_id} 已停用（软删除，历史评分保留；by ${user?.username}）` };
    }

    // ========================================================
    //  巡检配置工具
    // ========================================================
    case 'get_patrol_config': {
      assertAbility(context, 'patrol.config');
      const cfg = getPatrolConfig();
      return {
        ...cfg,
        _schema: Object.fromEntries(
          Object.entries(PATROL_CONFIG_SCHEMA).map(([k, s]) => [k, { type: s.type, range: s.range, label: s.label }])
        ),
        _note: 'flush_ms 改后需 pm2 restart 才生效；其他热生效',
      };
    }

    case 'update_patrol_config': {
      const user = assertAbility(context, 'patrol.config');
      const { key, value } = input;
      const result = setPatrolConfig(key, value);
      const hotReload = ['patrol_hour', 'patrol_enabled', 'deadline_alert_days', 'notify_chat_ids'].includes(key);
      return {
        ok: true, key, old: result.old, new: result.new,
        hotReload,
        note: `${PATROL_CONFIG_SCHEMA[key]?.label || key} 已改为 ${result.new}（by ${user?.username}）${hotReload ? '，立即生效' : '，需要 pm2 restart 生效'}`,
      };
    }

    // ========================================================
    //  权限管理工具
    // ========================================================
    case 'grant_user_ability': {
      const user = assertAbility(context, 'permissions.manage');
      const { target_username, ability } = input;
      if (!ABILITIES[ability]) {
        throw new Error(`未定义的 ability "${ability}"，合法值：${ABILITY_NAMES.join(', ')}`);
      }
      const target = db.prepare('SELECT username FROM users WHERE username = ?').get(target_username);
      if (!target) throw new Error(`目标用户 ${target_username} 不存在`);
      // 越权校验：自己都没有的 ability 不能 grant 别人（admin 由 fallback 覆盖所有，不受影响）
      if (!checkAbility(context, ability)) {
        throw new Error(`无权授予你自己都没有的 ability "${ability}"`);
      }
      grantPermission(target_username, ability, user?.username || '');
      return { ok: true, target_username, ability,
        note: `已给 ${target_username} 授权 "${ability}"（by ${user?.username}）` };
    }

    case 'revoke_user_ability': {
      const user = assertAbility(context, 'permissions.manage');
      const { target_username, ability } = input;
      if (!ABILITIES[ability]) {
        throw new Error(`未定义的 ability "${ability}"`);
      }
      const removed = revokePermission(target_username, ability);
      return { ok: true, target_username, ability, removed,
        note: removed
          ? `已撤销 ${target_username} 的 "${ability}"（角色 fallback 仍可能生效）`
          : `${target_username} 没有显式授权 "${ability}"，无需撤销` };
    }

    case 'list_user_abilities': {
      assertAbility(context, 'permissions.manage');
      if (input.target_username) {
        const grants = listUserPermissions(input.target_username);
        return { target_username: input.target_username, grants,
          note: `仅显式授权记录；角色 fallback 不显示在这里` };
      }
      const all = listAllPermissionGrants();
      return { total: all.length, grants: all };
    }

    case 'get_deskhub_skill_file': {
      const { slug, path } = input;
      if (!slug || !path) throw new Error('slug 和 path 必填');
      const result = await fetchDeskhubFile(slug, path, { signal: context?.signal });
      return {
        slug, path,
        filename: result.filename,
        content: result.content,
        size: result.content.length,
      };
    }

    case 'send_file_to_user': {
      const user = context?.boundUser;
      const openId = context?.chatContext?.openId;
      if (!openId) {
        throw new Error('send_file_to_user 需要当前对话 open_id，未找到（请在私聊里试）');
      }
      const { filename, content } = input;
      if (!filename || content === undefined) {
        throw new Error('filename 和 content 必填');
      }
      const buf = Buffer.from(String(content), 'utf8');
      if (buf.length === 0) throw new Error('文件内容为空');
      if (buf.length > 30 * 1024 * 1024) throw new Error('文件超 30MB（飞书上限）');

      // 判断 file_type：按后缀取最相近的飞书枚举
      const ext = filename.toLowerCase().split('.').pop();
      const typeMap = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', ppt: 'ppt', pptx: 'ppt' };
      const fileType = typeMap[ext] || 'stream';

      const fileKey = await uploadFileToFeishu(buf, filename, fileType);
      const messageId = await sendFileMessage(openId, 'open_id', fileKey);
      console.log(`[Bot/Tool] send_file_to_user 发送成功: filename=${filename} size=${buf.length} messageId=${messageId}`);
      return {
        ok: true, filename, size: buf.length,
        sent_to: user?.username || openId,
        note: `已发送「${filename}」（${(buf.length / 1024).toFixed(1)}KB）`,
      };
    }

    case 'proxy_upload_file': {
      const user = assertAbility(context, 'variant.write');
      const { writeFileSync, mkdirSync } = await import('fs');
      const { dirname, join } = await import('path');
      const { fileURLToPath } = await import('url');
      const crypto = await import('crypto');

      const here = dirname(fileURLToPath(import.meta.url));
      const UPLOAD_DIR = process.env.UPLOAD_DIR || join(here, '..', 'uploads');
      const EVAL_DIR = join(UPLOAD_DIR, 'eval');
      mkdirSync(EVAL_DIR, { recursive: true });

      const safeName = (input.filename || 'note.md').replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 128);
      const diskName = `${crypto.randomUUID().slice(0, 8)}-${safeName}`;
      const diskPath = join(EVAL_DIR, diskName);
      const buf = Buffer.from(input.content || '', 'utf8');
      if (buf.length === 0) throw new Error('文件内容为空');
      if (buf.length > 10 * 1024 * 1024) throw new Error('文件超过 10MB');
      writeFileSync(diskPath, buf);

      const merged = appendVariantFiles(input.variant_id, [{
        path: `uploads/eval/${diskName}`,
        originalName: input.filename,
        size: buf.length,
      }]);
      return { ok: true, variant_id: input.variant_id, filename: input.filename,
        note: `文件已上传到方案 ${input.variant_id}，当前该方案共 ${merged.length} 个附件（小合代${user.username}上传）` };
    }

    default:
      throw new Error(`未知工具: ${name}`);
  }
}
