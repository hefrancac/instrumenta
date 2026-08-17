import { CATALOG } from "../constants/catalog";
import { STORES, storeById } from "../constants/stores";
import { norm } from "./format";

export const brandMin = (brand) => {
  const vals = Object.values(brand.prices).filter((v) => v != null);
  return vals.length ? Math.min(...vals) : Infinity;
};
export const cheapestBrandIndex = (item) => {
  let best = 0, bestVal = Infinity;
  item.brands.forEach((b, i) => { const m = brandMin(b); if (m < bestVal) { bestVal = m; best = i; } });
  return best;
};

// Plano A — match preciso: conta quantas palavras-chave do item aparecem como substring.
// Em empate, desempata pela especificidade (quantas palavras da linha casam via fuzzy),
// evitando que uma palavra genérica compartilhada (ex.: "porta") decida sozinha.
function bestMatch(nrm) {
  let bestScore = 0, tied = [];
  for (const item of CATALOG) {
    const score = item.kw.reduce((acc, k) => acc + (nrm.includes(k) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; tied = [item]; }
    else if (score === bestScore && score > 0) tied.push(item);
  }
  if (!tied.length) return null;
  if (tied.length === 1) return tied[0];
  const tokens = fuzzyTokens(nrm);
  let best = tied[0], bestF = fuzzyItemScore(tokens, tied[0]);
  for (let i = 1; i < tied.length; i++) {
    const f = fuzzyItemScore(tokens, tied[i]);
    if (f > bestF) { bestF = f; best = tied[i]; }
  }
  return best;
}

// Distância de edição Damerau-Levenshtein (OSA): transposição de letras adjacentes = 1 edição.
// Ex.: "resian" → "resina" custa 1 (e não 2 como no Levenshtein clássico).
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // transposição adjacente
    }
  }
  return d[m][n];
}

// Plano B — fuzzy, só quando o Plano A falha. Tolera 1-2 erros de digitação POR palavra,
// e apenas em palavras com >= 4 letras (evita casar ruído curto como "de", "un", "3m").
const FUZZY_MIN_LEN = 4;
const fuzzyMax = (len) => (len >= 8 ? 2 : 1);   // 2 edições só em palavras longas (evita casar "madura"→"madeira")
const fuzzyTokens = (nrm) => (nrm.match(/[a-z0-9]+/g) || []).filter((t) => t.length >= FUZZY_MIN_LEN);

// Quantas palavras-chave do item casam (com tolerância a erro) com os tokens da linha.
function fuzzyItemScore(tokens, item) {
  let score = 0;
  for (const k of item.kw) {
    const words = k.split(/\s+/).filter((w) => w.length >= FUZZY_MIN_LEN);
    let hit = false;
    for (const w of words) {
      const md = fuzzyMax(w.length);
      for (const t of tokens) {
        if (Math.abs(t.length - w.length) <= md && editDistance(t, w) <= md) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit) score++;
  }
  return score;
}

export function fuzzyMatch(nrm) {
  const tokens = fuzzyTokens(nrm);
  if (!tokens.length) return null;
  let best = null, bestScore = 0;
  for (const item of CATALOG) {
    const score = fuzzyItemScore(tokens, item);
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore > 0 ? best : null;
}

// Quantas palavras-chave (substring exata) do item aparecem na linha — a "força" do Plano A.
const planAScore = (nrm, item) => item.kw.reduce((acc, k) => acc + (nrm.includes(k) ? 1 : 0), 0);

// Quantos tokens da linha casam (fuzzy) com alguma palavra do NOME padronizado do item.
// Usado só para desempatar candidatos ambíguos (ex.: "porta agulla" ~ "Porta-Agulha").
function nameOverlap(tokens, item) {
  const words = norm(item.std).split(/\s+/).filter((w) => w.length >= FUZZY_MIN_LEN);
  let s = 0;
  for (const t of tokens) {
    if (words.some((w) => {
      const md = fuzzyMax(Math.max(w.length, t.length));
      return Math.abs(t.length - w.length) <= md && editDistance(t, w) <= md;
    })) s++;
  }
  return s;
}

// "IA": casa cada linha da lista com um item do catálogo (Plano A e, se falhar, Plano B).
export function parseList(raw) {
  const lines = raw.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set();
  const matched = [];
  const unmatched = [];
  let idx = 0;
  let context = "";   // título/linha-produto que as linhas só-código abaixo herdam
  const parseQty = (line) => {
    const paren = line.match(/\(\s*(\d+)\s*(?:de cada|un|und|unid|x|pç|pcs)?\s*\)/i);
    const lead = line.match(/^\s*(\d{1,2})\s*(?:x|×|un|und|unid)?\s+/i);
    const r = paren ? paren[1] : (lead ? lead[1] : null);
    return r ? Math.min(99, Math.max(1, parseInt(r, 10))) : 1;
  };
  const letters = (s) => (s.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  const push = (item, line, qty) => matched.push({
    uid: `${item.id}-${idx++}`, catId: item.id, raw: line, std: item.std, cat: item.cat,
    brands: item.brands, brandIndex: cheapestBrandIndex(item), owned: false, qty,
  });
  for (const line of lines) {
    if (/:\s*$/.test(line)) { context = line.replace(/:\s*$/, "").trim(); continue; }  // header
    const clean = line.replace(/\(\s*\d+[^)]*\)/g, "").trim();   // sem a nota de quantidade
    if (letters(clean) === 0) continue;                          // "(1 de cada)" e ruído puro
    const n = norm(line);
    const best = bestMatch(n);
    // linha só-código ("-4138F") herda o título/produto logo acima
    if (!best && context && letters(clean) < 3) {
      const combo = norm(`${context} ${clean}`);
      if (!seen.has(combo)) {
        const ctxBest = bestMatch(combo);
        if (ctxBest) { seen.add(combo); push(ctxBest, line, parseQty(line)); }
      }
      continue;
    }
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const qty = parseQty(line);
    // Plano A (substring). Se A falhar, OU se A for um match fraco (1 palavra genérica, ex.:
    // "porta" em "porta agulla") que o fuzzy cobre com mais palavras, usa o Plano B (mais específico).
    let match = best;
    if (!best) match = fuzzyMatch(n);
    else if (planAScore(n, best) <= 1) {
      const fb = fuzzyMatch(n);
      if (fb && fb !== best) {
        const tokens = fuzzyTokens(n);
        const sFb = fuzzyItemScore(tokens, fb), sBest = fuzzyItemScore(tokens, best);
        // Prefere o fuzzy se casa mais palavras-chave; em empate, se casa melhor o NOME do item.
        if (sFb > sBest) match = fb;
        else if (sFb === sBest && nameOverlap(tokens, fb) > nameOverlap(tokens, best)) match = fb;
      }
    }
    if (match) { context = line; push(match, line, qty); }
    else { unmatched.push(line); }
  }
  return { matched, unmatched };
}

/* ------------------------------ Optimization ------------------------------ */
// Frescor pseudo-determinístico do preço (demo). No backend real vem de last_updated.
const priceAge = (catId, storeId) =>
  1 + (((catId.length * 7 + storeId.length * 13 + catId.charCodeAt(0)) % 8));

function shipFor(store, subtotal, hasItems) {
  if (!hasItems) return { ship: 0, free: false, toFree: null };
  if (store.free == null) return { ship: store.shipping, free: false, toFree: null };
  if (subtotal >= store.free) return { ship: 0, free: true, toFree: 0 };
  return { ship: store.shipping, free: false, toFree: store.free - subtotal };
}

export function optimize(items) {
  // Consolida repetidos do mesmo produto numa linha só, somando a quantidade
  // (ex.: 7 pontas → "Ponta Diamantada ×7", 10 caixas de lima → "×10").
  const byCat = {};
  const active = [];
  for (const it of items) {
    if (it.owned) continue;
    const key = it.catId || it.uid;
    if (byCat[key] != null) {
      const t = active[byCat[key]];
      active[byCat[key]] = { ...t, qty: (t.qty || 1) + (it.qty || 1) };
    } else {
      byCat[key] = active.length;
      active.push({ ...it });
    }
  }
  const qtyOf = (it) => it.qty || 1;

  // Loja única — cobertura, depois menor total, já com frete grátis por valor.
  const ranking = STORES.map((store) => {
    let covered = [], missing = [], subtotal = 0;
    for (const it of active) {
      const b = it.brands[it.brandIndex];
      const unit = b.prices[store.id];
      if (unit != null) {
        const q = qtyOf(it);
        covered.push({ it, unit, qty: q, price: unit * q, brand: b.name, ageH: priceAge(it.catId, store.id) });
        subtotal += unit * q;
      } else missing.push(it);
    }
    covered.sort((a, c) => c.price - a.price);
    const { ship, free, toFree } = shipFor(store, subtotal, covered.length > 0);
    return { store, covered, missing, coverage: covered.length, subtotal,
      shipping: ship, total: subtotal + ship, free, toFree };
  }).sort((a, b) => b.coverage - a.coverage || a.total - b.total);

  const bestSingle = ranking[0];
  const cheapestFull = ranking.filter((r) => r.coverage === active.length).sort((a, b) => a.total - b.total)[0] || null;

  // Multi-loja — otimização ciente do frete grátis (subconjuntos + busca local),
  // para capturar quando concentrar numa loja e ganhar frete grátis compensa.
  const matrix = active.map((it) => {
    const b = it.brands[it.brandIndex];
    const row = {};
    for (const s of STORES) {
      const unit = b.prices[s.id];
      if (unit != null) row[s.id] = { unit, qty: qtyOf(it), line: unit * qtyOf(it), brand: b.name, ageH: priceAge(it.catId, s.id) };
    }
    return row;
  });
  const fulfil = active.map((_, i) => i).filter((i) => Object.keys(matrix[i]).length > 0);
  const unavailable = active.filter((_, i) => Object.keys(matrix[i]).length === 0);
  const maxCov = fulfil.length;

  const planTotal = (assign) => {
    const sub = {};
    for (const i of fulfil) { const sid = assign[i]; if (sid) sub[sid] = (sub[sid] || 0) + matrix[i][sid].line; }
    let total = 0;
    for (const sid in sub) total += sub[sid] + shipFor(storeById(sid), sub[sid], true).ship;
    return total;
  };
  const assignCheapest = (allowed) => {
    const a = {};
    for (const i of fulfil) {
      let bs = null, bp = Infinity;
      for (const sid in matrix[i]) if (allowed.has(sid) && matrix[i][sid].line < bp) { bp = matrix[i][sid].line; bs = sid; }
      if (!bs) return null;
      a[i] = bs;
    }
    return a;
  };

  // Enumera subconjuntos de lojas (3 lojas → 7) preservando cobertura máxima.
  // Guard de escalabilidade: a enumeração é O(2^N). Com poucas lojas (o caso real)
  // ela é instantânea; se um dia houver muitas dentais parceiras, pulamos a busca
  // exaustiva e partimos do guloso — a busca local abaixo refina — para não travar
  // a thread principal no celular do usuário.
  const EXHAUSTIVE_CAP = 12;   // 2^12 = 4096 iterações no pior caso permitido
  let best = null, bestCost = Infinity;
  const ids = STORES.map((s) => s.id);
  if (ids.length <= EXHAUSTIVE_CAP) {
    for (let mask = 1; mask < (1 << ids.length); mask++) {
      const allowed = new Set(ids.filter((_, k) => mask & (1 << k)));
      const a = assignCheapest(allowed);
      if (!a || Object.keys(a).length !== maxCov) continue;
      const c = planTotal(a);
      if (c < bestCost) { best = a; bestCost = c; }
    }
  }
  if (!best) { best = assignCheapest(new Set(ids)) || {}; bestCost = planTotal(best); }

  // Busca local: mover itens isolados entre lojas se reduzir o total (efeito do frete grátis).
  let improved = true, guard = 0;
  while (improved && guard < 100) {
    improved = false; guard++;
    for (const i of fulfil) {
      for (const sid in matrix[i]) {
        if (sid === best[i]) continue;
        const cand = { ...best, [i]: sid };
        if (planTotal(cand) + 1e-9 < bestCost) { best = cand; bestCost = planTotal(cand); improved = true; }
      }
    }
  }

  // Monta grupos a partir da atribuição final.
  const groups = {};
  let itemsCost = 0;
  for (const i of fulfil) {
    const sid = best[i]; const cell = matrix[i][sid];
    if (!groups[sid]) groups[sid] = { store: storeById(sid), lines: [], subtotal: 0 };
    groups[sid].lines.push({ it: active[i], unit: cell.unit, qty: cell.qty, price: cell.line, brand: cell.brand, ageH: cell.ageH });
    groups[sid].subtotal += cell.line;
    itemsCost += cell.line;
  }
  const groupList = Object.values(groups).sort((a, b) => b.subtotal - a.subtotal);
  let totalShipping = 0, shippingSaved = 0;
  for (const g of groupList) {
    const { ship, free, toFree } = shipFor(g.store, g.subtotal, true);
    g.shipping = ship; g.free = free; g.toFree = toFree;
    g.lines.sort((a, c) => c.price - a.price);
    g.oldest = g.lines.reduce((m, l) => Math.max(m, l.ageH), 0);
    if (free) shippingSaved += g.store.shipping;
    totalShipping += ship;
  }
  const multiTotal = itemsCost + totalShipping;

  const baseSingleTotal = (cheapestFull || bestSingle).total;
  const savings = baseSingleTotal - multiTotal;

  return {
    active, ranking, bestSingle, cheapestFull,
    multi: { groups: groupList, itemsCost, totalShipping, total: multiTotal, unavailable, storeCount: groupList.length, shippingSaved },
    baseSingleTotal, savings, recommendMulti: savings > 0.5,
  };
}
