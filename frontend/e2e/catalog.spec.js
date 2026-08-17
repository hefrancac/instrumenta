import { test, expect } from "@playwright/test";

// Jornada do catálogo dinâmico: mocka o backend com um catálogo que tem uma keyword
// NOVA, conecta (dispara o sync -> IndexedDB), recarrega (offline-first aplica o cache)
// e verifica que o MATCHER LOCAL passou a reconhecer o produto novo.
test("catálogo dinâmico: sincroniza do backend e o matcher local reconhece o item novo", async ({ page }) => {
  const NEWKW = "e2etestkw";
  const catalog = {
    hash: "e2ehash-1",
    count: 1,
    items: [
      { id: "espelho", std: "Espelho Bucal Plano nº 5", cat: "Instrumental",
        kw: ["espelho", "bucal", NEWKW],
        brands: [{ name: "Golgran", prices: { cremer: 14.9, surya: 13.41, speed: 15.65 } }] },
    ],
  };

  // Mocks do backend (o app só precisa de health + catalog/hash + catalog).
  await page.route("**/health", (r) => r.fulfill({ json: { status: "ok", checks: {} } }));
  await page.route("**/api/v1/catalog/hash", (r) => r.fulfill({ json: { hash: catalog.hash } }));
  await page.route("**/api/v1/catalog", (r) => r.fulfill({ json: catalog }));

  await page.goto("/");

  // Conecta a um backend (mockado) — dispara syncCatalog -> grava no IndexedDB.
  await page.getByRole("button", { name: /conectar a um backend real/i }).click();
  await page.getByPlaceholder(/URL/i).fill("http://localhost:9999");
  await page.getByRole("button", { name: /^Conectar$/ }).click();
  await expect(page.getByText(/^Conectado$/)).toBeVisible();
  await page.waitForTimeout(1000); // deixa o sync gravar no IndexedDB

  // Recarrega SEM conectar: loadCachedCatalog aplica o catálogo cacheado (com a keyword nova).
  await page.reload();
  await page.waitForTimeout(1200);

  // Cola a keyword nova pelo caminho LOCAL (offline) — deve virar Espelho Bucal.
  await page.getByRole("button", { name: /colar a lista em texto/i }).click();
  const ta = page.locator("textarea").first();
  await ta.fill(NEWKW);
  await page.getByRole("button", { name: /Analisar esta lista/i }).click();
  await expect(page.getByText(/Confira sua lista/i)).toBeVisible();
  await expect(page.getByText(/Espelho Bucal/i)).toBeVisible();
});
