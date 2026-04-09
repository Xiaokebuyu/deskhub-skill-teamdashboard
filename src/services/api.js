/**
 * Base fetch 封装
 * 开发时走 Vite proxy（/api → localhost:3001），生产时走相对路径或配置的 base
 */
const BASE = import.meta.env.VITE_API_BASE || '';

export async function get(path, token, opts = {}) {
  const url = `${BASE}${path}`;
  const headers = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { signal: opts.signal, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}
