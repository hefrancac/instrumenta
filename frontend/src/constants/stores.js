// Dentais reais com a URL de busca confirmada de cada uma (cai na página do produto).
export const STORES = [
  { id: "cremer", name: "Dental Cremer", color: "#245FA6", shipping: 24.9, free: 99, url: "https://www.dentalcremer.com.br", search: "https://www.dentalcremer.com.br/catalog_search/?term={q}" },
  { id: "surya", name: "Surya Dental", color: "#6D3AA6", shipping: 19.9, free: 129, url: "https://www.suryadental.com.br", search: "https://www.suryadental.com.br/search.html?query={q}" },
  { id: "speed", name: "Dental Speed", color: "#C85A2B", shipping: 27.9, free: 149, url: "https://www.dentalspeed.com", search: "https://www.dentalspeed.com/catalog_search/?term={q}" },
];
export const storeById = (id) => STORES.find((s) => s.id === id);
