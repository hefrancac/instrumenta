# Instrumenta — Frontend

App React (Vite + Tailwind) que compara preços de material odontológico: o aluno
cola/envia a lista do semestre, o app **padroniza** os itens, **otimiza** a compra
(loja única vs. multi-loja, com frete) e leva ao produto na loja.

Roda **sozinho** (modo demo, com catálogo e preços embutidos) ou conectado a um
backend real (FastAPI) para scraping/CEP.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # produção -> dist/
npm test          # testes do motor (Vitest)
```

## Arquitetura

Código modular (o "God Object" foi quebrado):

```
src/
├── constants/
│   ├── theme.js        P — paleta
│   ├── stores.js       STORES + URL de busca real de cada dental
│   └── catalog.js      CATALOG (itens + keywords + preços), SAMPLE
├── utils/
│   ├── format.js       brl, fresh, goUrl, norm
│   ├── engine.js       parseList (reconhecimento) + optimize (frete-aware)  ← testado
│   └── engine.test.js  Vitest
├── components/         Logo, CatChip, StoreDot, FreeShip, Stepper, ProductPicker (memoizados)
├── hooks/
│   └── useCart.js      estado da lista via useReducer (SET_BRAND, SET_QTY, …)
├── index.css           fontes + animações (fora do render)
└── Instrumenta.jsx     App — UI + orquestração + integração backend
```

### Como funciona o reconhecimento (`engine.parseList`)
Casa cada linha da lista com um item do catálogo por **palavras-chave**, com:
de-dup só de linha idêntica (limas de tamanhos diferentes contam separado),
herança de cabeçalho para linhas só-código (`Pontas diamantadas:` + `-4138F`),
e leitura de quantidade (`(10)`, `2x …`).

### Otimização (`engine.optimize`)
Consolida repetidos por quantidade, calcula **loja única** (cobertura → menor
total, com frete grátis por valor) e **multi-loja** (enumeração de subconjuntos +
busca local, ciente do frete grátis).

### Modo backend (opcional)
Sem backend, tudo roda no cliente. Conectado, o App usa a API (upload, status,
PATCH de item, `/cart/optimize?cep=`), com fallback automático para o motor local
e `AbortController` para evitar race de requisições (ex.: CEP trocado rápido).

## Notas
- **Preços são estimativas** (catálogo curado). Disponibilidade por loja não é
  garantida — equipamentos raros aparecem como "preço a confirmar".
- O catálogo do frontend é **gerado a partir do backend** (`app/services/catalog.py`);
  ao atualizar o catálogo, regenere `src/constants/catalog.js`.
- Os links de produto usam a **busca real** de cada loja (sem afiliado por ora).
