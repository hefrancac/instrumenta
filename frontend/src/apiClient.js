/**
 * Instrumenta — API client for the frontend.
 *
 * Drop-in bridge between the React app and the FastAPI backend. It exposes the
 * endpoints the UI needs and, crucially, `adaptOptimize()` which reshapes the
 * backend's optimize response into the exact structure the existing results UI
 * already renders (store objects with colors, `covered`/`lines`, camelCase keys).
 *
 * Wiring into Instrumenta.jsx (3 edits):
 *   1) import { runFromText, optimizeAndAdapt, isBackendEnabled } from "./apiClient";
 *   2) in run(): if isBackendEnabled(), `const { listId, items } = await runFromText(text)`
 *      and drive the review stage from those items; else keep the local parse.
 *   3) entering results: `const opt = isBackendEnabled()
 *        ? await optimizeAndAdapt(listId) : optimize(localItems)`.
 * If the backend is unreachable the calls throw, so wrap in try/catch and fall
 * back to the local logic — the app keeps working standalone.
 */

// Set to your backend, e.g. "http://localhost:8000/api/v1". Empty => local mode.
export const API_BASE = "";

// Optional bearer token (leave null in DEMO_MODE).
let authToken = null;
export const setAuthToken = (t) => { authToken = t; };
export const isBackendEnabled = () => Boolean(API_BASE);

// --- store theming (backend returns ids/names only; UI wants colors) --------
const STORE_THEME = {
  cremer:   { color: "#245FA6" },
  surya:    { color: "#6D3AA6" },
  speed:    { color: "#C85A2B" },
  universo: { color: "#B23A73" },
};
const PALETTE = ["#245FA6", "#6D3AA6", "#C85A2B", "#B23A73", "#0B6E5F", "#B45309"];
const colorFor = (id, i = 0) => (STORE_THEME[id]?.color) || PALETTE[i % PALETTE.length];
const store = (id, name, shipping, free = null, i = 0) => ({ id, name, color: colorFor(id, i), shipping, free });

// --- low-level fetch --------------------------------------------------------
async function http(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.error?.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// --- endpoints --------------------------------------------------------------
export const login = async (email, password) => {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error("Credenciais inválidas");
  const data = await res.json();
  setAuthToken(data.access_token);
  return data;
};

export const uploadText = (text) => http("/lists/text", { method: "POST", body: { text } });

export const uploadFile = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const res = await fetch(`${API_BASE}/lists/upload`, { method: "POST", headers, body: fd });
  if (!res.ok) throw new Error((await res.json())?.error?.message || `HTTP ${res.status}`);
  return res.json();
};

export const getList = (listId) => http(`/lists/${listId}`);
export const getStatus = (listId) => http(`/lists/${listId}/status`);
export const patchItem = (listId, itemId, patch) =>
  http(`/lists/${listId}/items/${itemId}`, { method: "PATCH", body: patch });
export const optimize = (listId, cep) =>
  http(`/cart/optimize/${listId}${cep ? `?cep=${encodeURIComponent(cep)}` : ""}`);

/** Liveness check (no /api/v1 prefix). */
export const health = async () => {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error("backend indisponível");
  return r.json();
};

/** Affiliate outbound URL that records the click, then 302s to the store. */
export const goUrl = (offerId) => `${API_BASE}/api/v1/go/${offerId}`;

/** Poll scraping status until done/error (or timeout). */
export async function pollStatus(listId, { intervalMs = 1200, maxAttempts = 60, onProgress } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const s = await getStatus(listId);
    onProgress?.(s);
    if (s.status === "done" || s.status === "error") return s;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "timeout" };
}

// --- adapter: backend optimize response -> UI shape -------------------------
const adaptRow = (r) => ({
  it: { std: r.standard_name, uid: r.standard_name },
  price: r.price,                       // line total (unit × qty)
  unit: r.unit_price ?? r.price,
  qty: r.quantity ?? 1,
  brand: r.brand,
  url: r.url,
  offer_id: r.offer_id,                 // enables /go/{offer_id} affiliate links
  packQty: r.pack_qty ?? 1,
  packs: r.packs ?? 1,
  ageH: r.age_hours ?? 0,
});

const adaptOption = (o, i = 0) => o && {
  store: store(o.store_id, o.store_name, o.shipping, o.free_shipping_threshold, i),
  coverage: o.coverage,
  required: o.required_count,
  complete: o.complete,
  subtotal: o.subtotal,
  shipping: o.shipping,
  total: o.total,
  free: !!o.free_shipping_eligible,
  toFree: o.amount_to_free_shipping,
  covered: (o.items || []).map(adaptRow),
  missing: (o.missing || []).map((name) => ({ std: name })),
};

/** Convert the backend `/cart/optimize` response to what Instrumenta's UI renders. */
export function adaptOptimize(resp) {
  const ranking = (resp.single?.ranking || []).map(adaptOption);
  const bestSingle = adaptOption(resp.single?.best);
  const cheapestFull = adaptOption(resp.single?.cheapest_complete);
  const groups = (resp.multi?.groups || []).map((g, i) => {
    const lines = (g.items || []).map(adaptRow);
    return {
      store: store(g.store_id, g.store_name, g.shipping, g.free_shipping_threshold, i),
      lines,
      subtotal: g.subtotal,
      shipping: g.shipping,             // actual, threshold-aware (0 if free)
      free: !!g.free_shipping_eligible,
      toFree: g.amount_to_free_shipping,
      oldest: lines.reduce((m, l) => Math.max(m, l.ageH || 0), 0),
    };
  });
  const requiredCount = (resp.single?.best?.required_count) || ranking[0]?.required || 0;
  return {
    active: Array.from({ length: requiredCount }),
    ranking, bestSingle, cheapestFull,
    multi: {
      groups,
      itemsCost: resp.multi?.items_cost || 0,
      totalShipping: resp.multi?.total_shipping || 0,
      total: resp.multi?.total || 0,
      storeCount: resp.multi?.store_count || groups.length,
      shippingSaved: resp.multi?.shipping_saved || 0,
      unavailable: resp.multi?.unavailable || [],
    },
    baseSingleTotal: resp.base_single_total || 0,
    savings: resp.savings || 0,
    recommendMulti: resp.recommend === "multi",
    region: resp.destination_region,
  };
}

export const optimizeAndAdapt = async (listId, cep) => adaptOptimize(await optimize(listId, cep));

/** Orchestrate: send text, wait for scraping, return list + reviewable items. */
export async function runFromText(text, { onProgress } = {}) {
  const created = await uploadText(text);
  await pollStatus(created.list_id, { onProgress });
  const detail = await getList(created.list_id);
  return { listId: created.list_id, items: detail.items };
}
