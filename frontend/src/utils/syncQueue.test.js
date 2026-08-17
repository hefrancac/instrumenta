import { describe, it, expect, beforeEach } from "vitest";

// localStorage não existe no ambiente node do Vitest — stub mínimo.
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

import { enqueue, drainQueue, queueSize, clearQueue, loadQueue } from "./syncQueue";

describe("syncQueue (fila offline→online)", () => {
  beforeEach(() => clearQueue());

  it("enfileira e drena tudo quando o envio dá certo", async () => {
    enqueue({ url: "/a", method: "PATCH", body: { x: 1 } });
    enqueue({ url: "/b", method: "PATCH", body: { y: 2 } });
    expect(queueSize()).toBe(2);
    const sent = [];
    const n = await drainQueue(async (a) => { sent.push(a.url); });
    expect(n).toBe(2);
    expect(queueSize()).toBe(0);
    expect(sent).toEqual(["/a", "/b"]);
  });

  it("squash: mescla ações repetidas na mesma url+método (uma entrada)", () => {
    enqueue({ url: "/item/1", method: "PATCH", body: { quantity: 2 } });
    enqueue({ url: "/item/1", method: "PATCH", body: { quantity: 5, owned: true } });
    expect(queueSize()).toBe(1);
    const [a] = loadQueue();
    expect(a.body).toEqual({ quantity: 5, owned: true });
  });

  it("mantém na fila as ações que falharem de novo", async () => {
    enqueue({ url: "/ok" });
    enqueue({ url: "/fail" });
    const n = await drainQueue(async (a) => { if (a.url === "/fail") throw new Error("sem rede"); });
    expect(n).toBe(1);
    expect(queueSize()).toBe(1);
  });
});
