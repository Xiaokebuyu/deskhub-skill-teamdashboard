/**
 * MCP 外部 API 操作层
 * 封装 DeskHub / Umami / DeskClaw MCP 外部调用
 * 复用 middleware/cache.js 缓存逻辑
 */

import { getCache, setCache, clearAll } from '../middleware/cache.js';

// ============================================================
//  DeskHub
// ============================================================

const DESKHUB_BASE = () => process.env.DESKHUB_BASE || 'https://skills.deskclaw.me';

async function fetchDeskhub(path) {
  const url = `${DESKHUB_BASE()}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`DeskHub ${res.status}: ${url}`);
  return res.json();
}

export async function listDeskhubSkills(query = {}) {
  const qs = new URLSearchParams(query).toString();
  const cacheKey = `mcp:deskhub:skills:${qs}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const json = await fetchDeskhub(`/api/v1/skills${qs ? '?' + qs : ''}`);
  // API 返回 { success, data: { items: [...], total, ... } }
  const items = json.data?.items || json.data || [];
  setCache(cacheKey, items, 600);
  return items;
}

export async function getDeskhubSkill(slug) {
  const cacheKey = `mcp:deskhub:detail:${slug}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const json = await fetchDeskhub(`/api/v1/skills/${encodeURIComponent(slug)}`);
  // API 返回 { success, data: { id, slug, displayName, summary, ... } }
  setCache(cacheKey, json.data || json, 1800);
  return json.data || json;
}

export async function getDeskhubVersions(query = {}) {
  const qs = new URLSearchParams(query).toString();
  const cacheKey = `mcp:deskhub:versions:${qs}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const json = await fetchDeskhub(`/api/v1/versions/recent${qs ? '?' + qs : ''}`);
  setCache(cacheKey, json.data, 300);
  return json.data;
}

export function clearDeskhubCache() {
  clearAll();
}

// ============================================================
//  Umami
// ============================================================

const UMAMI_BASE = () => process.env.UMAMI_BASE || 'https://umami.deskclaw.me';
const WEBSITE_ID = () => process.env.UMAMI_WEBSITE_ID;
const DATA_SINCE_MS = new Date('2026-03-29T00:00:00+08:00').getTime();

let umamiToken = null;
let umamiTokenExpiry = 0;

async function ensureUmamiToken() {
  if (umamiToken && Date.now() < umamiTokenExpiry) return umamiToken;
  const res = await fetch(`${UMAMI_BASE()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.UMAMI_USERNAME,
      password: process.env.UMAMI_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Umami login failed: ${res.status}`);
  const json = await res.json();
  umamiToken = json.token;
  umamiTokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return umamiToken;
}

async function fetchUmami(path) {
  const t = await ensureUmamiToken();
  const url = `${UMAMI_BASE()}/api/websites/${WEBSITE_ID()}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
  });
  if (res.status === 401) {
    umamiToken = null;
    const t2 = await ensureUmamiToken();
    const res2 = await fetch(url, {
      headers: { Authorization: `Bearer ${t2}`, Accept: 'application/json' },
    });
    if (!res2.ok) throw new Error(`Umami ${res2.status}: ${url}`);
    return res2.json();
  }
  if (!res.ok) throw new Error(`Umami ${res.status}: ${url}`);
  return res.json();
}

function clampStartAt(startAt) {
  const v = Number(startAt);
  return v < DATA_SINCE_MS ? DATA_SINCE_MS : v;
}

export async function getUmamiStats(startAt, endAt) {
  const sa = clampStartAt(startAt);
  const cacheKey = `mcp:umami:stats:${sa}:${endAt}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const data = await fetchUmami(`/stats?startAt=${sa}&endAt=${endAt}`);
  setCache(cacheKey, data, 600);
  return data;
}

export async function getUmamiPageviews(startAt, endAt, unit = 'day') {
  const sa = clampStartAt(startAt);
  const cacheKey = `mcp:umami:pv:${sa}:${endAt}:${unit}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const data = await fetchUmami(`/pageviews?startAt=${sa}&endAt=${endAt}&unit=${unit}`);
  setCache(cacheKey, data, 600);
  return data;
}

export async function getUmamiMetrics(type, startAt, endAt) {
  const sa = clampStartAt(startAt);
  const cacheKey = `mcp:umami:metrics:${type}:${sa}:${endAt}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const data = await fetchUmami(`/metrics?type=${type}&startAt=${sa}&endAt=${endAt}`);
  setCache(cacheKey, data, 600);
  return data;
}

export async function getUmamiEventData(startAt, endAt) {
  const sa = clampStartAt(startAt);
  const cacheKey = `mcp:umami:events:${sa}:${endAt}`;
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const data = await fetchUmami(`/event-data/fields?startAt=${sa}&endAt=${endAt}`);
  setCache(cacheKey, data, 600);
  return data;
}

export async function getUmamiActive() {
  return fetchUmami('/active');
}

// ============================================================
//  DeskClaw MCP（外部 MCP 服务器代理）
// ============================================================

const MCP_URL = () => process.env.MCP_ENDPOINT || 'http://127.0.0.1:18790/deskclaw/mcp';
let deskclawSessionId = null;

async function initDeskclawSession() {
  const res = await fetch(MCP_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'initialize', id: 1,
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'teamboard-mcp-proxy', version: '1.0' },
      },
    }),
  });
  deskclawSessionId = res.headers.get('mcp-session-id');
  if (!deskclawSessionId) throw new Error('DeskClaw MCP initialize failed: no session ID');
  return res;
}

async function deskclawCall(method, params = {}, id = Date.now()) {
  if (!deskclawSessionId) await initDeskclawSession();

  const res = await fetch(MCP_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': deskclawSessionId,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  });

  if (!res.ok && res.status === 400) {
    deskclawSessionId = null;
    await initDeskclawSession();
    return deskclawCall(method, params, id + 1);
  }

  const text = await res.text();
  const dataLine = text.split('\n').find(l => l.startsWith('data: '));
  if (!dataLine) throw new Error('Invalid DeskClaw MCP response');
  return JSON.parse(dataLine.slice(6));
}

export async function listDeskclawTools() {
  const cacheKey = 'mcp:deskclaw:tools';
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const rpc = await deskclawCall('tools/list');
  const tools = rpc.result?.tools || [];
  const data = tools.map(t => ({
    name: t.name,
    desc: (t.description || '').split('\n')[0],
    fullDesc: t.description || '',
    params: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
  }));
  setCache(cacheKey, data, 1800);
  return data;
}

export async function getDeskclawHealth() {
  const rpc = await deskclawCall('tools/call', { name: 'get_health', arguments: {} });
  const content = rpc.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

export async function listDeskclawServers() {
  const cacheKey = 'mcp:deskclaw:servers';
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  const rpc = await deskclawCall('tools/call', { name: 'mcp_server_list', arguments: {} });
  const content = rpc.result?.content?.[0]?.text;
  const data = content ? JSON.parse(content) : [];
  setCache(cacheKey, data, 600);
  return data;
}

export async function getDeskclawInfo() {
  const cacheKey = 'mcp:deskclaw:info';
  const hit = getCache(cacheKey);
  if (hit) return hit.data;

  deskclawSessionId = null;
  const initRes = await initDeskclawSession();
  const text = await initRes.text();
  const dataLine = text.split('\n').find(l => l.startsWith('data: '));
  const rpc = dataLine ? JSON.parse(dataLine.slice(6)) : {};

  const data = {
    name: rpc.result?.serverInfo?.name || 'deskclaw',
    version: rpc.result?.serverInfo?.version || '—',
    instructions: rpc.result?.instructions || '',
    capabilities: rpc.result?.capabilities || {},
  };
  setCache(cacheKey, data, 1800);
  return data;
}
