import { useState, useEffect } from "react";
import { loadCollection, persistCollection, newId } from "../utils/persist";
import { pushLocalLists, pullCloudLists } from "../utils/cloudSync";
import { apiV1 } from "../utils/apiBase";
import { authHeader } from "../utils/authToken";

// Gerencia a coleção de listas nomeadas (Dentística, Endodontia, …).
// Local-first (localStorage). Quando `authed` fica true, faz backup das listas
// locais na nuvem e baixa as do usuário (persistem entre dispositivos); rename e
// delete de listas de nuvem (com cloudId) são espelhados na API.
export function useLists(setItems, authed = false) {
  const [col, setCol] = useState(() => loadCollection());
  useEffect(() => { if (col) persistCollection(col); }, [col]);

  const lists = col?.lists || [];
  const activeId = col?.activeId || null;
  const active = lists.find((l) => l.id === activeId) || null;
  const cloudIdOf = (id) => lists.find((l) => l.id === id)?.cloudId || null;

  // Sincroniza no login: sobe as locais (backup) e desce as da nuvem. O flag `alive`
  // ignora o resultado de um mount que já foi desmontado (double-mount do StrictMode),
  // garantindo que a instância montada aplique a coleção da nuvem.
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    (async () => {
      await pushLocalLists();
      const cloud = await pullCloudLists();
      if (alive && cloud.length) {
        setCol({ v: 1, activeId: cloud[0].id, lists: cloud });
        setItems(cloud[0].items);
      }
    })().catch(() => {});
    return () => { alive = false; };
  }, [authed]); // eslint-disable-line

  const saveActive = (items) => setCol((c) => {
    if (!c) {
      const id = newId();
      return { v: 1, activeId: id, lists: [{ id, name: "Minha lista", items, updatedAt: Date.now() }] };
    }
    return { ...c, lists: c.lists.map((l) => (l.id === c.activeId ? { ...l, items, updatedAt: Date.now() } : l)) };
  });

  const switchTo = (id) => {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    setItems(l.items);
    setCol((c) => ({ ...c, activeId: id }));
  };

  const createList = (name) => {
    const id = newId();
    setItems([]);
    setCol((c) => {
      const base = c || { v: 1, activeId: null, lists: [] };
      return { ...base, activeId: id, lists: [...base.lists, { id, name: name || "Nova lista", items: [], updatedAt: Date.now() }] };
    });
    return id;
  };

  const saveAsNew = (name, items) => {
    const id = newId();
    setCol((c) => {
      const base = c || { v: 1, activeId: null, lists: [] };
      return { ...base, activeId: id, lists: [...base.lists, { id, name: name || "Cópia", items, updatedAt: Date.now() }] };
    });
    return id;
  };

  const rename = (id, name) => {
    setCol((c) => ({ ...c, lists: c.lists.map((l) => (l.id === id ? { ...l, name } : l)) }));
    const cid = cloudIdOf(id);
    if (authed && cid) {
      fetch(`${apiV1()}/lists/${cid}`, { method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ name }) }).catch(() => {});
    }
  };

  const removeList = (id) => {
    const cid = cloudIdOf(id);
    const rest = lists.filter((l) => l.id !== id);
    if (activeId === id) setItems(rest[0]?.items || []);
    setCol((c) => ({ ...c, activeId: c.activeId === id ? (rest[0]?.id || null) : c.activeId, lists: rest }));
    if (authed && cid) {
      fetch(`${apiV1()}/lists/${cid}`, { method: "DELETE", headers: authHeader() }).catch(() => {});
    }
  };

  return { lists, activeId, activeName: active?.name || null, activeItems: active?.items || [], saveActive, switchTo, createList, saveAsNew, rename, removeList };
}
