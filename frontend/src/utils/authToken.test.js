import { describe, it, expect, beforeEach } from "vitest";

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

import { getToken, setToken, clearToken, authHeader, onUnauthorized, emitUnauthorized } from "./authToken";

describe("authToken", () => {
  beforeEach(() => clearToken());

  it("salva/lê/limpa o token", () => {
    expect(getToken()).toBeNull();
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("monta o header Authorization só quando há token", () => {
    expect(authHeader()).toEqual({});
    setToken("t0ken");
    expect(authHeader()).toEqual({ Authorization: "Bearer t0ken" });
  });

  it("emitUnauthorized notifica os assinantes e o unsubscribe funciona", () => {
    let hits = 0;
    const off = onUnauthorized(() => { hits++; });
    emitUnauthorized();
    expect(hits).toBe(1);
    off();
    emitUnauthorized();
    expect(hits).toBe(1);
  });
});
