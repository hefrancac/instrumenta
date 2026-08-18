import { useState, useRef, useMemo, useEffect } from "react";
import { CATALOG } from "../constants/catalog";
import { storeById } from "../constants/stores";
import { P } from "../constants/theme";
import { cheapestBrandIndex, parseList } from "../utils/engine";
import { enqueue, drainQueue } from "../utils/syncQueue";
import { syncCatalog } from "../utils/catalogCache";
import { toast } from "../utils/toast";
import { authHeader, clearToken, emitUnauthorized, getToken } from "../utils/authToken";
import { API_BASE, apiV1 } from "../utils/apiBase";

const scrollTop = () => window.scrollTo({ top: 0 });

// Toda a comunicação com o backend (opcional) + o motor local de fallback.
// Recebe os setters de UI que precisa dirigir (estágio, progresso, itens, etc.),
// mantendo a camada de rede fora dos componentes visuais.
export function useBackend({ setStage, setProcStep, setItems, setUnmatched, setDemo, setListError, onNeedAuth, onOcrResult }) {
  const [apiBase, setApiBase] = useState("");
  const [backendOn, setBackendOn] = useState(false);
  const [conn, setConn] = useState("off");        // off | checking | ok | fail
  const [cep, setCep] = useState("");
  const [listId, setListId] = useState(null);
  const [remoteOpt, setRemoteOpt] = useState(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [backendError, setBackendError] = useState(null);
  const [showConn, setShowConn] = useState(false);
  const optAbort = useRef(null);                   // cancela otimização anterior (race de CEP)

  const catByStd = useMemo(() => Object.fromEntries(CATALOG.map((c) => [c.std, c])), []);
  const apiRoot = () => apiBase.replace(/\/+$/, "");
  const V1 = () => `${apiRoot()}/api/v1`;
  // Em 401: token inválido/expirado -> limpa e avisa o AuthContext (logout).
  const on401 = (r) => { if (r.status === 401) { clearToken(); emitUnauthorized(); } };
  const jget = async (url, signal) => {
    const r = await fetch(url, { headers: authHeader(), ...(signal ? { signal } : {}) });
    if (!r.ok) { on401(r); throw new Error("HTTP " + r.status); }
    return r.json();
  };
  const jsend = async (url, method, body, extraHeaders) => {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeader(), ...(extraHeaders || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { on401(r); throw new Error("HTTP " + r.status); }
    return r.status === 204 ? null : r.json();
  };
  // Chave de idempotência: se o POST for reenviado, o backend não cria lista duplicada.
  const newIdemKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  async function connect() {
    if (!apiBase) { setConn("fail"); setBackendError("Informe a URL do backend (ex.: http://localhost:8000)."); return; }
    setConn("checking"); setBackendError(null);
    try {
      await jget(`${apiRoot()}/health`);
      setConn("ok"); setBackendOn(true);
      // Sincroniza o catálogo (novos produtos/marcas do backend) — só baixa se o hash mudou.
      syncCatalog(apiRoot()).then((r) => { if (r?.updated) toast(`Catálogo atualizado (${r.count} itens)`); }).catch(() => {});
    } catch { setConn("fail"); setBackendOn(false); setBackendError("Não consegui conectar. Verifique a URL e o CORS do backend."); }
  }

  const mapRemoteItems = (apiItems) => (apiItems || []).map((ri) => {
    const c = catByStd[ri.standard_name];
    let brands, brandIndex;
    if (c) { brands = c.brands; const idx = c.brands.findIndex((b) => b.name === ri.brand); brandIndex = idx >= 0 ? idx : cheapestBrandIndex(c); }
    else { brands = [{ name: ri.brand || "—", prices: {} }]; brandIndex = 0; }
    return { uid: `r${ri.id}`, remoteId: ri.id, catId: c?.id || `r${ri.id}`, raw: ri.raw_name,
      std: ri.standard_name, cat: ri.category || c?.cat || "Material", brands, brandIndex,
      owned: !!ri.owned, qty: ri.quantity || 1 };
  });

  // adapt backend /cart/optimize -> the shape the UI renders
  const stMap = (id, name, shipping, free) => ({ id, name, color: storeById(id)?.color || P.primary, shipping, free });
  const rowMap = (r) => ({ it: { std: r.standard_name, uid: r.standard_name }, price: r.price,
    unit: r.unit_price ?? r.price, qty: r.quantity ?? 1, brand: r.brand, url: r.url,
    offer_id: r.offer_id, ageH: r.age_hours ?? 0, image: r.image_url });
  const optMap = (o) => o && { store: stMap(o.store_id, o.store_name, o.shipping, o.free_shipping_threshold),
    coverage: o.coverage, required: o.required_count, complete: o.complete, subtotal: o.subtotal,
    shipping: o.shipping, total: o.total, free: !!o.free_shipping_eligible, toFree: o.amount_to_free_shipping,
    covered: (o.items || []).map(rowMap), missing: (o.missing || []).map((n) => ({ std: n })) };
  function adaptRemote(resp) {
    const ranking = (resp.single?.ranking || []).map(optMap);
    const groups = (resp.multi?.groups || []).map((g) => {
      const lines = (g.items || []).map(rowMap);
      return { store: stMap(g.store_id, g.store_name, g.shipping, g.free_shipping_threshold), lines,
        subtotal: g.subtotal, shipping: g.shipping, free: !!g.free_shipping_eligible,
        toFree: g.amount_to_free_shipping, oldest: lines.reduce((m, l) => Math.max(m, l.ageH || 0), 0) };
    });
    const requiredCount = resp.single?.best?.required_count || ranking[0]?.required || groups.reduce((a, g) => a + g.lines.length, 0);
    return { active: Array.from({ length: requiredCount }), ranking, bestSingle: optMap(resp.single?.best),
      cheapestFull: optMap(resp.single?.cheapest_complete),
      multi: { groups, itemsCost: resp.multi?.items_cost || 0, totalShipping: resp.multi?.total_shipping || 0,
        total: resp.multi?.total || 0, storeCount: resp.multi?.store_count || groups.length,
        shippingSaved: resp.multi?.shipping_saved || 0, unavailable: resp.multi?.unavailable || [] },
      baseSingleTotal: resp.base_single_total || 0, savings: resp.savings || 0, recommendMulti: resp.recommend === "multi",
      region: resp.destination_region };
  }

  // Motor local de demonstração (sem backend).
  function localRun(text, isDemo) {
    const { matched, unmatched } = parseList(text);
    if (matched.length === 0) {
      setListError("Ops — não encontramos nenhum material odontológico neste texto. Cole a lista de materiais do semestre (um item por linha).");
      scrollTop();
      return;
    }
    setListError(null);
    setItems(matched); setUnmatched(unmatched); setDemo(isDemo); setRemoteOpt(null);
    setStage("processing"); setProcStep(0);
    const times = [500, 1050, 1600, 2150];
    times.forEach((t, i) => setTimeout(() => setProcStep(i + 1), t));
    setTimeout(() => { setStage("review"); scrollTop(); }, 2650);
  }

  async function run(text, isDemo) {
    setDemo(isDemo); setBackendError(null);
    if (!(backendOn && conn === "ok" && apiBase)) { localRun(text, isDemo); return; }
    setStage("processing"); setProcStep(0);
    [400, 900, 1400].forEach((t, i) => setTimeout(() => setProcStep(i + 1), t));
    try {
      const created = await jsend(`${V1()}/lists/text`, "POST", { text }, { "X-Idempotency-Key": newIdemKey() });
      setListId(created.list_id);
      for (let i = 0; i < 8; i++) {          // best-effort progress from the worker
        try { const s = await jget(`${V1()}/lists/${created.list_id}/status`);
          setProcStep(Math.min(4, 1 + Math.round((s.progress || 0) * 3)));
          if (s.status === "done" || s.status === "error") break; } catch { /* keep going */ }
        await new Promise((r) => setTimeout(r, 600));
      }
      const list = await jget(`${V1()}/lists/${created.list_id}`);
      setItems(mapRemoteItems(list.items)); setUnmatched([]); setRemoteOpt(null);
      setStage("review"); scrollTop();
    } catch (e) {
      setBackendError("Falha no backend — usando modo local. (" + e.message + ")");
      setBackendOn(false); localRun(text, isDemo);
    }
  }

  // Real file upload (photo / PDF / text). Uses the backend OCR when connected;
  // falls back to reading a plain-text file locally when there's no backend.
  async function runFile(file) {
    if (!file) return;
    setBackendError(null); setDemo(false);
    const isText = (file.type || "").startsWith("text/") || /\.(txt|csv)$/i.test(file.name);

    // Texto (arquivo .txt/.csv) roda local — não precisa de IA, igual ao colar lista.
    if (isText) { const t = await file.text(); localRun(t, false); return; }

    // PDF: tenta extrair o texto no navegador (grátis, offline). PDF de texto (lista
    // digitada) é lido na hora; escaneado/imagem devolve pouco texto -> pede OCR.
    const isPdf = (file.type || "").includes("pdf") || /\.pdf$/i.test(file.name);
    if (isPdf) {
      setStage("processing"); setProcStep(0);
      [400, 1200].forEach((t, i) => setTimeout(() => setProcStep(i + 1), t));
      try {
        const { extractPdfText } = await import("../utils/pdfText.js");
        const text = await extractPdfText(file);
        if (text.replace(/\s+/g, "").length >= 40) { localRun(text, false); return; }
        setStage("home");
        setBackendError("Esse PDF parece ser escaneado (imagem), sem texto pra extrair. Pra ler assim precisa do OCR por IA (em breve) — ou cole a lista em texto.");
      } catch (e) {
        setStage("home");
        setBackendError("Não consegui ler o PDF: " + e.message);
      }
      return;
    }

    // Daqui pra baixo: foto (imagem), que exige OCR por IA no backend. Preferir o backend
    // deployado (API_BASE) com o token do usuário logado; senão, o painel manual.
    const authed = !!(getToken() && API_BASE);
    const manual = backendOn && conn === "ok" && apiBase;
    if (!authed && !manual) {
      if (API_BASE) {                          // backend existe, mas o OCR é gated por conta
        setBackendError("Para ler foto ou PDF com IA, entre na sua conta primeiro.");
        onNeedAuth?.();
      } else {
        setShowConn(true);
        setBackendError("Para ler foto ou PDF é preciso um backend real (a IA faz o OCR). Conecte acima, ou envie a lista em texto.");
      }
      return;
    }

    const root = authed ? apiV1() : V1();
    setStage("processing"); setProcStep(0);
    [400, 1200, 2400].forEach((t, i) => setTimeout(() => setProcStep(i + 1), t));
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(`${root}/lists/upload`, { method: "POST", body: fd,
        headers: { ...authHeader(), "X-Idempotency-Key": newIdemKey() } });
      if (r.status === 401) { clearToken(); emitUnauthorized(); }
      if (!r.ok) {
        let msg = "HTTP " + r.status;
        try { const j = await r.json(); msg = j?.detail || j?.error?.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const created = await r.json();
      setListId(created.list_id);

      if (authed) {
        // O backend deployado não tem worker: o OCR roda síncrono e os itens já vêm
        // prontos na resposta — sem polling. Adota como lista de nuvem ativa.
        if (onOcrResult) onOcrResult(created);
        else setItems(mapRemoteItems(created.items));
        setUnmatched([]); setRemoteOpt(null); setStage("review"); scrollTop();
        return;
      }

      // Fluxo manual-connect (pode ter worker): acompanha o progresso do job.
      for (let i = 0; i < 12; i++) {
        try { const s = await jget(`${root}/lists/${created.list_id}/status`);
          setProcStep(Math.min(4, 1 + Math.round((s.progress || 0) * 3)));
          if (s.status === "done" || s.status === "error") break; } catch { /* keep going */ }
        await new Promise((res) => setTimeout(res, 600));
      }
      const list = await jget(`${root}/lists/${created.list_id}`);
      setItems(mapRemoteItems(list.items)); setUnmatched([]); setRemoteOpt(null);
      setStage("review"); scrollTop();
    } catch (e) {
      setStage("home");
      setBackendError("Não consegui ler o arquivo: " + e.message);
    }
  }

  async function goToResults() {
    if (!(backendOn && conn === "ok" && listId)) { setStage("results"); scrollTop(); return; }
    optAbort.current?.abort();                        // cancela a otimização anterior (ex.: CEP trocado)
    const ac = new AbortController(); optAbort.current = ac;
    setLoadingRemote(true); setBackendError(null);
    try {
      const q = cep ? `?cep=${encodeURIComponent(cep)}` : "";
      const resp = await jget(`${V1()}/cart/optimize/${listId}${q}`, ac.signal);
      setRemoteOpt(adaptRemote(resp));
    } catch (e) {
      if (e.name === "AbortError") return;            // requisição substituída por uma mais nova
      setBackendError("Falha ao otimizar no backend — usando modo local."); setRemoteOpt(null);
    } finally {
      if (!ac.signal.aborted) { setLoadingRemote(false); setStage("results"); scrollTop(); }
    }
  }

  // Sincroniza a edição de um item com o backend. Se a requisição falhar (rede caiu),
  // a ação vai para a fila de sincronização e sobe quando a conexão voltar.
  const patchRemote = (it, patch) => {
    if (!it.remoteId) return;
    // Fluxo autenticado: item de lista de nuvem -> PATCH direto (Bearer via jsend).
    if (getToken() && it.listCloudId) {
      const url = `${apiV1()}/lists/${it.listCloudId}/items/${it.remoteId}`;
      jsend(url, "PATCH", patch).catch(() => enqueue({ url, method: "PATCH", body: patch }));
      return;
    }
    // Fluxo demo-connect (URL digitada no painel).
    if (backendOn && conn === "ok" && listId) {
      const url = `${V1()}/lists/${listId}/items/${it.remoteId}`;
      jsend(url, "PATCH", patch).catch(() => enqueue({ url, method: "PATCH", body: patch }));
    }
  };

  // Drena a fila de patches pendentes (persistida no localStorage) quando volta
  // online E também no boot: se o app foi fechado offline com ações na fila e
  // reabre já online, o evento 'online' não dispara — então ressuscitamos aqui.
  useEffect(() => {
    const onOnline = () => {
      if (getToken() || (backendOn && conn === "ok")) drainQueue((a) => jsend(a.url, a.method, a.body));
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) onOnline();   // ressuscita a fila no carregamento, não só na transição
    return () => window.removeEventListener("online", onOnline);
  }, [backendOn, conn]); // eslint-disable-line

  // Invalidação reativa do catálogo: enquanto conectado, checa o hash a cada 5 min e
  // ao a aba voltar ao foco. syncCatalog só baixa se o hash mudou (barato).
  useEffect(() => {
    if (!(backendOn && conn === "ok")) return;
    const check = () => syncCatalog(apiRoot())
      .then((r) => { if (r?.updated) toast(`Catálogo atualizado (${r.count} itens)`); })
      .catch(() => {});
    const interval = setInterval(check, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [backendOn, conn]); // eslint-disable-line

  return {
    apiBase, setApiBase, backendOn, conn, cep, setCep, listId,
    remoteOpt, loadingRemote, backendError, showConn, setShowConn,
    connect, run, runFile, goToResults, patchRemote,
  };
}
