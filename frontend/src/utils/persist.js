import { CATALOG } from "../constants/catalog";

const KEY = "instrumenta:list";      // lista única (legada)
const LKEY = "instrumenta:lists";    // coleção de listas nomeadas

// --- Persistência local (não perde a lista ao recarregar) -------------------
export const saveList = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* sandbox sem storage */ }
};
export const loadList = () => {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
};
export const clearList = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};

// --- Coleção de listas nomeadas (um aluno tem várias disciplinas) -----------
// Modelo: { v:1, activeId, lists:[{ id, name, items, updatedAt }] }
export const newId = () => Math.random().toString(36).slice(2, 9);

export function persistCollection(col) {
  try { localStorage.setItem(LKEY, JSON.stringify(col)); } catch { /* ignore */ }
}

export function loadCollection() {
  try {
    const s = localStorage.getItem(LKEY);
    if (s) { const c = JSON.parse(s); if (c && Array.isArray(c.lists)) return c; }
  } catch { /* ignore */ }
  // Migração: se só existe a lista única legada, ela vira a primeira lista nomeada.
  const legacy = loadList();
  if (legacy && legacy.length) {
    const id = newId();
    const col = { v: 1, activeId: id, lists: [{ id, name: "Minha lista", items: legacy, updatedAt: Date.now() }] };
    persistCollection(col);
    return col;
  }
  return null;
}

// --- Compartilhar por link (lista compacta codificada na URL) ---------------
// Guarda só [catId, qty, brandIndex, owned] — o resto é reconstruído do catálogo.
export function encodeList(items) {
  const arr = items.filter((i) => i.catId).map((i) => [i.catId, i.qty || 1, i.brandIndex || 0, i.owned ? 1 : 0]);
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(arr)))); } catch { return ""; }
}
export function decodeList(b64) {
  try {
    const arr = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return arr
      .map(([c, q, bi, o], idx) => {
        const cat = CATALOG.find((x) => x.id === c);
        return cat
          ? { uid: `${c}-${idx}`, catId: c, raw: cat.std, std: cat.std, cat: cat.cat,
              brands: cat.brands, brandIndex: bi || 0, owned: !!o, qty: q || 1 }
          : null;
      })
      .filter(Boolean);
  } catch { return null; }
}
