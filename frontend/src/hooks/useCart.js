import { useReducer } from "react";
import { CATALOG } from "../constants/catalog";
import { cheapestBrandIndex } from "../utils/engine";

// Reducer puro: cada operação da lista é uma ação isolada (sem lógica espalhada).
function reducer(items, a) {
  switch (a.type) {
    case "SET_ITEMS":
      return typeof a.value === "function" ? a.value(items) : a.value;
    case "SET_BRAND":
      return items.map((it) => (it.uid === a.uid ? { ...it, brandIndex: a.bi } : it));
    case "TOGGLE_OWNED":
      return items.map((it) => (it.uid === a.uid ? { ...it, owned: !it.owned } : it));
    case "SET_QTY":
      return items.map((it) =>
        it.uid === a.uid ? { ...it, qty: Math.min(99, Math.max(1, (it.qty || 1) + a.d)) } : it);
    case "REMOVE":
      return items.filter((it) => it.uid !== a.uid);
    case "SET_PRODUCT": {
      const c = CATALOG.find((x) => x.id === a.catId);
      if (!c) return items;
      return items.map((it) =>
        it.uid === a.uid
          ? { ...it, catId: c.id, std: c.std, cat: c.cat, brands: c.brands, brandIndex: cheapestBrandIndex(c) }
          : it);
    }
    default:
      return items;
  }
}

// Estado da lista + mutações. `patchRemote` (efeito colateral) fica FORA do reducer,
// nos wrappers, para o reducer permanecer puro. Injetado pelo App p/ sincronizar backend.
export function useCart(patchRemote = () => {}) {
  const [items, dispatch] = useReducer(reducer, []);

  const setItems = (value) => dispatch({ type: "SET_ITEMS", value });
  const find = (uid) => items.find((x) => x.uid === uid);

  const setBrand = (uid, bi) => {
    const it = find(uid); if (it) patchRemote(it, { brand: it.brands[bi]?.name });
    dispatch({ type: "SET_BRAND", uid, bi });
  };
  const toggleOwned = (uid) => {
    const it = find(uid); if (it) patchRemote(it, { owned: !it.owned });
    dispatch({ type: "TOGGLE_OWNED", uid });
  };
  const setQty = (uid, d) => {
    const it = find(uid);
    if (it) patchRemote(it, { quantity: Math.min(99, Math.max(1, (it.qty || 1) + d)) });
    dispatch({ type: "SET_QTY", uid, d });
  };
  const remove = (uid) => dispatch({ type: "REMOVE", uid });
  const setProduct = (uid, catId) => {
    const it = find(uid); const c = CATALOG.find((x) => x.id === catId);
    if (it && c) patchRemote(it, { standard_name: c.std });
    dispatch({ type: "SET_PRODUCT", uid, catId });
  };

  return { items, setItems, setBrand, toggleOwned, setQty, remove, setProduct };
}
