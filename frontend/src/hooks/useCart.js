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

// Estado da lista — 100% puro: só transições Estado A -> Estado B, sem nenhum
// efeito colateral de rede. A sincronização com o backend vive em useCartSync.
export function useCart() {
  const [items, dispatch] = useReducer(reducer, []);
  return {
    items,
    setItems: (value) => dispatch({ type: "SET_ITEMS", value }),
    setBrand: (uid, bi) => dispatch({ type: "SET_BRAND", uid, bi }),
    toggleOwned: (uid) => dispatch({ type: "TOGGLE_OWNED", uid }),
    setQty: (uid, d) => dispatch({ type: "SET_QTY", uid, d }),
    remove: (uid) => dispatch({ type: "REMOVE", uid }),
    setProduct: (uid, catId) => dispatch({ type: "SET_PRODUCT", uid, catId }),
  };
}
