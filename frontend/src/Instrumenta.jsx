import { useState, useEffect, useRef } from "react";
import { Sun, Moon, CloudOff, LogIn, LogOut } from "lucide-react";
import "./index.css";
import { CATALOG } from "./constants/catalog";
import { brl } from "./utils/format";
import { brandMin, cheapestBrandIndex, optimize } from "./utils/engine";
import { API_BASE } from "./utils/apiBase";
import { useAuth } from "./contexts/AuthContext";
import Logo from "./components/Logo";
import Stepper from "./components/Stepper";
import ReviewBar from "./components/ReviewBar";
import ResultsBar from "./components/ResultsBar";
import ShareModal from "./components/ShareModal";
import AuthModal from "./components/AuthModal";
import ListManager from "./components/ListManager";
import Toaster from "./components/Toaster";
import { useCart } from "./hooks/useCart";
import { useCartSync } from "./hooks/useCartSync";
import { useBackend } from "./hooks/useBackend";
import { useLists } from "./hooks/useLists";
import { useOnline } from "./hooks/useOnline";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { encodeList, decodeList } from "./utils/persist";
import { toast } from "./utils/toast";
import { loadCachedCatalog } from "./utils/catalogCache";
import HomeStage from "./stages/HomeStage";
import ProcessingStage from "./stages/ProcessingStage";
import ReviewStage from "./stages/ReviewStage";
import ResultsStage from "./stages/ResultsStage";
import OptimizerWorker from "./workers/optimizer.worker.js?worker";

// Controlador: detém o estado compartilhado e roteia entre os estágios da tela.
// A UI de cada estágio vive em src/stages/, e a rede em src/hooks/useBackend.
export default function App() {
  const [stage, setStage] = useState("home"); // home | processing | review | results

  // Tema claro/escuro: começa pelo salvo, senão segue o sistema.
  const [theme, setTheme] = useState(() => {
    try {
      const s = localStorage.getItem("instrumenta:theme");
      if (s === "dark" || s === "light") return s;
    } catch {}
    return (typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("instrumenta:theme", theme); } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const cart = useCart();   // estado puro; a sincronização com o backend é feita abaixo

  const [unmatched, setUnmatched] = useState([]);
  const [demo, setDemo] = useState(false);
  const [procStep, setProcStep] = useState(0);
  const [view, setView] = useState("single");
  const [openStore, setOpenStore] = useState(null);
  const [shareText, setShareText] = useState(null);  // conteúdo do modal de compartilhar
  const [shareTitle, setShareTitle] = useState("");  // título do modal
  const [savedList, setSavedList] = useState(null);  // lista salva no navegador (retomar)
  const [listError, setListError] = useState(null);  // ex.: texto sem material odontológico

  // Camada de rede (opcional) + motor local, dirigindo os setters de UI acima.
  const backend = useBackend({ setStage, setProcStep, setItems: cart.setItems, setUnmatched, setDemo, setListError });
  const {
    apiBase, setApiBase, backendOn, conn, cep, setCep,
    remoteOpt, loadingRemote, backendError, showConn, setShowConn,
    connect, run, runFile, goToResults, patchRemote,
  } = backend;

  // Casa o estado do carrinho (puro) com o PATCH remoto — sem "latest ref".
  const { items, setItems, setBrand, toggleOwned, setQty, remove, setProduct } = useCartSync(cart, patchRemote);

  const online = useOnline();
  const install = useInstallPrompt();
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const lists = useLists(setItems, !!user);   // listas nomeadas (local + nuvem quando logado)
  // Offline-first: aplica o catálogo cacheado do backend (se houver) na inicialização.
  useEffect(() => { loadCachedCatalog(); }, []);

  const step = stage === "results" ? 2 : stage === "review" ? 1 : 0;

  // Otimizador roda em Web Worker (fora da main thread) para a UI seguir a 60 FPS.
  // Mantém o resultado anterior enquanto recalcula (não pisca a tela); cai para o
  // cálculo síncrono se o ambiente não suportar workers.
  const [localOpt, setLocalOpt] = useState(null);
  const optWorker = useRef(null);
  const jobIdRef = useRef(0);
  useEffect(() => {
    try { optWorker.current = new OptimizerWorker(); }
    catch { optWorker.current = null; }
    return () => optWorker.current?.terminate();
  }, []);
  useEffect(() => {
    if (!items.length) { setLocalOpt(null); return; }
    const w = optWorker.current;
    const id = ++jobIdRef.current;                       // ticket desta requisição
    if (!w) { setLocalOpt(optimize(items)); return; }    // ambiente sem worker
    let done = false;
    // Só aplica a resposta se o jobId bater com o pedido mais recente (evita
    // que uma otimização antiga sobrescreva uma mais nova — condição de corrida).
    const onMsg = (e) => { if (e.data?.ok && e.data.jobId === id) { done = true; setLocalOpt(e.data.opt); } };
    w.addEventListener("message", onMsg);
    // Rede de segurança: se o worker não responder (ex.: não carregou no artifact
    // de arquivo único), calcula síncrono — desde que ainda seja o job mais recente.
    const t = setTimeout(() => { if (!done && jobIdRef.current === id) setLocalOpt(optimize(items)); }, 150);
    w.postMessage({ items, jobId: id });
    return () => { clearTimeout(t); w.removeEventListener("message", onMsg); };
  }, [items]);
  const opt = (backendOn && remoteOpt) ? remoteOpt : localOpt;

  const activeCount = items.filter((i) => !i.owned).length;
  const reviewFrom = items.filter((i) => !i.owned)
    .reduce((acc, it) => { const m = brandMin(it.brands[it.brandIndex]); return acc + (isFinite(m) ? m * (it.qty || 1) : 0); }, 0);

  // No carregamento: lista compartilhada na URL (#lista=) tem prioridade; senão,
  // oferece retomar a lista salva no navegador.
  useEffect(() => {
    const m = window.location.hash.match(/lista=([^&]+)/);
    if (m) {
      const its = decodeList(m[1]);
      if (its && its.length) {
        setItems(its); setStage("review");
        try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* ignore */ }
        return;
      }
    }
    if (lists.activeItems.length) setSavedList(lists.activeItems);
  }, []); // eslint-disable-line
  // Salva a lista ativa sempre que muda (para não perder ao recarregar).
  useEffect(() => { if (items.length) lists.saveActive(items); }, [items]); // eslint-disable-line

  // Ao entrar em resultados, escolhe a view recomendada e abre a melhor loja.
  useEffect(() => {
    if (stage === "results" && opt) {
      setView(opt.recommendMulti ? "multi" : "single");
      setOpenStore((opt.cheapestFull || opt.bestSingle).store.id);
    }
  }, [stage, opt]); // eslint-disable-line

  function openShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#lista=${encodeList(items)}`;
    setShareTitle("Link da sua lista");
    setShareText(url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    toast("Link copiado");
  }

  // Monta um texto de "lista de compras por loja" para o aluno copiar e colar na dental.
  function buildShare() {
    const L = ["🦷 Minha compra — Instrumenta", ""];
    if (view === "multi") {
      for (const g of opt.multi.groups) {
        L.push(`▪ ${g.store.name}${g.free ? " (frete grátis)" : ""}`);
        [...g.lines].sort((a, b) => b.price - a.price).forEach((l) =>
          L.push(`  - ${l.it.std}${(l.qty || 1) > 1 ? ` ×${l.qty}` : ""} — ${brl(l.price)}`));
        L.push(`  Subtotal ${brl(g.subtotal)}${g.free ? "" : ` + frete ${brl(g.shipping)}`} = ${brl(g.subtotal + g.shipping)}`, "");
      }
      L.push(`TOTAL: ${brl(opt.multi.total)}`);
    } else {
      const r = opt.cheapestFull || opt.bestSingle;
      L.push(`▪ ${r.store.name}${r.free ? " (frete grátis)" : ""}`);
      [...r.covered].sort((a, b) => b.price - a.price).forEach((c) =>
        L.push(`  - ${c.it.std}${(c.qty || 1) > 1 ? ` ×${c.qty}` : ""} — ${brl(c.price)}`));
      if (r.missing?.length) L.push(`  (não disponível aqui: ${r.missing.map((m) => m.std).join(", ")})`);
      L.push(`  Subtotal ${brl(r.subtotal)}${r.free ? "" : ` + frete ${brl(r.shipping)}`} = ${brl(r.total)}`);
    }
    L.push("", "Preços estimados — confira na loja.");
    return L.join("\n");
  }
  function openShare() {
    const t = buildShare();
    setShareTitle("Sua lista de compras");
    setShareText(t);
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
    toast("Lista copiada");
  }

  // Resolve uma linha não reconhecida: o aluno escolhe o produto do catálogo.
  function onResolveUnmatched(raw, catId) {
    const c = CATALOG.find((x) => x.id === catId);
    if (!c) return;
    const it = { uid: `${catId}-add-${Date.now()}`, catId: c.id, raw, std: c.std, cat: c.cat,
      brands: c.brands, brandIndex: cheapestBrandIndex(c), owned: false, qty: 1 };
    setItems((p) => [...p, it]);
    setUnmatched((p) => p.filter((u) => u !== raw));
    toast(`Adicionado: ${c.std}`);
  }

  // --- Gerenciamento de listas (troca navega para a revisão) ---
  const switchList = (id) => { lists.switchTo(id); setSavedList(null); setStage("review"); window.scrollTo({ top: 0 }); toast("Lista aberta"); };
  const newList = (name) => { lists.createList(name); setUnmatched([]); setSavedList(null); setStage("home"); toast(`Lista "${name}" criada`); };
  const saveListAs = () => { const n = `Lista ${lists.lists.length + 1}`; lists.saveAsNew(n, items); toast(`Salva como "${n}"`); };
  const deleteList = (id) => { lists.removeList(id); toast("Lista excluída", { type: "info" }); };

  return (
    <div className="ff-b min-h-screen w-full bg-canvas text-ink">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-header border-line" style={{ backdropFilter: "blur(8px)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setStage("home")} className="transition-all hover:opacity-80"><Logo /></button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {stage !== "home" && <div className="hidden sm:block"><Stepper step={step} /></div>}
            {!online && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-soft text-amber-dk"
                title="Você está offline — dá para continuar editando sua lista">
                <CloudOff size={13} /> <span className="hidden sm:inline">offline</span>
              </span>
            )}
            <ListManager lists={lists.lists} activeId={lists.activeId} activeName={lists.activeName}
              itemCount={items.length} onSwitch={switchList} onCreate={newList} onSaveAs={saveListAs}
              onRename={lists.rename} onDelete={deleteList} />
            {API_BASE && (user
              ? <button onClick={logout} title={`Sair (${user.email})`} aria-label={`Sair — ${user.email}`}
                  className="p-2 rounded-lg transition-all hover:opacity-80 shrink-0 text-primary"><LogOut size={18} /></button>
              : <button onClick={() => setShowAuth(true)} title="Entrar" aria-label="Entrar"
                  className="p-2 rounded-lg transition-all hover:opacity-80 shrink-0 text-ink-soft"><LogIn size={18} /></button>
            )}
            <button onClick={toggleTheme} aria-label="Alternar tema claro e escuro"
              title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
              className="p-2 rounded-lg transition-all hover:opacity-80 shrink-0 text-ink-soft">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-28 pt-6">
        {stage === "home" && (
          <HomeStage
            savedList={savedList}
            onContinue={() => { setItems(savedList); setSavedList(null); setStage("review"); window.scrollTo({ top: 0 }); }}
            onDiscard={() => setSavedList(null)}
            installReady={install.canInstall} iosHint={install.iosHint} onInstall={install.install} onDismissInstall={install.dismiss}
            onRun={run} onRunFile={runFile} listError={listError}
            apiBase={apiBase} setApiBase={setApiBase} cep={cep} setCep={setCep}
            conn={conn} backendOn={backendOn} backendError={backendError}
            connect={connect} showConn={showConn} setShowConn={setShowConn}
          />
        )}

        {stage === "processing" && (
          <ProcessingStage procStep={procStep} itemCount={items.length} unmatchedCount={unmatched.length} />
        )}

        {stage === "review" && (
          <ReviewStage
            items={items} unmatched={unmatched} demo={demo}
            toggleOwned={toggleOwned} setQty={setQty} remove={remove} setBrand={setBrand} setProduct={setProduct}
            onResolveUnmatched={onResolveUnmatched} onNewList={() => setStage("home")}
          />
        )}

        {stage === "results" && opt && (
          <ResultsStage opt={opt} view={view} setView={setView} openStore={openStore} setOpenStore={setOpenStore} />
        )}
      </main>

      {/* Barras fixas e modal (componentes isolados) */}
      {stage === "review" && (
        <ReviewBar activeCount={activeCount} ownedCount={items.length - activeCount}
          reviewFrom={reviewFrom} onShareLink={openShareLink} onGoResults={goToResults} loading={loadingRemote} />
      )}

      {stage === "results" && opt && (
        <ResultsBar opt={opt} view={view} onShare={openShare}
          onEdit={() => { setStage("review"); window.scrollTo({ top: 0 }); }} />
      )}

      {shareText && <ShareModal title={shareTitle} text={shareText} onClose={() => setShareText(null)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <Toaster />
    </div>
  );
}
