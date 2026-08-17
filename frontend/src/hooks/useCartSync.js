import { useRef, useEffect } from "react";
import { CATALOG } from "../constants/catalog";

// Casa o estado local (useCart, puro) com o efeito de rede (patchRemote), mantendo
// o reducer 100% puro. Agrupa (debounce + merge) as mudanças por item: 5 cliques no
// "+" viram UM PATCH com o valor final, evitando enxurrada de requisições e races.
export function useCartSync(cart, patchRemote, delay = 500) {
  const pending = useRef(new Map());   // uid -> { item, patch }
  const timers = useRef(new Map());    // uid -> timeoutId
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const flush = (uid) => {
    const p = pending.current.get(uid);
    pending.current.delete(uid);
    timers.current.delete(uid);
    if (p) patchRemote(p.item, p.patch);
  };
  const queue = (uid, item, patch) => {
    const prev = pending.current.get(uid);
    pending.current.set(uid, { item, patch: { ...(prev?.patch || {}), ...patch } });
    clearTimeout(timers.current.get(uid));
    timers.current.set(uid, setTimeout(() => flush(uid), delay));
  };

  const find = (uid) => cart.items.find((x) => x.uid === uid);
  return {
    ...cart,
    setBrand: (uid, bi) => {
      const it = find(uid);
      if (it) queue(uid, it, { brand: it.brands[bi]?.name });
      cart.setBrand(uid, bi);
    },
    toggleOwned: (uid) => {
      const it = find(uid);
      if (it) queue(uid, it, { owned: !it.owned });
      cart.toggleOwned(uid);
    },
    setQty: (uid, d) => {
      const it = find(uid);
      if (it) queue(uid, it, { quantity: Math.min(99, Math.max(1, (it.qty || 1) + d)) });
      cart.setQty(uid, d);
    },
    setProduct: (uid, catId) => {
      const it = find(uid);
      const c = CATALOG.find((x) => x.id === catId);
      if (it && c) queue(uid, it, { standard_name: c.std });
      cart.setProduct(uid, catId);
    },
  };
}
