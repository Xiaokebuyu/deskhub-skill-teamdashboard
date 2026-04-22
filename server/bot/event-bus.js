/**
 * 事件驱动变更收集
 * logChange() 写完数据后 emit → 缓冲区收集 → 定时 flush 交给 LLM
 *
 * 两个阀门：
 * - 高优先级变更：1 分钟后 flush（快速但仍合并连续操作）
 * - 普通变更：10 分钟后 flush（攒一批一起推，防通知洪流）
 * - 没变更就不触发，零空转
 */

import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();

const buffer = [];
let flushTimer = null;

/**
 * 每次 change 事件时 lazy 读 DB 配置，避免与 db-ops.js 循环依赖。
 * 副作用：实际上 flush 窗口变成了热更新（bonus，不坏事）。
 */
async function getFlushWait(priority) {
  const { getPatrolConfigValue } = await import('../mcp/db-ops.js');
  const key = priority === 'high' ? 'high_flush_ms' : 'normal_flush_ms';
  const v = getPatrolConfigValue(key);
  if (v) return Number(v);
  return priority === 'high'
    ? Number(process.env.BOT_HIGH_FLUSH_MS) || 60_000
    : Number(process.env.BOT_NORMAL_FLUSH_MS) || 600_000;
}

/** @type {((batch: Array) => Promise<void>) | null} */
let onFlush = null;

/**
 * 注册 flush 回调（由 change-detector 设置）
 */
export function setFlushHandler(handler) {
  onFlush = handler;
}

bus.on('change', (record) => {
  buffer.push(record);

  // 首条变更启动定时器；后续变更不重置（避免持续推迟）
  if (!flushTimer) {
    getFlushWait(record.priority).then(wait => {
      // 双重检查：拿到 wait 的时候可能已经有 timer（并发 emit），防重建
      if (flushTimer) return;
      flushTimer = setTimeout(flush, wait);
      flushTimer.unref?.();
    });
  }
});

async function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;

  if (buffer.length === 0) return;

  const batch = buffer.splice(0);
  console.log(`[EventBus] Flushing ${batch.length} change(s)`);

  if (onFlush) {
    try {
      await onFlush(batch);
    } catch (err) {
      console.error('[EventBus] flush handler error:', err.message);
    }
  }
}

/**
 * 手动触发 flush（测试 / 每日汇总用）
 */
export { flush as forceFlush };
