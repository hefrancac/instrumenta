# Instrumenta

Comparador de preços de material odontológico para estudantes: o aluno manda a
lista de materiais do semestre (foto, PDF ou texto), a IA **padroniza os nomes**,
o sistema faz **scraping** de preços nas dentais e devolve a **compra otimizada**
já com frete — em duas rotas: **loja única** (conveniência) e **melhor preço
(multi-loja)**. Monetização por **links de afiliado**.

Este repositório é um monorepo com duas partes independentes:

```
instrumenta/
├── backend/     API FastAPI + Celery + Postgres + Redis (scraping, matching, otimização)
└── frontend/    App React + Vite + Tailwind (upload, revisão, resultados)
```

## Como rodar (visão rápida)

Você pode rodar o **frontend sozinho** (modo demo local, sem backend) ou os dois
juntos para o fluxo real.

### 1) Frontend (sozinho já funciona)

Pré-requisito: Node 18+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### 2) Backend (para o fluxo real)

Pré-requisito: Docker (ou Python 3.11+ com Postgres/Redis). Com Docker:

```bash
cd backend
cp .env.example .env
docker compose up --build      # API em http://localhost:8000  (docs em /docs)
```

O `.env.example` já vem com `DEMO_MODE=true` (o front funciona sem login) e o CORS
liberado para `http://localhost:5173`. Detalhes, migrações e testes: `backend/README.md`.

### 3) Conectar os dois

No frontend, abra **"conectar a um backend real"**, informe `http://localhost:8000`
e um CEP, clique **Conectar**, e analise uma lista.

## Notas honestas

- **Preços são semeados por padrão.** O backend sobe em `SCRAPER_MODE=mock` com um
  catálogo de demonstração. Para preços reais, **Dental Cremer** já está ligada via
  a **API pública de catálogo da VTEX** — rode `SCRAPER_MODE=live` e valide com
  `python backend/scripts/probe_vtex.py www.dentalcremer.com.br "espelho bucal"`.
- **Respeite os Termos de Uso** de cada dental; para escala, o ideal é um acordo de
  afiliado/dados.
- A lógica pura (otimizador, casamento, unidades, frete, scraper VTEX) tem **48
  testes** que rodam sem rede: `cd backend && pytest`.

## Licença

Defina conforme o seu uso (o repositório não inclui uma licença por padrão).
