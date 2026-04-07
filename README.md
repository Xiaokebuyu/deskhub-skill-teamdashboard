# DeskSkill TeamBoard

内部团队看板，用于追踪 DeskHub 技能迭代、管理多方案评测工单、监控 MCP 工具运行状态。中文界面，面向组长（admin）、测试（tester）、成员（member）三种角色。

## 快速开始

```bash
# 前端
cd dev
npm install
npm run dev          # http://localhost:5173

# 后端（可选，提供持久化和外部 API 代理）
cd dev/server
npm install
npm run dev          # http://localhost:3001
```

前端通过 `VITE_USE_API` 环境变量切换数据源——设为 `true`（默认）走后端 API，设为 `false` 使用内置 mock 数据独立运行。

## 技术栈

| 层 | 选型 |
|----|------|
| 前端框架 | React 19 + Vite 6（JSX，无 TypeScript） |
| 图标 | lucide-react |
| 图表 | Recharts |
| Markdown | react-markdown |
| 样式 | 纯内联 style，无 CSS 框架 |
| 后端 | Express 5 + better-sqlite3 |
| 文件上传 | multer |
| 部署 | Cloudflare Pages（`wrangler pages deploy`） |

## 项目结构

```
dev/
├── index.html
├── package.json
├── vite.config.js            # React 插件 + /api → localhost:3001 代理
├── .env.development          # VITE_USE_API=true
├── .env.production           # VITE_USE_API=true, VITE_API_BASE=
│
├── src/
│   ├── main.jsx              # createRoot 入口
│   ├── App.jsx               # 全局状态：tab / role / plans / dims
│   │
│   ├── components/
│   │   ├── cards/            # BaseCard, DeskRowShell, HandOverlay
│   │   ├── layout/           # Sidebar（导航 + 角色切换 + 维度设置入口）
│   │   └── ui/               # 共享基础组件
│   │       ├── DetailModal   # 第二层弹窗
│   │       ├── FullPanel     # 第三层全屏面板（Container Transform）
│   │       ├── ChartCarousel # 图表轮播
│   │       ├── BrowsePage    # 浏览网格
│   │       ├── Form          # FormModal / FInput / FSelect / FBtn
│   │       ├── Skeleton      # DashboardSkeleton / McpSkeleton / ErrorRetry
│   │       └── ...           # DataCard, MiniBar, StarRate, Stat, Accordion, ToggleSwitch
│   │
│   ├── constants/
│   │   ├── mock-data.js      # SKILLS(21) / MCPS(6) / INIT_PLANS(8) / INIT_DIMS(3)
│   │   ├── theme.js          # 设计 token：CARD / MODAL / DESK / PANEL / BROWSE / FONT
│   │   ├── status.js         # 技能状态 ST / MCP_ST / 工单 PLAN_ST / PLAN_PHASE / PLAN_RESULT
│   │   ├── tabs.js           # 三个主导航 tab
│   │   ├── roles.js          # admin / tester / member
│   │   └── priority.js       # high / medium / low
│   │
│   ├── hooks/
│   │   └── useDeskRow.js     # 卡牌布局：扇形/堆叠、聚焦动画状态机
│   │
│   ├── pages/
│   │   ├── Dashboard/        # 技能总览
│   │   │   ├── index.jsx     # 统计 + 图表 + 排名 DeskRow + 浏览/详情
│   │   │   ├── skillRank.js  # 按人气 / 活跃度加权排序
│   │   │   └── charts/       # TrendChart / DownloadRank / SceneDistribution / HotSearch
│   │   ├── MCP/              # MCP 总览（导出为 SpellBook）
│   │   │   ├── index.jsx     # 健康 + 工具列表 + DeskRow + 浏览/详情
│   │   │   └── charts/       # CallTrend / SuccessRate / DependencyMap
│   │   └── WorkBench/        # 工作台
│   │       ├── index.jsx     # 工单管理主视图
│   │       ├── useWorkOrders.js  # 工单/方案/评分 CRUD hook
│   │       ├── WoCard.jsx    # 工单卡片
│   │       ├── WoDeskRow.jsx # 工单行（含详情弹窗）
│   │       ├── WoSection.jsx # 工单分组区域
│   │       ├── WoBrowse.jsx  # 工单浏览页
│   │       ├── WoFullPanel.jsx   # 第三层全屏详情 + 角色按钮
│   │       ├── ComparisonTable.jsx # 多维度评分对比表
│   │       ├── ScorePanel.jsx     # 测试评分面板
│   │       └── DocReader.jsx      # Markdown 文档阅读器
│   │
│   ├── services/             # API 层
│   │   ├── api.js            # 基础 get() 封装
│   │   ├── skillService.js   # DeskHub 技能接口
│   │   ├── umamiService.js   # Umami 统计接口
│   │   ├── mcpService.js     # MCP 工具接口
│   │   └── workService.js    # 工单/方案/评分/维度 CRUD
│   │
│   └── utils/
│       └── helpers.js        # ID 生成、日期格式化、getPhase()、avgScore()
│
└── server/                   # Express 后端
    ├── package.json
    ├── index.js              # 路由挂载 + 健康检查（:3001）
    ├── .env                  # 服务端环境变量
    ├── db/
    │   └── init.js           # SQLite 建表 + 迁移 + 种子数据
    ├── middleware/
    │   └── cache.js          # 缓存中间件
    ├── routes/
    │   ├── proxy.js          # /api/proxy/deskhub → DeskHub API
    │   ├── umami.js          # /api/proxy/umami → Umami API
    │   ├── mcp.js            # /api/proxy/mcp → 本地 MCP 端点
    │   └── workbench.js      # /api/plans, /api/variants, /api/scores, /api/dimensions
    └── utils/
        └── meta.js
```

## 三个页面

| Tab | 页面 | 功能 | 数据来源 |
|-----|------|------|----------|
| 技能总览 | Dashboard | DeskHub 技能运营数据看板 | DeskHub API + Umami（经后端代理） |
| MCP 总览 | SpellBook | MCP 工具调用/健康监控 | DeskClaw MCP（经后端代理） |
| 工作台 | WorkBench | 团队协作：工单、方案、评分 | 自有 SQLite 后端 |

技能总览和 MCP 总览是**外部数据只读看板**，工作台是**内部协作工作台**。

## 核心数据模型

```
Plan（工单）
  status:  next → active → done
  type:    skill | mcp
  result:  adopted | shelved（done 时设置）

  └── Variant（方案）× N
        └── Score（评分）× N
              tester / dimId / value / comment / evalDoc

  └── 自动检测阶段（active 时）：
        collecting（0 方案）→ evaluating（部分评分）→ finalizing（全部评完）
```

数据库 Schema（SQLite）：

| 表 | 说明 |
|----|------|
| `plans` | 工单主表（id, name, type, status, priority, owner, deadline, result...） |
| `variants` | 方案表，外键关联 plan |
| `scores` | 评分表，外键关联 variant |
| `dimensions` | 评分维度（默认 3 项：功能完整性、稳定性、用户体验，各 10 分制） |

## 三层卡片交互

```
第一层：DeskRow 卡牌行 → "哪个需要关注"（扫一眼）
  点击展开手牌，点击卡片触发飞入聚焦动画

第二层：DetailModal 弹窗 → "整体情况如何"（概览）
  展示摘要信息，工单显示方案按 avgScore 排名

第三层：FullPanel 全屏面板 → "具体差在哪"（决策）
  ComparisonTable 多维评分对比 + 角色专属操作按钮
```

## 角色权限

每个角色在 FullPanel 中只看到**一个主操作按钮**：

| 状态 | Admin | Tester | Member |
|------|-------|--------|--------|
| next | 激活工单 | — | — |
| active | 定稿 | 评测打分 | 添加方案 |
| done | 重新打开 | — | — |

## 开发命令

```bash
npm run dev       # 启动 Vite 开发服务器（:5173），自动代理 /api → :3001
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
npm run deploy    # 通过 wrangler 部署到 Cloudflare Pages
```

后端：

```bash
cd server
npm run dev       # node --watch 热重载（:3001）
npm start         # 生产启动
```

## 后端详细说明

### 环境变量

后端配置统一放在 `server/.env`，首次部署时按以下模板创建：

```env
PORT=3001
DESKHUB_BASE=https://skills.deskclaw.me
UMAMI_BASE=https://umami.deskclaw.me
UMAMI_WEBSITE_ID=149fb71c-b439-4594-88fc-b222b169780e
UMAMI_USERNAME=zixuan.ni@nodeskai.com
UMAMI_PASSWORD=M8nh3RJmXr2Y439
MCP_ENDPOINT=http://127.0.0.1:18790/deskclaw/mcp
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端监听端口 | `3001` |
| `DESKHUB_BASE` | DeskHub API 根地址 | `https://skills.deskclaw.me` |
| `UMAMI_BASE` | Umami 统计服务地址 | `https://umami.deskclaw.me` |
| `UMAMI_WEBSITE_ID` | Umami 中对应站点的 ID | — |
| `UMAMI_USERNAME` | Umami 登录账号 | — |
| `UMAMI_PASSWORD` | Umami 登录密码 | — |
| `MCP_ENDPOINT` | DeskClaw MCP JSON-RPC 端点 | `http://127.0.0.1:18790/deskclaw/mcp` |

### 数据库

- 引擎：**better-sqlite3**（WAL 模式，开启外键约束）
- 文件位置：`server/db/teamboard.db`（首次启动自动创建）
- 附带 WAL 文件：`teamboard.db-shm`、`teamboard.db-wal`（正常，勿删除）
- 初始化脚本 `server/db/init.js` 负责建表、自动迁移旧字段、种子默认维度
- 数据库文件已在 `.gitignore` 中排除，生产部署需自行备份

**四张表：**

| 表 | 字段 | 说明 |
|----|------|------|
| `plans` | id, name, type(`skill`\|`mcp`), status(`next`\|`active`\|`done`), priority, description, owner, deadline, related_skill, attachment, result, created_at, updated_at | 工单主表 |
| `variants` | id, plan_id(FK→plans), name, uploader, description, link, content(markdown), uploaded_at, updated_at | 方案表 |
| `scores` | id, variant_id(FK→variants), plan_id, tester, dim_id, value, comment, eval_doc, created_at | 评分记录 |
| `dimensions` | id, name, max(默认10), active(软删除标志), sort_order, created_at | 评分维度 |

种子数据（空库自动插入）：功能完整性、稳定性、用户体验，各 10 分制。

### 路由挂载总览

```
/api/health                    → 健康检查
/api/proxy/deskhub/*           → DeskHub API 代理
/api/proxy/umami/*             → Umami 统计代理（自动获取 token）
/api/proxy/mcp/*               → MCP JSON-RPC 代理（自动管理 session）
/api/plans, /api/variants ...  → 工作台 CRUD（SQLite）
/api/upload                    → 文件上传
/api/uploads/*                 → 上传文件静态服务
```

### DeskHub 代理（`routes/proxy.js`）

DeskHub API 公开无需认证，后端只做代理 + 缓存。

| 端点 | 方法 | 上游 | 缓存 TTL | 说明 |
|------|------|------|----------|------|
| `/api/proxy/deskhub/skills` | GET | `/api/v1/skills` | 10 分钟 | 技能列表，支持 query 透传 |
| `/api/proxy/deskhub/skills/:slug` | GET | `/api/v1/skills/:slug` | 30 分钟 | 技能详情 |
| `/api/proxy/deskhub/versions` | GET | `/api/v1/versions/recent` | 5 分钟 | 版本发布趋势 |
| `/api/proxy/deskhub/cache/clear` | POST | — | — | 手动清除所有缓存 |

### Umami 代理（`routes/umami.js`）

Umami 需要登录获取 Bearer Token，后端自动管理 token 生命周期。

**Token 获取流程：**

1. 后端启动后首次请求时，自动用 `.env` 中的 `UMAMI_USERNAME` / `UMAMI_PASSWORD` 调用 `POST {UMAMI_BASE}/api/auth/login`
2. 返回的 `token` 缓存在内存中，有效期设为 **23 小时**
3. 若请求返回 401，自动重新登录获取新 token 并重试
4. 前端无需关心 token，所有请求经后端代理自动附加 `Authorization: Bearer <token>`

**Umami 数据起始日期：** `2026-03-29`，查询参数 `startAt` 会自动截断到此日期。

| 端点 | 方法 | 上游 | 缓存 TTL | 参数 |
|------|------|------|----------|------|
| `/api/proxy/umami/stats` | GET | `/stats` | 10 分钟 | `startAt`, `endAt`（毫秒时间戳） |
| `/api/proxy/umami/pageviews` | GET | `/pageviews` | 10 分钟 | `startAt`, `endAt`, `unit`(默认`day`) |
| `/api/proxy/umami/metrics` | GET | `/metrics` | 10 分钟 | `type`, `startAt`, `endAt` |
| `/api/proxy/umami/event-data` | GET | `/event-data/fields` | 10 分钟 | `startAt`, `endAt` |
| `/api/proxy/umami/active` | GET | `/active` | 不缓存 | — |

### MCP 代理（`routes/mcp.js`）

MCP 使用 **JSON-RPC 2.0** 协议 + **SSE** 响应格式，后端自动管理 session。

**Session 管理流程：**

1. 首次请求时调用 `initialize` 方法，协议版本 `2025-03-26`
2. 从响应头 `Mcp-Session-Id` 获取 session ID，后续请求均携带
3. 若请求返回 400，视为 session 过期，自动重新初始化

**SSE 响应解析：** 上游返回 `text/event-stream` 格式，后端提取 `data: {...}` 行解析 JSON。

| 端点 | 方法 | 上游 RPC 方法 | 缓存 TTL | 说明 |
|------|------|---------------|----------|------|
| `/api/proxy/mcp/tools` | GET | `tools/list` | 30 分钟 | 工具列表（转换为前端友好格式） |
| `/api/proxy/mcp/health` | GET | `tools/call` → `get_health` | 不缓存 | MCP 健康状态 |
| `/api/proxy/mcp/servers` | GET | `tools/call` → `mcp_server_list` | 10 分钟 | 已注册 MCP 服务器列表 |
| `/api/proxy/mcp/info` | GET | `initialize`（重新握手） | 30 分钟 | 服务器名称、版本、capabilities |

> MCP 端点默认为 `http://127.0.0.1:18790/deskclaw/mcp`，需要 DeskClaw 在本机或内网可达。生产部署时在 `.env` 中修改 `MCP_ENDPOINT` 指向实际地址。

### 工作台 CRUD（`routes/workbench.js`）

所有写操作通过 `X-Role` 请求头传递角色（`admin` / `tester` / `member`），后端用 `requireRole()` 中间件校验。

**工单（Plans）**

| 端点 | 方法 | 角色 | 说明 |
|------|------|------|------|
| `/api/plans` | GET | 任意 | 列表（含嵌套 variants + scores），支持 `?type=&status=` 过滤 |
| `/api/plans` | POST | admin | 新建工单 |
| `/api/plans/:id` | PUT | admin | 编辑工单（name, priority, desc, owner, deadline...） |
| `/api/plans/:id/status` | PATCH | admin | 状态变更（next→active, active→done, done→active） |
| `/api/plans/:id` | DELETE | admin | 删除工单（级联删除方案和评分） |

**方案（Variants）**

| 端点 | 方法 | 角色 | 说明 |
|------|------|------|------|
| `/api/plans/:planId/variants` | POST | admin/tester/member | 添加方案 |
| `/api/variants/:id` | PUT | admin/tester/member | 编辑方案 |
| `/api/variants/:id` | DELETE | admin | 删除方案（级联删除评分） |

**评分（Scores）**

| 端点 | 方法 | 角色 | 说明 |
|------|------|------|------|
| `/api/variants/:variantId/scores` | POST | admin/tester | 批量提交评分，自动校验维度上限 |

请求体示例：

```json
{
  "tester": "张三",
  "evalDoc": "uploads/eval/abc123",
  "scores": [
    { "dim_id": "d1", "value": 8, "comment": "功能基本完整" },
    { "dim_id": "d2", "value": 7, "comment": "" }
  ]
}
```

**维度（Dimensions）**

| 端点 | 方法 | 角色 | 说明 |
|------|------|------|------|
| `/api/dimensions` | GET | 任意 | 维度列表 |
| `/api/dimensions` | POST | admin | 新增维度 |
| `/api/dimensions/:id` | PUT | admin | 编辑维度（name, max, active） |
| `/api/dimensions/:id` | DELETE | admin | 软删除（设 active=0） |

**文件上传**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 单文件上传（multipart/form-data，字段名 `file`，限 10MB） |
| `/api/uploads/*` | GET | 已上传文件的静态访问 |

上传文件存储在 `server/uploads/eval/`，该目录已在 `.gitignore` 中排除。

### 缓存机制

后端使用**内存 Map 缓存**（`middleware/cache.js`），无需 Redis。

- 每个缓存条目带 TTL（秒），过期自动失效
- 所有代理路由返回统一格式 `{ data, meta: { source, cached, ttl, fetchedAt } }`
- 可通过 `POST /api/proxy/deskhub/cache/clear` 手动清除全部缓存
- 进程重启自动清空

### 统一响应格式

所有接口返回：

```json
{
  "data": { ... },
  "meta": {
    "source": "deskhub | umami | mcp | local",
    "fetchedAt": "2026-04-07T12:00:00.000Z",
    "cached": false,
    "ttl": 580,
    "window": { "start": "2026-03-29", "end": "2026-04-07" }
  }
}
```

### 生产部署检查清单

1. **创建 `server/.env`** — 填入上文环境变量（尤其是 Umami 账号密码和 MCP 端点）
2. **安装后端依赖** — `cd server && npm install`（需要编译 better-sqlite3 native 模块）
3. **启动后端** — `npm start` 或用 pm2/systemd 守护
4. **确认数据库** — 首次启动自动在 `server/db/teamboard.db` 创建数据库并建表
5. **确认 MCP 可达** — `MCP_ENDPOINT` 对应的 DeskClaw 服务需在同机或内网
6. **构建前端** — `npm run build`，产物在 `dist/`
7. **部署前端** — `npm run deploy`（Cloudflare Pages）或将 `dist/` 放到任意静态服务器
8. **生产环境代理** — 如前后端不同域，需配置反向代理将 `/api` 转发到后端端口

## 设计规范

- 纯内联样式，设计 token 集中在 `constants/theme.js`
- 动画采用 `mounted` / `visible` 双状态 + `requestAnimationFrame` 双帧模式
- 字体：`FONT_MONO`（代码/数字）、`FONT_SANS`（正文）
- 阴影分层：`CARD` → `MODAL` → `PANEL` 三级递进
