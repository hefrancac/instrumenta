// Store do token JWT em localStorage + um emitter de "não autorizado" (401).
// Desacopla a camada de rede (useBackend) do AuthContext: o jget/jsend só lê o
// token e, em 401, emite — quem escuta (AuthContext) faz o logout.
const KEY = "instrumenta:token";
let listeners = [];

export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ }
};
export const clearToken = () => setToken(null);

export const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export const onUnauthorized = (fn) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
};
export const emitUnauthorized = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
