import { describe, it, expect } from "vitest";
import { parseList, optimize, editDistance, fuzzyMatch } from "./engine";

describe("editDistance (Damerau-Levenshtein OSA)", () => {
  it("é 0 para strings iguais", () => expect(editDistance("resina", "resina")).toBe(0));
  it("conta transposição adjacente como 1", () => expect(editDistance("resian", "resina")).toBe(1));
  it("conta uma letra faltando como 1", () => expect(editDistance("espeho", "espelho")).toBe(1));
  it("conta 'madura'→'madeira' como 2 (não deve casar)", () => expect(editDistance("madura", "madeira")).toBe(2));
});

describe("fuzzyMatch (Plano B — tolerância a erro de digitação)", () => {
  it("reconhece 'escavdor' como Escavador (Plano A falha, B acerta)", () => {
    expect(fuzzyMatch("escavdor").std).toMatch(/Escavador/);
  });
  it("reconhece 'tesora' como Tesoura", () => {
    expect(fuzzyMatch("tesora").std).toMatch(/Tesoura/);
  });
  it("reconhece 'porta agulla' como Porta-Agulha", () => {
    expect(fuzzyMatch("porta agulla").std).toMatch(/Porta-Agulha/);
  });
  it("desempata 'porta agulla' para Porta-Agulha (não Porta-Grampo)", () => {
    const { matched } = parseList("porta agulla");
    expect(matched).toHaveLength(1);
    expect(matched[0].std).toMatch(/Porta-Agulha/);
  });
  it("NÃO casa texto não-odontológico (guarda de falso positivo)", () => {
    expect(fuzzyMatch("carro vermelho")).toBeNull();
    expect(fuzzyMatch("banana madura")).toBeNull();
    expect(fuzzyMatch("notebook novo")).toBeNull();
  });
  it("integra no parseList: linha com typo vira item reconhecido", () => {
    const { matched, unmatched } = parseList("escavdor");
    expect(matched).toHaveLength(1);
    expect(matched[0].std).toMatch(/Escavador/);
    expect(unmatched).toHaveLength(0);
  });
});

describe("siglas odontológicas curtas (allowlist)", () => {
  it("reconhece 'civ' como Ionômero de Vidro", () => {
    const { matched } = parseList("civ");
    expect(matched).toHaveLength(1);
    expect(matched[0].std).toMatch(/Ionômero/);
  });
  it("fuzzy aceita a sigla curta permitida (não barra por tamanho < 4)", () => {
    expect(fuzzyMatch("civ")?.std).toMatch(/Ionômero/);
  });
  it("segue barrando ruído curto NÃO allowlistado", () => {
    expect(fuzzyMatch("xkq")).toBeNull();
  });
});

describe("parseList", () => {
  it("reconhece um item conhecido", () => {
    const { matched } = parseList("espelho bucal n5");
    expect(matched).toHaveLength(1);
    expect(matched[0].std).toBe("Espelho Bucal Plano nº 5");
  });

  it("descarta apenas linha duplicada exata", () => {
    const { matched } = parseList("espelho bucal\nespelho bucal");
    expect(matched.filter((m) => m.catId === "espelho")).toHaveLength(1);
  });

  it("mantém linhas distintas que casam o mesmo produto (limas)", () => {
    const { matched } = parseList("caixa de lima 08\ncaixa de lima 10\ncaixa de lima 15");
    expect(matched.filter((m) => m.catId === "lima-endo")).toHaveLength(3);
  });

  it("herda o título para linhas só-código (pontas diamantadas)", () => {
    const { matched } = parseList("Pontas diamantadas para alta rotação:-1014F\n-4138F\n-3168F");
    expect(matched).toHaveLength(3);
    expect(matched.every((m) => m.catId === "ponta-diam")).toBe(true);
  });

  it("texto não-odontológico não casa nada", () => {
    const { matched } = parseList("carro vermelho\nbanana madura\nnotebook novo");
    expect(matched).toHaveLength(0);
  });

  it("lê a quantidade de um '(10)' no meio da linha", () => {
    const { matched } = parseList("Tiras de lixas de acabamento de resina (10)");
    expect(matched[0].qty).toBe(10);
  });

  it("pula cabeçalhos de seção", () => {
    const { matched } = parseList("Prótese:\nespelho bucal n5");
    expect(matched).toHaveLength(1);
  });
});

describe("optimize", () => {
  const build = (text) => parseList(text).matched;

  it("consolida itens repetidos somando a quantidade", () => {
    const opt = optimize(build("caixa de lima 08\ncaixa de lima 10\ncaixa de lima 15"));
    expect(opt.active).toHaveLength(1);
    expect(opt.active[0].qty).toBe(3);
  });

  it("retorna ranking de loja única e distribuição multi-loja", () => {
    const opt = optimize(build("espelho bucal n5\nresina z350 a2\nsonda exploradora n5"));
    expect(opt.ranking.length).toBeGreaterThan(0);
    expect(opt.multi.groups.length).toBeGreaterThan(0);
    expect(typeof opt.recommendMulti).toBe("boolean");
    expect(opt.baseSingleTotal).toBeGreaterThan(0);
  });

  it("ignora itens marcados como 'já tenho'", () => {
    const items = build("espelho bucal n5\nresina z350 a2");
    items[0].owned = true;
    const opt = optimize(items);
    expect(opt.active).toHaveLength(1);
  });
});
