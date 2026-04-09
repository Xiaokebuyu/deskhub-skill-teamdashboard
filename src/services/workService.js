import { get } from './api.js';

const BASE = '/api';

function buildHeaders(token) {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function post(path, body, token) {
  const res = await fetch(path, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function put(path, body, token) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function patch(path, body, token) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

async function del(path, token) {
  const h = { Accept: 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { method: 'DELETE', headers: h });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

// --- Plans ---

export async function fetchPlans(token) {
  const res = await get(`${BASE}/plans`, token);
  return res.data;
}

export async function createPlan(data, token) {
  const res = await post(`${BASE}/plans`, data, token);
  return res.data;
}

export async function editPlan(id, data, token) {
  return put(`${BASE}/plans/${id}`, data, token);
}

export async function updatePlanStatus(id, body, token) {
  return patch(`${BASE}/plans/${id}/status`, body, token);
}

export async function deletePlan(id, token) {
  return del(`${BASE}/plans/${id}`, token);
}

// --- Variants ---

export async function createVariant(planId, data, token) {
  const res = await post(`${BASE}/plans/${planId}/variants`, data, token);
  return res.data;
}

export async function editVariant(id, data, token) {
  return put(`${BASE}/variants/${id}`, data, token);
}

export async function deleteVariant(id, token) {
  return del(`${BASE}/variants/${id}`, token);
}

// --- Scores ---

export async function submitScores(variantId, body, token) {
  const res = await post(`${BASE}/variants/${variantId}/scores`, body, token);
  return res.data;
}

export async function editScore(id, data, token) {
  return put(`${BASE}/scores/${id}`, data, token);
}

export async function deleteScore(id, token) {
  return del(`${BASE}/scores/${id}`, token);
}

// --- Dimensions ---

export async function fetchDimensions(token) {
  const res = await get(`${BASE}/dimensions`, token);
  return res.data;
}

export async function createDimension(data, token) {
  const res = await post(`${BASE}/dimensions`, data, token);
  return res.data;
}

export async function editDimension(id, data, token) {
  return put(`${BASE}/dimensions/${id}`, data, token);
}

export async function deleteDimension(id, token) {
  return del(`${BASE}/dimensions/${id}`, token);
}

// --- File Upload ---

export async function uploadFiles(files, token) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/upload`, { method: 'POST', headers: h, body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

// --- Auth / Users ---

export async function fetchUsers(token) {
  const res = await get('/api/auth/users', token);
  return res.data;
}

export async function createUser(data, token) {
  const res = await post('/api/auth/users', data, token);
  return res.data;
}

export async function deleteUser(id, token) {
  return del(`/api/auth/users/${id}`, token);
}

export async function changePassword(data, token) {
  return put('/api/auth/password', data, token);
}
