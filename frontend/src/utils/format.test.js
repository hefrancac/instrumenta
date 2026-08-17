import { describe, it, expect } from "vitest";
import { brl, norm, fresh, goUrl } from "./format";

describe("format", () => {
  it("brl formata em reais", () => {
    expect(brl(12.9)).toContain("12,90");
  });

  it("norm remove acentos e pontuação", () => {
    expect(norm("Pinça Clínica nº5!")).toBe("pinca clinica n 5");
  });

  it("fresh descreve o frescor do preço", () => {
    expect(fresh(1)).toContain("agora");
    expect(fresh(5)).toContain("5h");
  });

  it("goUrl usa a busca real da loja (sem afiliado)", () => {
    const store = { name: "X", search: "https://x.com/busca?q={q}" };
    expect(goUrl(store, { std: "Espelho Bucal" })).toBe("https://x.com/busca?q=Espelho%20Bucal");
  });

  it("goUrl cai na home se a loja não tem busca", () => {
    expect(goUrl({ url: "https://x.com" }, { std: "Y" })).toBe("https://x.com");
  });
});
