import { replaceCatalog } from "../constants/catalog";

// Cache do catálogo em IndexedDB (aguenta volumes maiores que o localStorage) +
// sincronização por hash: o cliente só baixa o catálogo inteiro quando o hash muda.
const DB = "instrumenta", STORE = "kv", KEY = "catalog";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Na inicialização: aplica o catálogo cacheado (offline-first). Retorna o hash em cache.
export async function loadCachedCatalog() {
  try {
    const cached = await idbGet(KEY);
    if (cached?.items?.length) { replaceCatalog(cached.items); return cached.hash || null; }
  } catch { /* sem IndexedDB */ }
  return null;
}

// Com backend conectado: compara o hash; se mudou, baixa o catálogo, aplica e cacheia.
export async function syncCatalog(apiRoot) {
  const V1 = `${apiRoot.replace(/\/+$/, "")}/api/v1`;
  let cachedHash = null;
  try { cachedHash = (await idbGet(KEY))?.hash || null; } catch { /* ignore */ }

  const head = await fetch(`${V1}/catalog/hash`).then((r) => { if (!r.ok) throw new Error("hash"); return r.json(); });
  if (head?.hash && head.hash === cachedHash) return { updated: false };

  const data = await fetch(`${V1}/catalog`).then((r) => { if (!r.ok) throw new Error("catalog"); return r.json(); });
  if (data?.items?.length) {
    replaceCatalog(data.items);
    try { await idbSet(KEY, { hash: data.hash, items: data.items }); } catch { /* ignore */ }
    return { updated: true, count: data.items.length };
  }
  return { updated: false };
}
