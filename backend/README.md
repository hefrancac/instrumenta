# Instrumenta — Backend

Backend de padrão de produção para o Instrumenta: recebe a lista de materiais de
odontologia (foto, PDF ou texto), **padroniza a nomenclatura**, faz o **scraping**
de preços nas dentais com cache, e devolve a **compra otimizada** já contando o
frete — em duas rotas: **loja única** e **melhor preço (multi-loja)**.

FastAPI · SQLAlchemy 2 · Postgres · Celery · Redis · Playwright · Anthropic (opcional)

---

## O que mudou em relação ao esqueleto original

| Área | Antes | Agora |
| --- | --- | --- |
| Padronização (IA) | lista fixa hardcoded | Anthropic (visão p/ foto e PDF) **+ fallback** local por palavras-chave |
| Otimização | só loja única, sem frete | loja única *e* multi-loja, **ambas com frete**, cobertura e economia |
| Scraping | `time.sleep()` placeholder | **Dental Cremer ligada de verdade via API pública VTEX (JSON: preço/EAN/estoque)**; Playwright/Feed como alternativa; cache com TTL; ferramenta de calibração |
| Progresso | nenhum | modelo `Job` + endpoint de status para o front acompanhar |
| Auth | nenhuma | JWT (registro/login) + bcrypt, com **modo demo** p/ o front rodar sem login |
| Config | env solto | `pydantic-settings` tipado, `.env.example`, segredos fora do código |
| Dados | 4 tabelas rasas | `Store` (frete), marca/owned no item, cache com marca/estoque/imagem, `Job` |
| Qualidade | — | logging estruturado, request-id, handlers de erro, health/readiness, rate limit, **testes**, Alembic, Docker não-root com healthcheck |

---

## Quatro aprimoramentos (v2)

Um segundo ciclo focado em precisão, confiança e monetização. A lógica pura
(otimizador e casamento) é coberta por testes.

**1 · Frete grátis por valor + otimizador inteligente.**
Cada loja tem `free_shipping_threshold` ("frete grátis acima de R$X"). Isso
inverte a otimização: às vezes concentrar o pedido numa loja para atingir o
piso e zerar o frete sai mais barato que pulverizar pelo menor preço unitário.
O otimizador multi-loja resolve esse trade-off por **enumeração de subconjuntos
de lojas + busca local** (mover itens isolados quando reduz o total), tudo
ciente de **quantidade** por item. Testes decisivos garantem o ótimo nos casos
de consolidação (`app/services/optimizer.py`).

**2 · Casamento de produto com confiança.**
O difícil não é padronizar o nome, é casar o anúncio real da loja ("Sonda
Exploradora Nº 5 Duflex Ref 1234") com o produto canônico, com confiança.
`app/services/product_matching.py` usa **EAN/GTIN como chave autoritativa**
(confiança 1.0) e, na ausência dele, **similaridade de tokens** (palavras-chave
+ nome + marca) com faixas de *aceite* / *revisão*. Casamentos ambíguos entram
numa **fila de revisão humana** (`ProductMatchReview`, endpoints `/admin/reviews`);
ofertas de baixa confiança ficam **fora dos resultados** — preço errado é pior
que lacuna.

**3 · Confiança: frescor de preço + monitoramento de scraper.**
Cada oferta carrega a idade do preço (o front mostra "verificado há Xh"). Cada
execução de scraper grava um `ScrapeRun`; **zero resultados viram alerta**
(seletor provavelmente quebrado) em vez de carrinho vazio silencioso.
`/admin/scraper-health` mostra taxa de sucesso / zero-resultados por loja e
marca a loja como `degraded`. Há `FeedScraper` (base) para **feeds de produto**,
preferíveis a scraping onde a loja publica um. Bônus: **watchdog** que encerra
jobs travados (`reap_stuck_jobs`).

**4 · Frontend↔backend + monetização.**
`/go/{offer_id}` registra o clique (`Click`) e redireciona para a **URL de
afiliado** da loja (`app/services/affiliate.py`) — todo hand-off é mensurável.
Listas viram **link público** compartilhável (`share_token`, `/share/{token}`),
e **quantidade** por item percorre toda a stack (schema → PATCH → otimizador).

---

```
                         ┌─────────────────────────────────────────────┐
   foto / pdf / texto    │                  API (FastAPI)               │
  ───────────────────►   │  /auth  /lists  /cart   + /health  /docs     │
                         └───┬───────────────┬───────────────┬─────────┘
                             │ padroniza      │ status/patch  │ optimize
                    ai_service│(Anthropic ▸    │               │ pricing ▸ optimizer
                     ▸matcher │ fallback local)│               │ (frete-aware)
                             ▼                ▼               ▼
                   ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
                   │ extracted_   │   │    jobs      │  │product_cache │
                   │   items      │   │ (progresso)  │  │  (com TTL)   │
                   └──────────────┘   └──────┬───────┘  └──────▲───────┘
                                             │ fan-out          │ upsert
                                      ┌──────▼───────────────────┴──────┐
                                      │        Worker (Celery)          │
                                      │ process_list ▸ scrape_item ▸    │
                                      │ finalize_list   (Playwright)    │
                                      └───────────────┬─────────────────┘
                                                      │ broker/result
                                                  ┌───▼───┐   ┌──────────┐
                                                  │ Redis │   │ Postgres │
                                                  └───────┘   └──────────┘
```

**Fluxo:** `upload` cria a lista + `Job` e dispara `process_list`. O worker abre um
scrape por item (pulando o que está fresco no cache), grava em `product_cache` e
incrementa o `Job`. O front dá *poll* em `/status` até `done` e então chama
`/cart/optimize`, que roda o otimizador ciente de frete sobre o cache.

---

## Correções de núcleo (v3): preço por unidade + frete por CEP

Dois ajustes que corrigem a *precisão* da recomendação (não são polimento — sem
eles a resposta "ótima" pode estar errada no Brasil real). A lógica pura é coberta
por testes (`test_units.py`, `test_shipping.py` e novos casos em `test_optimizer.py`).

**1. Preço por unidade / compra de pacotes inteiros** (`app/services/units.py`)
Um anúncio pode ser "caixa com 24", "kit", ou avulso. Comparar por preço de
etiqueta é enganoso. Agora cada oferta carrega `pack_qty` (quantas unidades-base
o anúncio contém) e `unit_price`. O otimizador:
- **compra pacotes inteiros**: para *N* unidades e embalagem de *P*, compra
  `ceil(N/P)` caixas (não dá pra comprar meia caixa);
- **compara por preço/unidade**, de forma justa entre marcas e lojas.
O parser é *keyword-gated* — "nº 5", "z350", "4-0", "37%" nunca são lidos como
contagem de embalagem. Ex.: 30 suturas com caixa de 24 → 2 caixas, preço/un exibido.

**2. Frete por CEP + peso** (`app/services/shipping.py`)
Frete fixo por loja recomenda a loja errada para quem mora longe. Agora:
`frete = (base_da_loja + custo_por_kg × peso) × multiplicador_regional`, com o
multiplicador derivado do **CEP de destino** (SP 1.0 → Norte 1.75) e o piso de
**frete grátis** ainda zerando o frete. Como o frete passa a depender do peso
alocado a cada loja, o otimizador multi-loja **reavalia o frete por plano**.
Cada produto tem um peso de envio (`PRODUCT_WEIGHT_G`); cada loja, um `ship_per_kg`.

Uso na API: `GET /api/v1/cart/optimize/{id}?cep=69010-000`. O CEP é **persistido na
lista**, então um link compartilhado herda o destino. A resposta traz
`destination_region`, e cada linha traz `pack_qty`, `packs`, `unit_price`.

**Frontend em modo backend (integração real).** O `Instrumenta.jsx` agora tem um
painel **"conectar a um backend real"** (URL + CEP). Conectado, ele roda o fluxo
ponta a ponta contra a API: cria a lista (`/lists/text`), acompanha o scraping
(`/status`), revisa os itens vindos da API, **edita via PATCH** (marca/quantidade/
"já tenho"), otimiza com o CEP e manda "Ir para a loja" pelo `/go/{offer_id}`.
Se o backend não responder, faz **fallback automático** para o motor local — então
a demonstração funciona mesmo sem servidor. Ver também `frontend/apiClient.js`
(`health`, `optimizeAndAdapt(listId, cep)`, `goUrl(offerId)`).

---

## Quickstart (Docker)

```bash
cp .env.example .env          # ajuste JWT_SECRET; ANTHROPIC_API_KEY é opcional
docker compose up --build     # api :8000, worker, postgres, redis
```

- Docs interativas: <http://localhost:8000/docs>
- Sem `ANTHROPIC_API_KEY`, a padronização usa o matcher local. Sem `SCRAPER_MODE=live`,
  o worker usa o catálogo semeado (dados realistas) — a pipeline inteira funciona
  offline para desenvolvimento e demonstração.

### Sem Docker

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# suba Postgres e Redis, ajuste DATABASE_URL/REDIS_URL no .env
uvicorn app.main:app --reload
celery -A worker.celery_app worker --loglevel=info   # em outro terminal
```

---

## API (prefixo `/api/v1`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/auth/register` | cria usuário (email + senha) |
| `POST` | `/auth/login` | OAuth2 password → `access_token` (JWT) |
| `POST` | `/lists/upload` | envia arquivo (texto/imagem/PDF) → lista + itens padronizados |
| `POST` | `/lists/text` | envia a lista como texto (fluxo "colar lista") |
| `GET` | `/lists/{id}` | detalhes da lista e itens |
| `GET` | `/lists/{id}/status` | progresso do scraping (`status`, `progress`) |
| `PATCH` | `/lists/{id}/items/{item_id}` | edita marca / "já tenho" / **quantidade** |
| `GET` | `/cart/optimize/{id}` | compra otimizada (loja única + multi-loja), **ciente de frete grátis, quantidade e frescor** |
| `POST` | `/lists/{id}/share` | gera link público read-only (`share_token`) |
| `GET` | `/share/{token}` | compra otimizada pública (sem auth) para compartilhar |
| `GET` | `/go/{offer_id}` | registra clique e redireciona para a loja (link de afiliado) |
| `GET` | `/admin/reviews` | fila de casamentos ambíguos p/ revisão humana |
| `POST` | `/admin/reviews/{id}/resolve` | aprova/rejeita um casamento |
| `GET` | `/admin/scraper-health` | saúde dos scrapers (taxa de sucesso, zero-resultados) |
| `GET` | `/health` | readiness (Postgres/Redis) |

Em **modo demo** (`DEMO_MODE=true`) as rotas aceitam requisições sem token,
usando um usuário demo — o front funciona sem tela de login. Em produção,
desligue o modo demo e envie `Authorization: Bearer <token>`.

Exemplo:

```bash
LIST=$(curl -s localhost:8000/api/v1/lists/text \
  -H 'content-type: application/json' \
  -d '{"text":"espelho bucal n5\nresina z350 A2\nporta agulha mayo hegar"}' | jq .list_id)
curl -s localhost:8000/api/v1/cart/optimize/$LIST | jq '.recommend, .savings'
```

---

## Scraper real (VTEX) — a primeira dental de verdade

As grandes dentais brasileiras rodam em **VTEX**, que expõe o mesmo endpoint de
catálogo que a própria vitrine chama:

```
GET https://{host}/api/catalog_system/pub/products/search/?ft={termo}&sc={sc}
```

Ele devolve **JSON estruturado** — preço, EAN/GTIN, estoque e marca por SKU — então
não raspamos HTML, não enfrentamos anti-bot e não dependemos de seletores CSS
frágeis. **Dental Cremer** já está ligada por esse caminho (`worker/scrapers/vtex.py`
+ `cremer.py`). Cada SKU vira um `RawListing` e passa pelo mesmo casamento +
parsing de embalagem de todas as fontes.

**Validar/ligar uma loja em segundos** — antes de habilitar em produção (e sempre
que uma loja puder ter mudado), rode a ferramenta de calibração:

```
python scripts/probe_vtex.py www.dentalcremer.com.br "espelho bucal"
```

Ela mostra o que voltou (preço, EAN, estoque) e **quantos itens casaram com o
catálogo**, com a confiança de cada um — pegando qualquer mudança na hora.

**Adicionar outra dental VTEX** — subclasse de `VtexScraper` com `host`/`sales_channel`
(confirmados via probe) e registre em `registry.py → LIVE_SCRAPERS`:

```python
class DentalSpeedScraper(VtexScraper):
    store_id = "speed"; store_name = "Dental Speed"
    host = "www.dentalspeed.com"; sales_channel = 1
```

Rode com `SCRAPER_MODE=live` e acompanhe `/admin/scraper-health` (zero-resultados
viram alerta — nunca um carrinho vazio silencioso). Loja fora da VTEX? O
`BaseScraper` (Playwright) e o `FeedScraper` continuam disponíveis como alternativa.

**Testado offline.** `parse_vtex_products()` é puro e coberto por `tests/test_vtex.py`
contra uma fixture real (`worker/scrapers/fixtures/vtex_search_sample.json`) — a
lógica de parsing/estoque/embalagem é verificada sem rede. O `fetch` é injetável
(testes passam a fixture; produção usa `urllib` da stdlib, zero dependências).

**Responsabilidade.** O endpoint público é o que a própria loja usa, mas respeite
os **Termos de Uso** e o robots de cada dental; para escala, o ideal é um acordo de
afiliado/dados. O scraper já se identifica por `User-Agent` e faz rate limit.

**Próximo passo (frete real).** A VTEX também expõe a simulação de checkout
(`POST /api/checkout/pub/orderForms/simulation`) com `postalCode` + itens, que
devolve o **frete real por CEP e por loja** — pode substituir a estimativa por
peso/região do `shipping.py` pela cotação real, seguindo o mesmo padrão
(parser puro + fetch injetável + fixture).

---

## Testes

```bash
pytest                      # ou: docker compose exec api pytest
```

- `test_optimizer.py` — otimizador puro: frete grátis, quantidade, consolidação, **embalagem (pacotes inteiros) e frete por CEP/peso**.
- `test_matcher.py` — padronização da lista do aluno (linha → canônico).
- `test_product_matching.py` — casamento anúncio→canônico: EAN, faixas de confiança, revisão.
- `test_units.py` — parsing de embalagem ("caixa com 24", kit) e preço por unidade.
- `test_shipping.py` — região por CEP e frete por peso.
- `test_vtex.py` — **scraper VTEX real, rodado offline contra uma fixture** (preço/EAN/estoque/embalagem, payload inválido não quebra).
- `test_api.py` — HTTP ponta a ponta em SQLite temporário, modo demo, scraper mock (inclui quantidade, frete grátis, **CEP**, `/go`, `/share`, `/admin`).

48 testes de lógica pura + scraper rodam sem rede nem framework; `test_api.py` roda onde as dependências estão instaladas.

---

## Integração com o frontend

Use `frontend/apiClient.js` (incluído). Ele expõe `uploadText`, `pollStatus`,
`getList`, `patchItem` e `optimizeList`, além de `adaptOptimize()` que converte a
resposta do backend para o formato que a UI do Instrumenta já consome. Defina
`API_BASE` para a URL do backend; a UI cai no modo local se ele estiver fora.

---

## Segurança / produção (checklist)

- [ ] Gerar `JWT_SECRET` forte e `DEMO_MODE=false`.
- [ ] Restringir `CORS_ORIGINS` aos domínios reais do front.
- [ ] Rodar `alembic upgrade head` (o compose de prod já faz) em vez de `AUTO_CREATE_TABLES`.
- [ ] Proxies residenciais/rotativos em `PROXY_URL` para o scraping live.
- [ ] TLS na borda (reverse proxy) e segredos via gerenciador de segredos.
- [ ] Respeitar `robots.txt`/termos das dentais; o scraping é responsabilidade sua.

---

## Roadmap sugerido

**Feito na v2:** casamento por EAN/GTIN · links de afiliado por loja · frete
grátis no otimizador · monitoramento de scraper · compartilhamento de lista.

A seguir: **histórico de preços** e alertas de queda ("compre agora vs. espere")
· embeddings/vetor no casamento para catálogos grandes · e-mail mágico no lugar
de senha · métricas (Prometheus) e tracing · fila dedicada por loja para isolar
rate limits · painel admin (UI) para a fila de revisão e a saúde dos scrapers.
