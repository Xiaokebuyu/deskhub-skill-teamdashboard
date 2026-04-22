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
import { getPatrolConfigValue } from '../mcp/db-ops.js';

export const bus = new EventEmitter();

const buffer = [];
let flushTimer = null;

// flush 窗口：启动时从 patrol_config 读一次缓存（热更新需重启，plan 里说明过）
const HIGH_WAIT = (() => {
  const v = getPatrolConfigValue('high_flush_ms');
  return Number(v) || Number(process.env.BOT_HIGH_FLUSH_MS) || 60_000;
})();
const NORMAL_WAIT = (() => {
  const v = getPatrolConfigValue('normal_flush_ms');
  return Number(v) || Number(process.env.BOT_NORMAL_FLUSH_MS) || 600_000;
})();

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
    const wait = record.priority === 'high' ? HIGH_WAIT : NORMAL_WAIT;
    flushTimer = setTimeout(flush, wait);
    flushTimer.unref?.(); // 不阻止进程退出
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
