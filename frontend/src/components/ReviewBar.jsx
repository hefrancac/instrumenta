import { ExternalLink, ArrowRight } from "lucide-react";
import { brl } from "../utils/format";

// Barra fixa inferior da tela de revisão: resumo + compartilhar + ir para preços.
export default function ReviewBar({ activeCount, ownedCount, reviewFrom, onShareLink, onGoResults, loading }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card border-line">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="ff-b text-xs text-ink-soft">
            {activeCount} itens {ownedCount > 0 && `· ${ownedCount} você já tem`}
          </p>
          <p className="ff-n text-lg font-bold">a partir de {brl(reviewFrom)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onShareLink} disabled={activeCount === 0} aria-label="Compartilhar lista"
            title="Compartilhar lista por link"
            className="ff-b inline-flex items-center justify-center p-3 rounded-xl border transition-all hover:opacity-80 disabled:opacity-40 border-line text-ink bg-card">
            <ExternalLink size={17} />
          </button>
          <button onClick={onGoResults} disabled={loading || activeCount === 0}
            className="ff-b inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-sm bg-primary"
            style={{ opacity: activeCount === 0 ? 0.4 : 1 }}>
            {loading ? "Calculando…" : <>Ver melhores preços <ArrowRight size={17} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
