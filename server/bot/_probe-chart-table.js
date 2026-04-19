/**
 * 飞书 CardKit v2 — chart / table 组件探测卡
 *
 * 目的：
 *   1. 验证 chart 组件的 chart_spec 字段到底接受哪种 schema（VChart 风格 vs 扁平 data）
 *   2. 验证多种图表类型（line/bar/pie/scatter）能否生效
 *   3. 验证 table 7 种 data_type 列的渲染
 *   4. 验证 table 分页（page_size）
 *   5. 验证 chart 是否支持 patchCardElement 增量更新 data（由 runner 完成，单独调）
 *
 * 渲染失败的组件会在飞书客户端显示空白 / 错误占位；成功的会画出图表或表格。
 * 发卡后截图回传，肉眼比对。
 *
 * 用法：
 *   node bot/_probe-run.js <open_id> charts         # 发 5 张 chart 探测卡
 *   node bot/_probe-run.js <open_id> tables         # 发 2 张 table 探测卡
 *   node bot/_probe-run.js <open_id> chart-patch    # 发 1 张 chart，2 秒后 patch 追加数据
 */

// ============================================================
//  Chart 探测卡（多种 schema 候选）
// ============================================================

/**
 * 候选 A：VChart native spec
 * 假设 chart_spec 是完整的 VChart 声明式 spec（type + data.values + xField/yField）
 */
export function buildChartProbeA_VChartLine() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart 探测 A — VChart spec 折线图' },
      subtitle: { tag: 'plain_text', content: '如果能画出折线，说明 VChart spec 生效' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**schema**：`{ tag: "chart", chart_spec: { type, data: { values }, xField, yField } }`' },
        {
          tag: 'chart',
          aspect_ratio: '4:3',
          chart_spec: {
            type: 'line',
            data: {
              values: [
                { time: '周一', downloads: 120 },
                { time: '周二', downloads: 145 },
                { time: '周三', downloads: 89 },
                { time: '周四', downloads: 167 },
                { time: '周五', downloads: 201 },
              ],
            },
            xField: 'time',
            yField: 'downloads',
          },
        },
        { tag: 'markdown', content: '**数据**：5 个数据点，周一到周五' },
      ],
    },
  };
}

/**
 * 候选 B：扁平 data 数组（不包 values）
 * 假设 chart_spec.data 直接是数据点数组
 */
export function buildChartProbeB_FlatData() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart 探测 B — 扁平 data 数组' },
      subtitle: { tag: 'plain_text', content: '如果能画出图，说明 data: [...] 不用包 values' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**schema**：`{ tag: "chart", chart_spec: { type, data: [...], xField, yField } }`' },
        {
          tag: 'chart',
          aspect_ratio: '4:3',
          chart_spec: {
            type: 'line',
            data: [
              { time: '周一', downloads: 120 },
              { time: '周二', downloads: 145 },
              { time: '周三', downloads: 89 },
              { time: '周四', downloads: 167 },
              { time: '周五', downloads: 201 },
            ],
            xField: 'time',
            yField: 'downloads',
          },
        },
      ],
    },
  };
}

/**
 * 柱状图 + 饼图 一张卡
 */
export function buildChartProbeC_BarPie() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart 探测 C — 柱状 + 饼图' },
      subtitle: { tag: 'plain_text', content: '两种图表类型在同一张卡' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'orange' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '### 柱状图（bar）' },
        {
          tag: 'chart',
          aspect_ratio: '4:3',
          chart_spec: {
            type: 'bar',
            data: {
              values: [
                { skill: 'PPT 助手', score: 87 },
                { skill: 'Reddit 扒', score: 71 },
                { skill: '会议纪要', score: 92 },
                { skill: '翻译官', score: 78 },
                { skill: '日历助理', score: 65 },
              ],
            },
            xField: 'skill',
            yField: 'score',
          },
        },
        { tag: 'hr' },
        { tag: 'markdown', content: '### 饼图（pie）' },
        {
          tag: 'chart',
          aspect_ratio: '1:1',
          chart_spec: {
            type: 'pie',
            data: {
              values: [
                { category: 'PPT 助手', value: 340 },
                { category: 'Reddit 扒', value: 210 },
                { category: '会议纪要', value: 180 },
                { category: '翻译官', value: 95 },
                { category: '日历助理', value: 55 },
              ],
            },
            categoryField: 'category',
            valueField: 'value',
          },
        },
      ],
    },
  };
}

/**
 * 多系列折线图（同一图里多条线，按 seriesField 分组）
 */
export function buildChartProbeD_MultiSeries() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart 探测 D — 多系列折线' },
      subtitle: { tag: 'plain_text', content: 'seriesField 分组，同一图里多条线' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'violet' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**三条线**：下载、安装、激活' },
        {
          tag: 'chart',
          aspect_ratio: '16:9',
          chart_spec: {
            type: 'line',
            data: {
              values: [
                { day: '周一', metric: '下载', count: 120 },
                { day: '周二', metric: '下载', count: 145 },
                { day: '周三', metric: '下载', count: 89 },
                { day: '周四', metric: '下载', count: 167 },
                { day: '周五', metric: '下载', count: 201 },
                { day: '周一', metric: '安装', count: 80 },
                { day: '周二', metric: '安装', count: 95 },
                { day: '周三', metric: '安装', count: 62 },
                { day: '周四', metric: '安装', count: 115 },
                { day: '周五', metric: '安装', count: 140 },
                { day: '周一', metric: '激活', count: 45 },
                { day: '周二', metric: '激活', count: 58 },
                { day: '周三', metric: '激活', count: 30 },
                { day: '周四', metric: '激活', count: 72 },
                { day: '周五', metric: '激活', count: 88 },
              ],
            },
            xField: 'day',
            yField: 'count',
            seriesField: 'metric',
          },
        },
      ],
    },
  };
}

/**
 * 散点图
 */
export function buildChartProbeE_Scatter() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart 探测 E — 散点图' },
      subtitle: { tag: 'plain_text', content: 'type: scatter' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'turquoise' },
      template: 'default',
    },
    body: {
      elements: [
        {
          tag: 'chart',
          aspect_ratio: '4:3',
          chart_spec: {
            type: 'scatter',
            data: {
              values: [
                { quality: 7.2, downloads: 340 },
                { quality: 8.5, downloads: 520 },
                { quality: 6.1, downloads: 180 },
                { quality: 9.0, downloads: 780 },
                { quality: 5.8, downloads: 95 },
                { quality: 7.9, downloads: 410 },
                { quality: 8.2, downloads: 610 },
                { quality: 6.5, downloads: 225 },
              ],
            },
            xField: 'quality',
            yField: 'downloads',
          },
        },
      ],
    },
  };
}

// ============================================================
//  Chart patch 探测（由 runner 调用 createCard + sendMessage + patch）
// ============================================================

/**
 * 初始 chart 卡（用于 patch 测试），预置 element_id 方便 patch 定位
 */
export function buildChartPatchInitialCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Chart Patch 探测（流式追加）' },
      subtitle: { tag: 'plain_text', content: '2 秒后 patchCardElement 会追加 2 个数据点' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'red' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**初始**：3 个数据点（周一到周三）' },
        {
          tag: 'chart',
          element_id: 'chart_patch_target',
          aspect_ratio: '4:3',
          chart_spec: {
            type: 'line',
            data: {
              values: [
                { day: '周一', count: 120 },
                { day: '周二', count: 145 },
                { day: '周三', count: 89 },
              ],
            },
            xField: 'day',
            yField: 'count',
          },
        },
      ],
    },
  };
}

/**
 * Patch 后的期望 chart_spec（runner 会 PATCH 到原 element_id）
 * 测"全量替换"还是"增量 merge"——结果解读看文档注释
 */
export const CHART_PATCH_FULL_REPLACEMENT = {
  chart_spec: {
    type: 'line',
    data: {
      values: [
        { day: '周一', count: 120 },
        { day: '周二', count: 145 },
        { day: '周三', count: 89 },
        { day: '周四', count: 167 },
        { day: '周五', count: 201 },
      ],
    },
    xField: 'day',
    yField: 'count',
  },
};

// ============================================================
//  Table 探测卡
// ============================================================

/**
 * 7 种列类型混合
 * 文档确认的 data_type：text / lark_md / markdown / number / options / persons / date
 * （注：用户 persons 字段需真实 open_id 才会渲染头像，没传就用占位字符串 —— 这里故意用占位看降级表现）
 */
export function buildTableProbeA_AllTypes() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Table 探测 A — 7 种列类型' },
      subtitle: { tag: 'plain_text', content: 'text / lark_md / markdown / number / options / persons / date' },
      icon: { tag: 'standard_icon', token: 'bitablegrid_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        {
          tag: 'table',
          page_size: 5,
          columns: [
            { name: 'col_text',     display_name: 'text',     data_type: 'text',     width: 'auto' },
            { name: 'col_larkmd',   display_name: 'lark_md',  data_type: 'lark_md',  width: 'auto' },
            { name: 'col_md',       display_name: 'markdown', data_type: 'markdown', width: 'auto' },
            { name: 'col_num',      display_name: 'number',   data_type: 'number',   width: 'auto',
              format: { symbol: '¥', precision: 2 } },
            { name: 'col_opts',     display_name: 'options',  data_type: 'options',  width: 'auto' },
            { name: 'col_persons',  display_name: 'persons',  data_type: 'persons',  width: 'auto' },
            { name: 'col_date',     display_name: 'date',     data_type: 'date',     width: 'auto',
              date_format: 'YYYY/MM/DD' },
          ],
          rows: [
            {
              col_text: '普通文本',
              col_larkmd: '**粗体** + *斜体*',
              col_md: '**链接** [飞书](https://www.feishu.cn) + `inline code`',
              col_num: 1234.56,
              col_opts: [{ text: '进行中', color: 'orange' }],
              col_persons: 'ou_bbab3d0c625dc228616349fbca19d0dd',
              col_date: 1713484800000,
            },
            {
              col_text: '另一行',
              col_larkmd: '[链接](https://skills.deskclaw.me)',
              col_md: '> 引用块内的内容',
              col_num: 78.9,
              col_opts: [
                { text: '高优', color: 'red' },
                { text: '前端', color: 'blue' },
              ],
              col_persons: ['ou_bbab3d0c625dc228616349fbca19d0dd'],
              col_date: 1713571200000,
            },
            {
              col_text: '第三行',
              col_larkmd: '---',
              col_md: '```\ncode block\n```',
              col_num: 0.01,
              col_opts: [{ text: '已定稿', color: 'green' }],
              col_persons: '',
              col_date: 1713657600000,
            },
          ],
        },
      ],
    },
  };
}

// ============================================================
//  column_set 探测卡（KPI 并列卡候选 schema）
// ============================================================

/**
 * 候选 A：column_set 标准（每个 column 放 plain_text 大数字 + 小标签）
 * 假设 schema：{tag: 'column_set', columns: [{tag: 'column', elements: [...]}]}
 */
export function buildColumnSetProbeA() {
  const makeKpi = (value, label, color = 'indigo') => ({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    vertical_align: 'center',
    elements: [
      { tag: 'markdown', text_align: 'center', content: `<font color='${color}' size='heading'>${value}</font>` },
      { tag: 'markdown', text_align: 'center', content: `<font color='grey' size='notation'>${label}</font>` },
    ],
  });
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Column Set A — KPI 并列' },
      subtitle: { tag: 'plain_text', content: '假设 column 里塞 markdown' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**本周概况**' },
        {
          tag: 'column_set',
          flex_mode: 'none',
          horizontal_spacing: 'default',
          background_style: 'default',
          columns: [
            makeKpi('5', '接单', 'indigo'),
            makeKpi('7.8', '均分', 'orange'),
            makeKpi('2', '待定稿', 'red'),
          ],
        },
      ],
    },
  };
}

/**
 * 候选 B：column 里用 plain_text（更纯粹）+ 带背景色
 */
export function buildColumnSetProbeB() {
  const makeKpi = (value, label) => ({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    elements: [
      { tag: 'plain_text', content: value, text_align: 'center', text_size: 'heading' },
      { tag: 'plain_text', content: label, text_align: 'center', text_size: 'notation', text_color: 'grey' },
    ],
  });
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Column Set B — plain_text 版' },
      subtitle: { tag: 'plain_text', content: '对比 A：不使用 markdown' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'orange' },
      template: 'default',
    },
    body: {
      elements: [
        {
          tag: 'column_set',
          flex_mode: 'none',
          background_style: 'grey',
          columns: [
            makeKpi('12', '今日接单'),
            makeKpi('¥8.5万', '营收'),
            makeKpi('+23%', '环比'),
            makeKpi('98%', '完成率'),
          ],
        },
      ],
    },
  };
}

/**
 * 候选 C：flex_mode 测试（stretch / none / flow）
 */
export function buildColumnSetProbeC() {
  const col = (label, value) => ({
    tag: 'column',
    width: 'weighted',
    weight: 1,
    elements: [
      { tag: 'plain_text', content: label, text_align: 'center', text_size: 'notation', text_color: 'grey' },
      { tag: 'plain_text', content: value, text_align: 'center', text_size: 'heading' },
    ],
  });
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Column Set C — 3 种 flex_mode' },
      subtitle: { tag: 'plain_text', content: '观察布局差异' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'violet' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '**flex_mode: none**（默认）' },
        {
          tag: 'column_set', flex_mode: 'none',
          columns: [col('A', '1'), col('B', '2'), col('C', '3')],
        },
        { tag: 'hr' },
        { tag: 'markdown', content: '**flex_mode: stretch**' },
        {
          tag: 'column_set', flex_mode: 'stretch',
          columns: [col('A', '1'), col('B', '2'), col('C', '3')],
        },
        { tag: 'hr' },
        { tag: 'markdown', content: '**flex_mode: flow**' },
        {
          tag: 'column_set', flex_mode: 'flow',
          columns: [col('A', '1'), col('B', '2'), col('C', '3'), col('D', '4'), col('E', '5')],
        },
      ],
    },
  };
}

/**
 * 分页测试：12 行 + page_size=5
 */
export function buildTableProbeB_Pagination() {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    rows.push({
      idx: i,
      skill: `技能 ${String.fromCharCode(64 + i)}`,
      score: Math.round((Math.random() * 30 + 60) * 10) / 10,
    });
  }
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Table 探测 B — 分页' },
      subtitle: { tag: 'plain_text', content: `${rows.length} 行 · page_size=5` },
      icon: { tag: 'standard_icon', token: 'bitablegrid_outlined', color: 'violet' },
      template: 'default',
    },
    body: {
      elements: [
        {
          tag: 'table',
          page_size: 5,
          columns: [
            { name: 'idx',   display_name: '#',    data_type: 'number' },
            { name: 'skill', display_name: '技能', data_type: 'text'   },
            { name: 'score', display_name: '质量', data_type: 'number',
              format: { precision: 1 } },
          ],
          rows,
        },
      ],
    },
  };
}
