import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiV1 } from "../utils/apiBase";
import { getToken, setToken, clearToken, onUnauthorized } from "../utils/authToken";

const AuthContext = createContext(null);

async function fetchMe(token) {
  const r = await fetch(`${apiV1()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("me");
  return r.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  // Restaura a sessão a partir do token salvo (busca /me na inicialização).
  useEffect(() => {
    const t = getToken();
    if (!t) { setLoading(false); return; }
    fetchMe(t)
      .then(setUser)
      .catch(() => { clearToken(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  // 401 em qualquer requisição (via useBackend) -> desloga.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = useCallback(async (email, password) => {
    const r = await fetch(`${apiV1()}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
    if (!r.ok) throw new Error("Credenciais inválidas.");
    const { access_token } = await r.json();
    setToken(access_token);
    const me = await fetchMe(access_token);
    setUser(me);   // a sincronização das listas (push local + pull nuvem) é feita pelo useLists ao ficar logado
    return me;
  }, []);

  const register = useCallback(async (email, password) => {
    const r = await fetch(`${apiV1()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error(r.status === 409 ? "E-mail já cadastrado." : "Não foi possível cadastrar.");
    return login(email, password);
  }, [login]);

  const logout = useCallback(() => { clearToken(); setUser(null); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
