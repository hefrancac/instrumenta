import { describe, it, expect } from "vitest";
import { encodeList, decodeList } from "./persist";

describe("encode/decodeList (compartilhar por link)", () => {
  it("faz round-trip da lista", () => {
    const items = [
      { catId: "espelho", qty: 2, brandIndex: 1, owned: false },
      { catId: "resina", qty: 1, brandIndex: 0, owned: true },
    ];
    const decoded = decodeList(encodeList(items));
    expect(decoded).toHaveLength(2);
    expect(decoded[0].catId).toBe("espelho");
    expect(decoded[0].qty).toBe(2);
    expect(decoded[0].brandIndex).toBe(1);
    expect(decoded[0].std).toBe("Espelho Bucal Plano nº 5");
    expect(decoded[1].owned).toBe(true);
  });

  it("ignora catId que não existe no catálogo", () => {
    expect(decodeList(encodeList([{ catId: "naoexiste", qty: 1 }]))).toHaveLength(0);
  });

  it("retorna null em base64 inválido", () => {
    expect(decodeList("@@@nao-base64@@@")).toBeNull();
  });
});
