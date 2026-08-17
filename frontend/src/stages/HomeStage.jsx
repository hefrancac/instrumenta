import { useState, useRef } from "react";
import {
  Upload, Camera, ScanLine, Sparkles, ClipboardPaste, Search, Wifi, X, Coins, ArrowRight,
} from "lucide-react";
import { SAMPLE } from "../constants/catalog";

// Tela inicial. O input de texto (raw) e o painel de colar (showPaste) são estado
// LOCAL daqui — digitar não re-renderiza o resto do app.
export default function HomeStage({
  savedList, onContinue, onDiscard,
  onRun, onRunFile, listError,
  apiBase, setApiBase, cep, setCep, conn, backendOn, backendError, connect, showConn, setShowConn,
}) {
  const [raw, setRaw] = useState(SAMPLE);
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef(null);
  const connColor = conn === "ok" ? "text-emerald" : conn === "fail" ? "text-danger" : "text-ink-soft";
  const connDot = conn === "ok" ? "bg-emerald" : conn === "fail" ? "bg-danger" : "bg-ink-soft";

  return (
    <div className="fadeup">
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
          Envie a foto da lista de materiais do semestre. A Instrumenta lê,
          padroniza os instrumentais e acha o melhor preço nas dentais — já contando o frete.
        </p>
      </div>

      {/* Upload card — o herói */}
      <div className="rounded-3xl border-2 border-dashed p-8 text-center transition-all bg-card border-line">
        <div className="mx-auto mb-4 rounded-2xl flex items-center justify-center bg-primary-soft"
          style={{ width: 60, height: 60 }}>
          <ScanLine size={28} className="text-primary" />
        </div>
        <p className="ff-d text-lg font-semibold mb-1">Arraste a foto ou o PDF da lista</p>
        <p className="ff-b text-sm mb-5 text-ink-soft">
          JPG, PNG ou PDF — a IA extrai os itens automaticamente
        </p>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,text/plain,.txt,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onRunFile(f); }} />
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button onClick={() => { if (fileRef.current) { fileRef.current.removeAttribute("capture"); fileRef.current.click(); } }}
            className="ff-b inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-sm bg-primary">
            <Upload size={17} /> Enviar lista
          </button>
          <button onClick={() => { if (fileRef.current) { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); } }}
            className="ff-b inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-80 border bg-card border-line text-ink">
            <Camera size={17} /> Tirar foto
          </button>
        </div>
        <button onClick={() => onRun(SAMPLE, true)}
          className="ff-b mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-70 mx-auto text-ink-soft">
          <Sparkles size={13} /> ver demonstração com lista de exemplo
        </button>

        {listError && (
          <div className="pop mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left bg-amber-soft border-amber-line">
            <X size={16} className="mt-0.5 shrink-0 text-amber-dk" />
            <p className="ff-b text-xs leading-snug text-amber-dk">{listError}</p>
          </div>
        )}
        <button onClick={() => setShowPaste((s) => !s)}
          className="ff-b mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-all hover:opacity-70 text-primary">
          <ClipboardPaste size={14} /> ou colar a lista em texto
        </button>

        {showPaste && (
          <div className="pop mt-4 text-left">
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={7}
              className="ff-b w-full text-sm rounded-xl border p-3 resize-none outline-none border-line bg-canvas text-ink"
              placeholder="Cole aqui os itens da sua lista, um por linha…" />
            <button onClick={() => onRun(raw, false)}
              className="ff-b mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 bg-accent-card">
              <Search size={16} /> Analisar esta lista
            </button>
          </div>
        )}

        <button onClick={() => setShowConn((s) => !s)}
          className={`ff-b mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-70 ${backendOn ? "text-emerald" : "text-ink-soft"}`}>
          <Wifi size={13} /> {backendOn ? "Backend conectado" : "conectar a um backend real"}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        {[[ScanLine, "Lê foto e PDF", "OCR entende listas escritas à mão ou impressas"],
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
