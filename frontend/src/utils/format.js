// Formatação e helpers de texto puros.
export const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fresh = (h) => (h <= 1 ? "verificado agora há pouco" : `verificado há ~${h}h`);

export const goUrl = (store, it) => {
  // Busca REAL da loja (confirmada por loja) — cai na página do produto, sem afiliado.
  // Usa o nome canônico completo do produto. Com scraping/feed, troca pela URL exata (offer.url).
  const term = (it?.std || "").trim();
  return store?.search ? store.search.replace("{q}", encodeURIComponent(term)) : (store?.url || "#");
};

export const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
