# Publicar o Instrumenta (grátis)

O app funciona **100% no modo demo sem backend** — então basta publicar o frontend para ter algo real, público e instalável no celular. O backend é opcional.

---

## 0. Pré-requisito: mandar o código pro GitHub

O projeto ainda não é um repositório Git. No terminal, dentro de `instrumenta/`:

```bash
git init
git add .
git commit -m "Instrumenta: primeira versão"
```

Crie um repositório vazio no GitHub (github.com/new), depois:

```bash
git remote add origin https://github.com/SEU-USUARIO/instrumenta.git
git branch -M main
git push -u origin main
```

> **Antes de commitar:** confira que `backend/.env` está no `.gitignore` (não suba segredos). Se não estiver, adicione a linha `backend/.env` num arquivo `.gitignore`.

---

## 1. Frontend na Vercel (o principal — 5 min, grátis)

1. Entre em **vercel.com** e faça login com o GitHub.
2. **Add New… → Project** e escolha o repositório `instrumenta`.
3. Em **Root Directory**, clique em *Edit* e selecione **`frontend`**. (Isso é essencial — o app está numa subpasta.)
4. O resto a Vercel detecta sozinha pelo `frontend/vercel.json` (framework Vite, build `npm run build`, saída `dist`).
5. Clique **Deploy**. Em ~1 min você recebe uma URL tipo `https://instrumenta.vercel.app`.

Pronto — o site está no ar. Cada `git push` na branch `main` republica automaticamente.

---

## 2. Instalar como app (PWA)

O app já é um **PWA**: instalável e **funciona offline** depois da primeira visita (ótimo pro 4G ruim da clínica).

- **Android (Chrome):** abra a URL → menu ⋮ → **Instalar app** / "Adicionar à tela inicial".
- **Desktop (Chrome/Edge):** ícone de instalar na barra de endereço (⊕).
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

Depois de instalado, abre em tela cheia com o ícone do dente, sem a barra do navegador.

---

## 3. Backend na Render (opcional)

Só é preciso se você quiser OCR de foto/PDF por IA ou dados vindos da API. Em modo demo, **pule esta parte**.

1. Em **render.com**, faça login com o GitHub.
2. **New + → Blueprint** e aponte para o repositório. A Render lê o `render.yaml` e cria: banco Postgres, Redis, a API e o worker.
3. No serviço **instrumenta-api**, edite a variável `CORS_ORIGINS` e coloque a URL do seu frontend na Vercel (ex.: `https://instrumenta.vercel.app`).
4. Deploy. A API sobe numa URL tipo `https://instrumenta-api.onrender.com`.
5. No app, abra **"conectar a um backend real"** e cole essa URL.

### Cuidados do backend
- **Driver do Postgres:** já tratado automaticamente — `app/database.py` normaliza `postgres://` e `postgresql://` para `postgresql+psycopg2://`, então a URL da Render funciona sem edição.
- **Free tier dorme:** serviços grátis da Render hibernam após inatividade; a 1ª chamada depois disso demora alguns segundos. O front já cai no modo local se o backend não responder.
- **Migrações:** rode as migrações do Alembic no primeiro deploy (via um Job/Shell da Render: `alembic upgrade head`).
- **Scraping continua `mock`:** marketplaces bloqueiam scraping (HTTP 403), então o catálogo curado permanece a fonte dos preços.

---

## Resumo

| Parte | Onde | Precisa? |
|---|---|---|
| Frontend + PWA | Vercel | **Sim** — é o que deixa o app público e instalável |
| Backend (API + worker + Redis + Postgres) | Render | Opcional — só p/ OCR/IA; o app roda sem ele |

Arquivos já prontos no repositório: `frontend/vercel.json`, `render.yaml`, e a config PWA em `frontend/vite.config.js`.
