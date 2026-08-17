// URL do backend real (produção). Defina VITE_API_URL no build/ambiente
// (ex.: VITE_API_URL=https://instrumenta-api.onrender.com). Vazio = mesmo host.
export const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "");
export const apiV1 = () => `${API_BASE}/api/v1`;
