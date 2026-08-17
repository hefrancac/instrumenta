import { useState, useMemo, useEffect, useRef } from "react";
import { Sun, Moon } from "lucide-react";
import "./index.css";
import { CATALOG } from "./constants/catalog";
import { brl } from "./utils/format";
import { brandMin, cheapestBrandIndex, optimize } from "./utils/engine";
import Logo from "./components/Logo";
import Stepper from "./components/Stepper";
import ReviewBar from "./components/ReviewBar";
import ResultsBar from "./components/ResultsBar";
import ShareModal from "./components/ShareModal";
import { useCart } from "./hooks/useCart";
import { useBackend } from "./hooks/useBackend";
import { saveList, loadList, clearList, encodeList, decodeList } from "./utils/persist";
import HomeStage from "./stages/HomeStage";
import ProcessingStage from "./stages/ProcessingStage";
import ReviewStage from "./stages/ReviewStage";
import ResultsStage from "./stages/ResultsStage";

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

  const patchRemoteRef = useRef(() => {});   // ligado ao patchRemote do useBackend
  const { items, setItems, setBrand, toggleOwned, setQty, remove, setProduct } =
    useCart((it, patch) => patchRemoteRef.current(it, patch));

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
  const backend = useBackend({ setStage, setProcStep, setItems, setUnmatched, setDemo, setListError });
  const {
    apiBase, setApiBase, backendOn, conn, cep, setCep,
    remoteOpt, loadingRemote, backendError, showConn, setShowConn,
    connect, run, runFile, goToResults, patchRemote,
  } = backend;
  // Mantém a ref com o patchRemote atual sem mutar ref durante o render.
  useEffect(() => { patchRemoteRef.current = patchRemote; });

  const step = stage === "results" ? 2 : stage === "review" ? 1 : 0;
  const localOpt = useMemo(() => (items.length ? optimize(items) : null), [items]);
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
    const saved = loadList();
    if (saved && saved.length) setSavedList(saved);
  }, []); // eslint-disable-line
  // Salva a lista sempre que muda (para não perder ao recarregar).
  useEffect(() => { if (items.length) saveList(items); }, [items]);

  // Ao entrar em resultados, escolhe a view recomendada e abre a melhor loja.
  useEffect(() => {
    if (stage === "results" && opt) {
      setView(opt.recommendMulti ? "multi" : "single");
      setOpenStore((opt.cheapestFull || opt.bestSingle).store.id);
    }
  }, [stage, remoteOpt]); // eslint-disable-line

  function openShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#lista=${encodeList(items)}`;
    setShareTitle("Link da sua lista");
    setShareText(url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
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
  }

  // Resolve uma linha não reconhecida: o aluno escolhe o produto do catálogo.
  function onResolveUnmatched(raw, catId) {
    const c = CATALOG.find((x) => x.id === catId);
    if (!c) return;
    const it = { uid: `${catId}-add-${Date.now()}`, catId: c.id, raw, std: c.std, cat: c.cat,
      brands: c.brands, brandIndex: cheapestBrandIndex(c), owned: false, qty: 1 };
    setItems((p) => [...p, it]);
    setUnmatched((p) => p.filter((u) => u !== raw));
  }

  return (
    <div className="ff-b min-h-screen w-full bg-canvas text-ink">

      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-header border-line" style={{ backdropFilter: "blur(8px)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setStage("home")} className="transition-all hover:opacity-80"><Logo /></button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {stage !== "home" && <Stepper step={step} />}
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
            onDiscard={() => { clearList(); setSavedList(null); }}
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
    </div>
  );
}
