import { loadCollection } from "./persist";
import { apiV1 } from "./apiBase";
import { authHeader } from "./authToken";
import { CATALOG } from "../constants/catalog";
import { cheapestBrandIndex } from "./engine";

// Mapeia os itens da API (raw_name/standard_name/…) para o shape do frontend,
// reconstruindo marcas/preços a partir do catálogo (mesma lógica do useBackend).
// `listCloudId` marca a qual lista de nuvem o item pertence — o patchRemote usa
// isso para sincronizar edições (qtd/marca/owned) ao vivo.
export function mapApiItems(apiItems = [], listCloudId = null) {
  return apiItems.map((ri) => {
    const c = CATALOG.find((x) => x.std === ri.standard_name);
    let brands, brandIndex;
    if (c) {
      brands = c.brands;
      const idx = c.brands.findIndex((b) => b.name === ri.brand);
      brandIndex = idx >= 0 ? idx : cheapestBrandIndex(c);
    } else {
      brands = [{ name: ri.brand || "—", prices: {} }];
      brandIndex = 0;
    }
    return { uid: `r${ri.id}`, remoteId: ri.id, listCloudId, catId: c?.id || `r${ri.id}`, raw: ri.raw_name,
      std: ri.standard_name, cat: ri.category || c?.cat || "Material", brands, brandIndex,
      owned: !!ri.owned, qty: ri.quantity || 1 };
  });
}

// Sobe as listas locais para a nuvem (backup), com o NOME e uma X-Idempotency-Key
// estável por lista — re-executar não duplica.
export async function pushLocalLists() {
  const lists = loadCollection()?.lists || [];
  let synced = 0;
  for (const list of lists) {
    const text = (list.items || []).map((i) => i.raw || i.std).filter(Boolean).join("\n");
    if (!text.trim()) continue;
    try {
      const r = await fetch(`${apiV1()}/lists/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(), "X-Idempotency-Key": `local-list-${list.id}` },
        body: JSON.stringify({ text, name: list.name }),
      });
      if (r.ok) synced++;
    } catch { /* sem rede: fica para a próxima */ }
  }
  return { synced };
}

// Baixa as listas da nuvem (metadados + itens) já no shape do frontend.
export async function pullCloudLists() {
  try {
    const summaries = await fetch(`${apiV1()}/lists`, { headers: authHeader() }).then((r) => (r.ok ? r.json() : []));
    const out = [];
    for (const s of summaries) {
      try {
        const detail = await fetch(`${apiV1()}/lists/${s.id}`, { headers: authHeader() }).then((r) => (r.ok ? r.json() : null));
        if (detail) out.push({ id: `cloud-${s.id}`, cloudId: s.id, name: detail.name || s.name, items: mapApiItems(detail.items, s.id), updatedAt: Date.now() });
      } catch { /* pula esta lista */ }
    }
    return out;
  } catch { return []; }
}

// Compat: alias antigo (usado antes) — hoje o useLists orquestra push + pull.
export const syncLocalListsToCloud = pushLocalLists;
