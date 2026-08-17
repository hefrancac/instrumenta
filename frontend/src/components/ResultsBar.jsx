import { ArrowLeft, ClipboardPaste } from "lucide-react";
import { brl } from "../utils/format";

// Barra fixa inferior da tela de resultados: voltar a editar + copiar + total.
export default function ResultsBar({ opt, view, onEdit, onShare }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card border-line">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <button onClick={onEdit}
          className="ff-b inline-flex items-center gap-1.5 text-sm font-medium transition-all hover:opacity-70 text-ink-soft">
          <ArrowLeft size={16} /> Editar lista
        </button>
        <button onClick={onShare}
          className="ff-b inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 shrink-0 bg-accent-card">
          <ClipboardPaste size={14} /> Copiar lista
        </button>
        <div className="text-right">
          <p className="ff-b text-xs text-ink-soft">
            {view === "multi" ? `Total (${opt.multi.storeCount} lojas)` : "Melhor loja única"}
          </p>
          <p className="ff-n text-lg font-bold text-primary">
            {view === "multi" ? brl(opt.multi.total) : brl(opt.baseSingleTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
