import { useState, useRef } from "react";
import {
  Upload, Camera, ScanLine, Sparkles, ClipboardPaste, Search, Wifi, X, Coins, ArrowRight, Download, Share, FileText,
} from "lucide-react";
import { SAMPLE } from "../constants/catalog";

// Tela inicial. O input de texto (raw) e o painel de colar (showPaste) são estado
// LOCAL daqui — digitar não re-renderiza o resto do app.
export default function HomeStage({
  savedList, onContinue, onDiscard,
  onRun, onRunFile, listError,
  apiBase, setApiBase, cep, setCep, conn, backendOn, backendError, connect, showConn, setShowConn,
  installReady, iosHint, onInstall, onDismissInstall,
}) {
  const [raw, setRaw] = useState("");
  const fileRef = useRef(null);
  const connColor = conn === "ok" ? "text-emerald" : conn === "fail" ? "text-danger" : "text-ink-soft";
  const connDot = conn === "ok" ? "bg-emerald" : conn === "fail" ? "bg-danger" : "bg-ink-soft";
  // OCR por IA (foto/PDF) só liga com a chave da Anthropic no backend + esta flag.
  // Sem ela, a home lidera pela lista em texto (grátis, offline) e mostra "em breve".
  const OCR_ENABLED = import.meta.env.VITE_OCR_ENABLED === "1";

  return (
    <div className="fadeup">
      {installReady && (
        <div className="pop mb-4 flex items-center justify-between gap-3 rounded-2xl border p-3.5 bg-card border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="rounded-xl flex items-center justify-center shrink-0 bg-primary-soft" style={{ width: 38, height: 38 }}>
              <Download size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="ff-d text-sm font-semibold">Instale o app da Instrumenta</p>
              <p className="ff-b text-xs text-ink-soft truncate">Funciona offline na clínica, direto da tela inicial.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onDismissInstall} aria-label="Dispensar" className="ff-b text-xs font-medium transition-all hover:opacity-70 text-ink-soft">Agora não</button>
            <button onClick={onInstall}
              className="ff-b inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 bg-primary">
              <Download size={15} /> Instalar
            </button>
          </div>
        </div>
      )}
      {!installReady && iosHint && (
        <div className="pop mb-4 flex items-start justify-between gap-3 rounded-2xl border p-3.5 bg-card border-line">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="rounded-xl flex items-center justify-center shrink-0 bg-primary-soft" style={{ width: 38, height: 38 }}>
              <Share size={17} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="ff-d text-sm font-semibold">Instale no seu iPhone</p>
              <p className="ff-b text-xs text-ink-soft leading-snug">
                Toque em <b>Compartilhar</b> <Share size={11} className="inline align-[-1px] text-ink-soft" /> e depois em <b>Adicionar à Tela de Início</b> — funciona offline na clínica.
              </p>
            </div>
          </div>
          <button onClick={onDismissInstall} aria-label="Dispensar" className="p-1 rounded-md hover:opacity-70 shrink-0"><X size={16} className="text-ink-soft" /></button>
        </div>
      )}
      {savedList && (
        <div className="pop mb-5 flex items-center justify-between gap-3 rounded-2xl border p-3.5 bg-primary-soft border-banner-line">
          <div>
            <p className="ff-d text-sm font-semibold text-primary">
              Você tem uma lista salva ({savedList.length} {savedList.length === 1 ? "item" : "itens"})
            </p>
            <p className="ff-b text-xs text-ink-soft">Continue de onde parou.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onDiscard}
              className="ff-b text-xs font-medium transition-all hover:opacity-70 text-ink-soft">
              Descartar
            </button>
            <button onClick={onContinue}
              className="ff-b inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 bg-primary">
              <ArrowRight size={15} /> Continuar
            </button>
          </div>
        </div>
      )}
      <div className="text-center max-w-xl mx-auto mb-7">
        <span className="ff-b inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4 bg-primary-soft text-primary">
          Para estudantes de odontologia
        </span>
        <h1 className="ff-d text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-3">
          Do quadro ao carrinho,<br />sem dor de cabeça.
        </h1>
        <p className="ff-b text-base leading-relaxed text-ink-soft">
          Cole a lista de materiais do semestre. A Instrumenta padroniza os
          instrumentais e acha o melhor preço nas dentais — já contando o frete.
        </p>
      </div>

      {/* Herói: colar/digitar a lista (funciona na hora, offline, grátis) */}
      <div className="rounded-3xl border-2 p-6 sm:p-7 bg-card border-line">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-2xl flex items-center justify-center shrink-0 bg-primary-soft" style={{ width: 48, height: 48 }}>
            <ClipboardPaste size={22} className="text-primary" />
          </div>
          <div className="text-left min-w-0">
            <p className="ff-d text-lg font-semibold">Cole a lista do semestre</p>
            <p className="ff-b text-sm text-ink-soft">Um item por linha — a gente reconhece e compara.</p>
          </div>
        </div>

        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
          className="ff-b w-full text-sm rounded-xl border p-3 resize-none outline-none border-line bg-canvas text-ink"
          placeholder={"espelho bucal\nsonda exploradora nº 5\npinça clínica\nbroca diamantada 1014\n…"} />

        <div className="flex flex-col sm:flex-row gap-2.5 mt-3">
          <button onClick={() => onRun(raw, false)} disabled={!raw.trim()}
            className="ff-b flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-sm bg-primary disabled:opacity-40 disabled:cursor-not-allowed">
            <Search size={17} /> Analisar minha lista
          </button>
          <button onClick={() => onRun(SAMPLE, true)}
            className="ff-b inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-80 border bg-card border-line text-ink">
            <Sparkles size={16} /> Ver exemplo
          </button>
        </div>

        {listError && (
          <div className="pop mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left bg-amber-soft border-amber-line">
            <X size={16} className="mt-0.5 shrink-0 text-amber-dk" />
            <p className="ff-b text-xs leading-snug text-amber-dk">{listError}</p>
          </div>
        )}
      </div>

      {/* PDF / arquivo: PDF de texto e .txt são lidos localmente (grátis); foto precisa de OCR */}
      <div className="mt-4 rounded-2xl border p-4 bg-card border-line">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl flex items-center justify-center shrink-0 bg-primary-soft" style={{ width: 40, height: 40 }}>
              <FileText size={18} className="text-primary" />
            </div>
            <div className="min-w-0 text-left">
              <p className="ff-d text-sm font-semibold">Enviar PDF ou arquivo</p>
              <p className="ff-b text-xs text-ink-soft leading-snug">
                {OCR_ENABLED
                  ? "PDF, foto ou .txt — a IA lê o que precisar."
                  : "PDF de texto e .txt são lidos aqui no navegador. Foto/escaneado: OCR em breve."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input ref={fileRef} type="file" className="hidden"
              accept={OCR_ENABLED ? "application/pdf,text/plain,.txt,.csv,image/*" : "application/pdf,text/plain,.txt,.csv"}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onRunFile(f); }} />
            <button onClick={() => { if (fileRef.current) { fileRef.current.removeAttribute("capture"); fileRef.current.click(); } }}
              className="ff-b inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white font-semibold text-xs transition-all hover:opacity-90 bg-primary">
              <Upload size={14} /> Enviar
            </button>
            {OCR_ENABLED && (
              <button onClick={() => { if (fileRef.current) { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); } }}
                className="ff-b inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all hover:opacity-80 border bg-card border-line text-ink">
                <Camera size={14} /> Foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Painel de dev (URL de backend, CEP) — só em desenvolvimento local */}
      {import.meta.env.DEV && (
        <div className="mt-3">
          <button onClick={() => setShowConn((s) => !s)}
            className={`ff-b inline-flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-70 ${backendOn ? "text-emerald" : "text-ink-soft"}`}>
            <Wifi size={13} /> {backendOn ? "Backend conectado" : "conectar a um backend real (dev)"}
          </button>

          {showConn && (
            <div className="pop mt-3 text-left rounded-xl border p-4 border-line bg-card">
              <p className="ff-d text-sm font-semibold">Modo backend (opcional)</p>
              <p className="ff-b text-xs mt-0.5 leading-snug text-ink-soft">
                Sem conexão, o app usa o motor local de demonstração. Conectado, ele usa a API real: scraping, otimização com frete por CEP e links de afiliado.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={apiBase} onChange={(e) => setApiBase(e.target.value)}
                  placeholder="URL — http://localhost:8000"
                  className="ff-m text-xs rounded-lg border px-3 py-2 outline-none w-full border-line bg-canvas text-ink" />
                <input value={cep} onChange={(e) => setCep(e.target.value)}
                  placeholder="CEP de destino — 01310-000"
                  className="ff-m text-xs rounded-lg border px-3 py-2 outline-none w-full border-line bg-canvas text-ink" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={connect}
                  className="ff-b inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white font-semibold text-xs transition-all hover:opacity-90 bg-primary">
                  <Wifi size={13} /> {conn === "checking" ? "Conectando…" : "Conectar"}
                </button>
                <span className={`ff-b inline-flex items-center gap-1.5 text-xs font-medium ${connColor}`}>
                  <span className={`w-2 h-2 rounded-full ${connDot}`} />
                  {conn === "ok" ? "Conectado" : conn === "fail" ? "Sem conexão" : conn === "checking" ? "Verificando…" : "Desconectado"}
                </span>
              </div>
              {backendError && <p className="ff-b text-xs mt-2 text-danger">{backendError}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        {[OCR_ENABLED
            ? [ScanLine, "Lê foto e PDF", "OCR entende listas escritas à mão ou impressas"]
            : [Download, "Funciona offline", "Instale como app e use sem internet na clínica"],
          [Sparkles, "Padroniza os nomes", "“Sonda n5” vira “Sonda Exploradora nº 5”"],
          [Coins, "Compara preço + frete", "Loja única ou divisão inteligente entre dentais"]].map(([Icon, t, d]) => (
          <div key={t} className="rounded-2xl border p-4 bg-card border-line">
            <Icon size={18} className="text-primary" />
            <p className="ff-d text-sm font-semibold mt-2">{t}</p>
            <p className="ff-b text-xs mt-0.5 leading-snug text-ink-soft">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
