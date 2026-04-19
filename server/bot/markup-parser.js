/**
 * LLM 流式文本中 [[tag:args]] markup 解析器
 *
 * 语法（统一 A2）：
 *   - 无 body 组件（单行，9 件礼服）：
 *       [[plan:P-012]]
 *       [[user:刘万钢]]
 *       [[callout:warn|文本内容]]
 *       [[divider]]
 *     → 扫到完整 `[[tag:args]]` 立即 emit
 *   - 有 body 组件（fenced，chart/table）：
 *       [[chart:line]]
 *       {...json...}
 *       [[/chart]]
 *     → 扫到 opening 后进 fenced 模式，body 不解析任何内层 `[[...]]`，
 *       直到 `[[/tag]]` 闭合才 emit
 *
 * 用法：
 *   const stream = new MarkupStream();
 *   for (const delta of chunks) {
 *     const parts = stream.feed(delta);
 *     for (const p of parts) handlePart(p);
 *   }
 *   const tail = stream.flush();   // 流结束兜底
 *
 * 输出 part 形状：
 *   { kind: 'text', text: string }
 *   { kind: 'markup', tag, args, placement: 'inline'|'block' }
 *   { kind: 'markup', tag, args, placement: 'block', body: string }   // fenced
 */

// ── tag 白名单 + placement 映射 ──
export const TAG_PLACEMENT = {
  plan:     'block',
  user:     'inline',
  skill:    'block',
  mcp:      'block',
  callout:  'block',
  section:  'block',
  divider:  'block',
  link:     'inline',
  header:   'block',    // Stage C 上游消费，renderer 侧忽略
  chart:    'block',    // fenced
  table:    'block',    // fenced
  kpi:      'block',    // fenced（KPI 并列卡，基于飞书 column_set）
};

const VALID_TAGS = Object.keys(TAG_PLACEMENT);

// ── fenced 白名单（有 body 的组件）──
export const FENCED_TAGS = new Set(['chart', 'table', 'kpi']);

// ── 尺寸约束 ──
const MAX_PENDING    = 200;   // 未闭合 `[[` 的最大耐心（单行）
const MAX_MARKUP_LEN = 300;   // 单行 markup 整体最长
const MAX_FENCED_BODY = 4000; // fenced body 最长（chart/table 数据可能较大）

export class MarkupStream {
  constructor() {
    this._buffer = '';     // 未 emit 的字符串（非 fenced 模式）
    this._fenced = null;   // fenced 模式状态：{ tag, args, body }
  }

  /**
   * 喂入一段新 chunk，返回本次能定稿 emit 的 parts 数组
   */
  feed(delta) {
    if (!delta) return [];
    const parts = [];

    // 在 fenced 模式下，delta 全部进 fenced.body，然后找闭合
    if (this._fenced) {
      this._fenced.body += delta;
      this._drainFenced(parts);
      return parts;
    }

    // 正常模式：累积到 buffer
    this._buffer += delta;
    this._drainNormal(parts);
    return parts;
  }

  /**
   * 正常模式扫描：处理单行 markup，若遇到 FENCED_TAGS 切到 fenced 模式
   */
  _drainNormal(parts) {
    while (true) {
      const openIdx = this._buffer.indexOf('[[');
      if (openIdx === -1) {
        // 没有 `[[`。buffer 末尾是单个 `[` 要保留（下个 chunk 可能补成 `[[`）
        const safeLen = this._buffer.endsWith('[') ? this._buffer.length - 1 : this._buffer.length;
        if (safeLen > 0) {
          parts.push({ kind: 'text', text: this._buffer.slice(0, safeLen) });
          this._buffer = this._buffer.slice(safeLen);
        }
        break;
      }

      // `[[` 前面的安全普通文本
      if (openIdx > 0) {
        parts.push({ kind: 'text', text: this._buffer.slice(0, openIdx) });
        this._buffer = this._buffer.slice(openIdx);
      }

      // 现在 buffer 以 `[[` 开头，找闭合 `]]`
      const closeIdx = this._buffer.indexOf(']]', 2);
      if (closeIdx === -1) {
        // 未闭合。超 MAX_PENDING 就兜底
        if (this._buffer.length > MAX_PENDING) {
          parts.push({ kind: 'text', text: this._buffer });
          this._buffer = '';
        }
        break;
      }

      const rawMarkup = this._buffer.slice(0, closeIdx + 2);
      const inner = this._buffer.slice(2, closeIdx);

      if (rawMarkup.length > MAX_MARKUP_LEN) {
        parts.push({ kind: 'text', text: rawMarkup });
        this._buffer = this._buffer.slice(closeIdx + 2);
        continue;
      }

      // 闭合 tag `[[/xxx]]` —— 在 normal 模式遇到说明 fenced 外孤立了，当普通文本
      if (inner.startsWith('/')) {
        parts.push({ kind: 'text', text: rawMarkup });
        this._buffer = this._buffer.slice(closeIdx + 2);
        continue;
      }

      // 解析 tag:args
      const colonIdx = inner.indexOf(':');
      let tag, argsPart;
      if (colonIdx === -1) {
        tag = inner.trim();
        argsPart = '';
      } else {
        tag = inner.slice(0, colonIdx).trim();
        argsPart = inner.slice(colonIdx + 1);
      }

      if (!VALID_TAGS.includes(tag)) {
        parts.push({ kind: 'text', text: rawMarkup });
        this._buffer = this._buffer.slice(closeIdx + 2);
        continue;
      }

      const args = argsPart === '' ? [] : argsPart.split('|').map(s => s.trim());

      // Fenced 组件：切到 fenced 模式，等 body + 闭合 tag
      if (FENCED_TAGS.has(tag)) {
        this._fenced = { tag, args, body: '' };
        // 吃掉 opening tag，剩下的 buffer 作为 fenced body 起始
        const afterOpening = this._buffer.slice(closeIdx + 2);
        this._buffer = '';
        this._fenced.body = afterOpening;
        this._drainFenced(parts);
        return;   // 进入 fenced 后，本次 drainNormal 结束
      }

      // 单行 markup（含 header/divider/plan/user/... 全部 9 件）
      parts.push({
        kind: 'markup',
        tag,
        args,
        placement: TAG_PLACEMENT[tag],
      });
      this._buffer = this._buffer.slice(closeIdx + 2);
    }
  }

  /**
   * Fenced 模式扫描：找 `[[/<tag>]]` 闭合
   */
  _drainFenced(parts) {
    const closeTag = `[[/${this._fenced.tag}]]`;
    const closeIdx = this._fenced.body.indexOf(closeTag);

    if (closeIdx === -1) {
      // 未闭合。body 超 MAX_FENCED_BODY 兜底
      if (this._fenced.body.length > MAX_FENCED_BODY) {
        // 退化：把整个 fenced（含 opening）当普通文本泄出
        const { tag, args, body } = this._fenced;
        const argsStr = args.length ? ':' + args.join('|') : '';
        const raw = `[[${tag}${argsStr}]]${body}`;
        parts.push({ kind: 'text', text: raw });
        this._fenced = null;
      }
      // 否则继续等下个 chunk
      return;
    }

    // 闭合到达！emit fenced markup，剩下的字符放回 buffer 走 normal
    const body = this._fenced.body.slice(0, closeIdx);
    const after = this._fenced.body.slice(closeIdx + closeTag.length);

    parts.push({
      kind: 'markup',
      tag: this._fenced.tag,
      args: this._fenced.args,
      placement: 'block',
      body,
    });

    this._fenced = null;
    this._buffer += after;

    // 剩余 buffer 可能又有 markup，继续扫
    this._drainNormal(parts);
  }

  /**
   * 流结束兜底
   */
  flush() {
    const parts = [];
    if (this._fenced) {
      // Fenced 未闭合 —— 整段当普通文本
      const { tag, args, body } = this._fenced;
      const argsStr = args.length ? ':' + args.join('|') : '';
      parts.push({ kind: 'text', text: `[[${tag}${argsStr}]]${body}` });
      this._fenced = null;
    }
    if (this._buffer) {
      parts.push({ kind: 'text', text: this._buffer });
      this._buffer = '';
    }
    return parts;
  }
}
