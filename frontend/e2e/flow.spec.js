import { test, expect } from "@playwright/test";

// Jornada principal do usuário: colar a lista de exemplo, analisar, revisar e
// chegar aos resultados com preços. Garante que refatorações não quebrem o funil.
test("funil: colar SAMPLE → analisar → revisar → resultados com preços", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Do quadro ao carrinho/i)).toBeVisible();

  // Abre o campo de colar texto (já vem preenchido com a lista de exemplo).
  await page.getByRole("button", { name: /colar a lista em texto/i }).click();
  await page.getByRole("button", { name: /Analisar esta lista/i }).click();

  // Processamento → tela de revisão.
  await expect(page.getByText(/Confira sua lista/i)).toBeVisible();
  await expect(page.getByText(/itens reconhecidos/i)).toBeVisible();

  // Avança para os resultados.
  await page.getByRole("button", { name: /Ver melhores preços/i }).click();
  await expect(page.getByText(/Melhores preços/i)).toBeVisible();

  // Apareceu ao menos um preço em reais.
  await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible();
});

test("demonstração leva aos resultados", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ver demonstração/i }).click();
  await expect(page.getByText(/Confira sua lista/i)).toBeVisible();
  await page.getByRole("button", { name: /Ver melhores preços/i }).click();
  await expect(page.getByText(/Melhores preços/i)).toBeVisible();
});

test("resiliência offline: rede cai, cola a lista e ainda chega aos resultados", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText(/Do quadro ao carrinho/i)).toBeVisible();

  // Derruba a rede — o app deve seguir funcionando pelo motor local.
  await context.setOffline(true);
  await page.getByRole("button", { name: /colar a lista em texto/i }).click();
  await page.getByRole("button", { name: /Analisar esta lista/i }).click();
  await expect(page.getByText(/Confira sua lista/i)).toBeVisible();
  await page.getByRole("button", { name: /Ver melhores preços/i }).click();
  await expect(page.getByText(/Melhores preços/i)).toBeVisible();
  await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible();

  await context.setOffline(false);
});
