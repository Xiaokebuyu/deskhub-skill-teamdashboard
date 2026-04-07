export const SKILLS = [
  { name: "PPT 生成", slug: "ppt-gen", status: "iterating", ver: "v1.2.0", cat: "skill", source: "官方", iters: 12, updated: "04-03", dl: 234, views: 1820, desc: "基于模板的智能PPT生成，支持多种风格切换。",
    successRate: 94.2, avgResponseTime: 3.8, userRating: 4.1, weeklyActiveUsers: 186, searchHits: 342,
    dlTrend: [18, 22, 35, 28, 41, 45, 38],
    changelog: [
      { ver: "v1.2.0", date: "04-03", summary: "新增 16:9 宽屏模板，优化图表自动布局" },
      { ver: "v1.1.2", date: "03-28", summary: "修复中文字体渲染偏移" },
      { ver: "v1.1.0", date: "03-20", summary: "支持 Markdown 直接导入生成幻灯片" },
    ],
    relatedPlanId: "p1",
  },
  { name: "邮件撰写", slug: "email-writer", status: "iterating", ver: "v0.6.1", cat: "skill", source: "官方", iters: 6, updated: "04-01", dl: 312, views: 1560, desc: "商务邮件智能撰写与润色。",
    successRate: 97.8, avgResponseTime: 1.2, userRating: 4.5, weeklyActiveUsers: 245, searchHits: 154,
    dlTrend: [40, 38, 52, 44, 48, 42, 50],
    changelog: [
      { ver: "v0.6.1", date: "04-01", summary: "修复多段落排版丢失格式" },
      { ver: "v0.6.0", date: "03-25", summary: "新增英文商务邮件模板" },
    ],
  },
  { name: "图片生成", slug: "image-gen", status: "iterating", ver: "v0.9.3", cat: "skill", source: "社区", iters: 9, updated: "04-05", dl: 567, views: 3400, desc: "AI图片生成与编辑能力。",
    successRate: 91.5, avgResponseTime: 8.2, userRating: 4.6, weeklyActiveUsers: 312, searchHits: 198,
    dlTrend: [60, 72, 85, 78, 92, 88, 95],
    changelog: [
      { ver: "v0.9.3", date: "04-05", summary: "接入 FLUX 模型，生成质量大幅提升" },
      { ver: "v0.9.0", date: "03-30", summary: "支持图片局部重绘（inpainting）" },
      { ver: "v0.8.5", date: "03-22", summary: "新增批量生成与风格迁移" },
    ],
  },
  { name: "办公套件", slug: "office-suite", status: "testing", ver: "v0.8.0", cat: "skill", source: "官方", iters: 8, updated: "04-04", dl: 156, views: 980, desc: "一站式办公文档处理。",
    successRate: 88.3, avgResponseTime: 2.1, userRating: 3.8, weeklyActiveUsers: 98, searchHits: 86,
    dlTrend: [15, 18, 22, 20, 25, 28, 24],
    changelog: [
      { ver: "v0.8.0", date: "04-04", summary: "统一文件入口，支持格式自动识别" },
      { ver: "v0.7.0", date: "03-28", summary: "新增 PDF 水印和页面合并" },
    ],
    relatedPlanId: "p2",
  },
  { name: "智能客服", slug: "smart-cs", status: "testing", ver: "v0.5.2", cat: "mcp", source: "第三方", iters: 5, updated: "04-02", dl: 89, views: 640, desc: "多轮对话客服机器人。",
    successRate: 82.7, avgResponseTime: 4.5, userRating: 3.5, weeklyActiveUsers: 45, searchHits: 32,
    dlTrend: [8, 12, 10, 14, 11, 16, 13],
    changelog: [
      { ver: "v0.5.2", date: "04-02", summary: "优化上下文记忆，支持 20 轮以上对话" },
    ],
  },
  { name: "视频剪辑", slug: "video-edit", status: "planned", ver: "v0.3.0", cat: "skill", source: "官方", iters: 3, updated: "03-28", dl: 67, views: 420, desc: "AI驱动的视频自动剪辑。",
    successRate: 78.5, avgResponseTime: 12.3, userRating: 3.2, weeklyActiveUsers: 28, searchHits: 56,
    dlTrend: [5, 8, 6, 10, 9, 12, 8],
    relatedPlanId: "p3",
  },
  { name: "语音转写", slug: "voice-asr", status: "planned", ver: "v0.1.0", cat: "mcp", source: "社区", iters: 1, updated: "03-25", dl: 22, views: 180, desc: "多语种语音实时转文字。",
    successRate: 85.0, avgResponseTime: 5.6, userRating: 3.0, weeklyActiveUsers: 12, searchHits: 18,
    dlTrend: [2, 3, 4, 3, 5, 4, 3],
    relatedPlanId: "p4",
  },
  { name: "数据分析", slug: "data-analysis", status: "stable", ver: "v2.1.0", cat: "skill", source: "官方", iters: 21, updated: "03-20", dl: 891, views: 4200, desc: "数据深度分析与可视化。",
    successRate: 96.8, avgResponseTime: 2.4, userRating: 4.7, weeklyActiveUsers: 378, searchHits: 132,
    dlTrend: [110, 125, 130, 118, 140, 135, 128],
    changelog: [
      { ver: "v2.1.0", date: "03-20", summary: "新增数据透视表和交叉分析" },
      { ver: "v2.0.0", date: "03-05", summary: "重构数据处理引擎，性能提升 3 倍" },
    ],
  },
  { name: "文档翻译", slug: "doc-translate", status: "stable", ver: "v1.5.0", cat: "skill", source: "第三方", iters: 15, updated: "03-15", dl: 445, views: 2100, desc: "保留格式的全文档翻译。",
    successRate: 95.2, avgResponseTime: 3.5, userRating: 4.3, weeklyActiveUsers: 156, searchHits: 289,
    dlTrend: [55, 62, 58, 70, 65, 68, 72],
  },
  { name: "代码助手", slug: "code-assist", status: "stable", ver: "v1.8.2", cat: "skill", source: "官方", iters: 18, updated: "03-22", dl: 723, views: 5100, desc: "多语言代码补全与审查。",
    dlTrend: [95, 88, 102, 96, 110, 105, 98],
    changelog: [
      { ver: "v1.8.2", date: "03-22", summary: "修复 Python 类型推断误报" },
      { ver: "v1.8.0", date: "03-10", summary: "新增 Rust 和 Go 语言支持" },
    ],
  },
  { name: "PDF解析", slug: "pdf-reader", status: "stable", ver: "v2.0.1", cat: "skill", source: "官方", iters: 20, updated: "03-18", dl: 1102, views: 5800, desc: "PDF智能提取与结构化。",
    dlTrend: [140, 155, 160, 148, 170, 165, 158],
    changelog: [
      { ver: "v2.0.1", date: "03-18", summary: "修复扫描件 OCR 表格识别错位" },
      { ver: "v2.0.0", date: "03-01", summary: "全新解析引擎，支持复杂排版 PDF" },
    ],
  },
  { name: "表格处理", slug: "xlsx-tool", status: "stable", ver: "v1.6.0", cat: "skill", source: "官方", iters: 16, updated: "03-12", dl: 678, views: 3200, desc: "Excel读写、汇总、图表生成。",
    successRate: 97.1, avgResponseTime: 1.8, userRating: 4.4, weeklyActiveUsers: 220, searchHits: 86,
    dlTrend: [85, 92, 88, 96, 100, 95, 98],
  },
  { name: "思维导图", slug: "mindmap-gen", status: "stable", ver: "v1.3.0", cat: "skill", source: "社区", iters: 13, updated: "03-10", dl: 390, views: 1900, desc: "文本转思维导图，支持多种布局。",
    successRate: 93.6, avgResponseTime: 2.8, userRating: 4.0, weeklyActiveUsers: 105, searchHits: 45,
    dlTrend: [48, 52, 55, 50, 60, 58, 62],
  },
  { name: "日程管理", slug: "calendar-mgr", status: "stable", ver: "v1.1.0", cat: "mcp", source: "第三方", iters: 11, updated: "03-08", dl: 210, views: 1100, desc: "日历事件创建与提醒。",
    successRate: 99.1, avgResponseTime: 0.6, userRating: 4.2, weeklyActiveUsers: 78, searchHits: 28,
    dlTrend: [25, 28, 32, 30, 35, 33, 31],
  },
  { name: "文字转语音", slug: "tts-basic", status: "stable", ver: "v1.4.0", cat: "mcp", source: "官方", iters: 14, updated: "03-05", dl: 520, views: 2600, desc: "多角色文字转语音合成。",
    successRate: 96.3, avgResponseTime: 2.2, userRating: 4.3, weeklyActiveUsers: 165, searchHits: 42,
    dlTrend: [65, 70, 72, 68, 78, 75, 80],
  },
  { name: "网页摘要", slug: "web-summary", status: "stable", ver: "v1.7.0", cat: "skill", source: "官方", iters: 17, updated: "03-01", dl: 830, views: 4500, desc: "网页内容智能摘要与提炼。",
    successRate: 92.4, avgResponseTime: 3.1, userRating: 4.1, weeklyActiveUsers: 290, searchHits: 97,
    dlTrend: [105, 112, 108, 118, 122, 115, 120],
  },
  { name: "图片OCR", slug: "ocr-basic", status: "stable", ver: "v2.2.0", cat: "skill", source: "社区", iters: 22, updated: "02-28", dl: 960, views: 4800, desc: "图片文字识别，支持多语种。",
    successRate: 89.7, avgResponseTime: 4.0, userRating: 4.0, weeklyActiveUsers: 335, searchHits: 118,
    dlTrend: [120, 128, 135, 130, 142, 138, 145],
  },
  { name: "周报生成", slug: "weekly-report", status: "stable", ver: "v1.1.0", cat: "skill", source: "官方", iters: 11, updated: "03-08", dl: 567, views: 3100, desc: "智能周报/日报生成助手。",
    successRate: 98.2, avgResponseTime: 1.5, userRating: 4.6, weeklyActiveUsers: 410, searchHits: 67,
    dlTrend: [72, 78, 82, 76, 88, 85, 90],
  },
  { name: "合同审查", slug: "contract-review", status: "stable", ver: "v1.0.0", cat: "skill", source: "第三方", iters: 10, updated: "03-05", dl: 234, views: 1800, desc: "合同条款智能审查与风控。",
    successRate: 90.5, avgResponseTime: 5.2, userRating: 3.9, weeklyActiveUsers: 62, searchHits: 35,
    dlTrend: [28, 32, 30, 35, 38, 34, 36],
  },
  { name: "知识库", slug: "knowledge-base", status: "stable", ver: "v2.3.0", cat: "mcp", source: "官方", iters: 23, updated: "03-25", dl: 1456, views: 7200, desc: "企业知识库管理与RAG检索。",
    successRate: 98.5, avgResponseTime: 1.1, userRating: 4.8, weeklyActiveUsers: 520, searchHits: 256,
    dlTrend: [180, 195, 210, 200, 220, 215, 205],
    changelog: [
      { ver: "v2.3.0", date: "03-25", summary: "支持多模态检索（图片+文本混合查询）" },
      { ver: "v2.2.0", date: "03-12", summary: "优化 RAG 召回精度，减少幻觉" },
    ],
  },
  { name: "文件转换", slug: "file-convert", status: "stable", ver: "v1.4.0", cat: "skill", source: "官方", iters: 14, updated: "03-02", dl: 678, views: 3800, desc: "多格式文件互转（docx/pdf/md）。",
    successRate: 99.3, avgResponseTime: 0.8, userRating: 4.5, weeklyActiveUsers: 198, searchHits: 74,
    dlTrend: [82, 90, 88, 95, 98, 92, 96],
  },
];

// 工单数据 — 统一 Skill + MCP
// status: "next" | "active" | "done"
// type: "skill" | "mcp"
// result: "adopted" | "shelved" (仅 done 时有值)
// variant.scores: [{ tester, dimId, value, comment, date, evalDoc? }]
// variant.content: markdown 文档内容（模拟 SKILL.md）
export const INIT_PLANS = [
  // === 进行中 ===
  { id: "p1", name: "PPT 生成优化", type: "skill", status: "active", priority: "high", created: "04-01", desc: "对标主流PPT方案，选择最优路径进行迭代。", result: null, variants: [
    { id: "v1", name: "NotebookLM 方案", uploader: "小东", uploaded: "04-02", desc: "基于Google NotebookLM的文档解析+幻灯片生成流程", link: "https://example.com/plan-v1", content: `# NotebookLM PPT 生成方案

## 技术路线

利用 Google NotebookLM 的文档理解能力，将用户上传的文档自动解析为结构化大纲，再通过模板引擎生成幻灯片。

## 核心流程

1. **文档上传** — 支持 PDF、Word、Markdown 格式
2. **智能解析** — NotebookLM 提取关键信息和层级结构
3. **大纲生成** — 自动划分章节，提炼要点
4. **模板匹配** — 根据内容类型选择合适的 PPT 模板
5. **幻灯片渲染** — 填充内容并生成最终 PPT 文件

## 优势

- 文档理解能力强，支持长文档
- 生成的大纲结构清晰
- 支持多种输入格式

## 限制

- 依赖 Google API，国内访问需要代理
- 生成速度较慢（平均 30-60 秒）
- 模板样式有限，自定义空间小`,
      scores: [
        { tester: "张三", dimId: "d1", value: 8, comment: "", date: "04-03" },
        { tester: "张三", dimId: "d2", value: 9, comment: "", date: "04-03" },
        { tester: "张三", dimId: "d3", value: 8, comment: "整体不错", date: "04-03" },
        { tester: "李四", dimId: "d1", value: 8, comment: "", date: "04-04" },
        { tester: "李四", dimId: "d2", value: 9, comment: "", date: "04-04", evalDoc: "NotebookLM-机械评测-李四.pdf" },
        { tester: "李四", dimId: "d3", value: 7, comment: "", date: "04-04" },
      ]},
    { id: "v2", name: "MiniMax 方案", uploader: "笑不语", uploaded: "04-02", desc: "调用MiniMax API直接生成幻灯片，稳定性不足", link: "", content: null, scores: [
      { tester: "张三", dimId: "d1", value: 6, comment: "", date: "04-03" },
      { tester: "张三", dimId: "d2", value: 4, comment: "经常超时", date: "04-03" },
      { tester: "张三", dimId: "d3", value: 5, comment: "", date: "04-03" },
    ]},
    { id: "v3", name: "Manus 方案", uploader: "小东", uploaded: "04-03", desc: "Manus Agent多步生成，质量高但速度慢", link: "", content: null, scores: [] },
    { id: "v4", name: "Accio 方案", uploader: "笑不语", uploaded: "04-03", desc: "", link: "", content: null, scores: [] },
  ]},
  { id: "p2", name: "办公套件整合", type: "skill", status: "active", priority: "medium", created: "04-02", desc: "将Word/Excel/PDF能力整合为统一入口。", result: null, variants: [
    { id: "v5", name: "分离式方案", uploader: "笑不语", uploaded: "04-03", desc: "每种格式独立 Skill，通过路由分发", link: "", content: `# 分离式办公套件方案

## 设计思路

每种文件格式（Word、Excel、PDF）作为独立 Skill 开发，通过统一路由层分发请求。

## 架构

| 组件 | 职责 |
|------|------|
| Router Skill | 识别文件类型，分发到对应处理 Skill |
| Word Skill | docx 读写、格式转换 |
| Excel Skill | xlsx 读写、公式计算、图表 |
| PDF Skill | 解析、提取、合并、水印 |

## 优势

- 各模块独立开发、独立测试
- 单个模块故障不影响其他功能
- 便于按需加载

## 劣势

- 用户需要理解路由逻辑
- 跨格式操作（如 Excel 转 PDF）需要模块间通信`,
      scores: [
        { tester: "张三", dimId: "d1", value: 7, comment: "", date: "04-04" },
        { tester: "张三", dimId: "d2", value: 8, comment: "", date: "04-04" },
        { tester: "张三", dimId: "d3", value: 6, comment: "入口分散", date: "04-04" },
      ]},
    { id: "v6", name: "一体化方案", uploader: "小东", uploaded: "04-04", desc: "单个 Skill 内部判断文件类型并处理", link: "", content: null, scores: [] },
  ]},
  { id: "p5", name: "网页爬虫能力", type: "mcp", status: "active", priority: "high", created: "04-03", desc: "新增通用网页爬虫MCP，支持动态渲染页面的数据提取。", result: null, variants: [] },

  // === 下期规划 ===
  { id: "p3", name: "视频剪辑技能", type: "skill", status: "next", priority: "high", created: "04-03", desc: "新增 AI 视频自动剪辑能力。", result: null, variants: [
    { id: "v7", name: "基于Seedance方案", uploader: "笑不语", uploaded: "04-04", desc: "使用Seedance 2.0视频生成+剪辑工作流", link: "", content: null, scores: [] },
  ]},
  { id: "p4", name: "语音转写探索", type: "mcp", status: "next", priority: "low", created: "04-04", desc: "调研多语种语音转写方案可行性。", result: null, variants: [] },
  { id: "p6", name: "日历日程管理", type: "mcp", status: "next", priority: "medium", created: "04-04", desc: "对接Google Calendar或本地日历，支持创建和查询日程。", result: null, variants: [] },

  // === 已完成 ===
  { id: "p7", name: "数据分析报告", type: "skill", status: "done", priority: "high", created: "03-15", desc: "数据深度分析与可视化报告生成。", result: "adopted", variants: [
    { id: "v8", name: "ECharts 方案", uploader: "小东", uploaded: "03-18", desc: "基于 ECharts 的交互式图表方案", link: "", content: `# ECharts 数据分析方案

## 技术选型

采用 Apache ECharts 作为图表引擎，配合数据清洗管道实现端到端的数据分析报告生成。

## 支持图表类型

- 折线图、柱状图、饼图
- 散点图、热力图
- 地理信息可视化
- 自定义组合图表

## 数据处理流程

1. 数据源接入（CSV/JSON/API）
2. 自动数据清洗与类型推断
3. 智能图表推荐
4. 交互式配置调整
5. 报告导出（PDF/PNG/HTML）`,
      scores: [
        { tester: "张三", dimId: "d1", value: 9, comment: "图表丰富", date: "03-20" },
        { tester: "张三", dimId: "d2", value: 8, comment: "", date: "03-20" },
        { tester: "张三", dimId: "d3", value: 9, comment: "", date: "03-20", evalDoc: "ECharts-自动化测试报告.pdf" },
        { tester: "李四", dimId: "d1", value: 8, comment: "", date: "03-21" },
        { tester: "李四", dimId: "d2", value: 9, comment: "", date: "03-21" },
        { tester: "李四", dimId: "d3", value: 8, comment: "", date: "03-21" },
      ]},
    { id: "v9", name: "Recharts 方案", uploader: "笑不语", uploaded: "03-19", desc: "React 生态的轻量图表库", link: "", content: null, scores: [
      { tester: "张三", dimId: "d1", value: 6, comment: "", date: "03-20" },
      { tester: "张三", dimId: "d2", value: 7, comment: "", date: "03-20" },
      { tester: "张三", dimId: "d3", value: 7, comment: "", date: "03-20" },
    ]},
  ]},
  { id: "p8", name: "旧版 OCR 升级", type: "skill", status: "done", priority: "medium", created: "03-10", desc: "升级 OCR 引擎至 Tesseract 5，提升中文识别率。", result: "shelved", variants: [
    { id: "v10", name: "Tesseract 5 方案", uploader: "小东", uploaded: "03-12", desc: "开源 OCR 引擎升级", link: "", content: null, scores: [
      { tester: "李四", dimId: "d1", value: 5, comment: "中文识别仍有偏差", date: "03-15" },
      { tester: "李四", dimId: "d2", value: 6, comment: "", date: "03-15" },
      { tester: "李四", dimId: "d3", value: 4, comment: "部署复杂", date: "03-15" },
    ]},
  ]},
];

export const MCPS = [
  { id: "m1", name: "文件读写", slug: "file-rw", status: "stable", ver: "v1.3.0", desc: "本地文件的读取、写入、追加操作", updated: "03-28", maintainer: "笑不语",
    calls: 12840, successRate: 99.2, avgResponseTime: 0.3, callTrend: [1800, 1920, 1850, 2010, 1960, 2100, 2200],
    dependSkills: ["PPT 生成", "办公套件", "文件转换", "表格处理"],
  },
  { id: "m2", name: "浏览器操作", slug: "browser-ctrl", status: "stable", ver: "v1.1.0", desc: "网页截图、表单填写、页面导航", updated: "03-25", maintainer: "小东",
    calls: 5620, successRate: 94.8, avgResponseTime: 2.8, callTrend: [750, 820, 780, 860, 810, 900, 870],
    dependSkills: ["网页摘要", "智能客服"],
  },
  { id: "m3", name: "数据库查询", slug: "db-query", status: "iterating", ver: "v0.8.0", desc: "PostgreSQL/MySQL 数据库连接与查询", updated: "04-03", maintainer: "笑不语",
    calls: 3210, successRate: 87.5, avgResponseTime: 1.5, callTrend: [380, 420, 450, 490, 460, 520, 540],
    dependSkills: ["数据分析", "周报生成"],
  },
  { id: "m4", name: "邮件发送", slug: "email-send", status: "iterating", ver: "v0.5.1", desc: "SMTP邮件发送与模板管理", updated: "04-01", maintainer: "小东",
    calls: 1890, successRate: 91.3, avgResponseTime: 3.2, callTrend: [240, 260, 280, 310, 290, 320, 340],
    dependSkills: ["邮件撰写"],
  },
  { id: "m5", name: "OCR识别", slug: "ocr", status: "planned", ver: "v0.1.0", desc: "图片文字识别，支持多语种", updated: "03-30", maintainer: "待定",
    calls: 0, successRate: 0, avgResponseTime: 0, callTrend: [0, 0, 0, 0, 0, 0, 0],
    dependSkills: [],
  },
  { id: "m6", name: "语音合成", slug: "tts", status: "planned", ver: "v0.1.0", desc: "文字转语音，多角色多语种", updated: "04-02", maintainer: "待定",
    calls: 0, successRate: 0, avgResponseTime: 0, callTrend: [0, 0, 0, 0, 0, 0, 0],
    dependSkills: [],
  },
];

// 评测维度 — 十分制
export const INIT_DIMS = [
  { id: "d1", name: "准确性", max: 10, active: true },
  { id: "d2", name: "稳定性", max: 10, active: true },
  { id: "d3", name: "用户体验", max: 10, active: true },
];
