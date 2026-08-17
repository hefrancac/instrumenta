import { CATALOG } from "../constants/catalog";

const KEY = "instrumenta:list";

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
