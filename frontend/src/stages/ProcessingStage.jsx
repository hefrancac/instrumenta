import { Check, Loader2 } from "lucide-react";
import { STORES } from "../constants/stores";

// Componente "burro": só exibe a animação de processamento a partir das props.
export default function ProcessingStage({ procStep, itemCount, unmatchedCount }) {
  const steps = [
    ["Lendo o documento", `${itemCount + unmatchedCount} linhas`],
    ["Identificando itens", `${itemCount} instrumentais e materiais`],
    ["Padronizando a nomenclatura", "nomes de catálogo"],
    ["Consultando as dentais", `${STORES.length} lojas`],
  ];
  return (
    <div className="fadeup flex flex-col items-center pt-6">
      <div className="relative rounded-2xl border overflow-hidden mb-7 w-full max-w-xs bg-card border-line"
        style={{ height: 190 }}>
        <div className="p-4 space-y-2">
          {[92, 74, 84, 60, 80, 68, 88].map((w, i) => (
            <div key={i} className="h-2.5 rounded-full bg-skeleton" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="scanline" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent,rgba(11,110,95,.04))" }} />
      </div>

      <div className="space-y-2.5 w-full max-w-xs">
        {steps.map(([label, sub], i) => {
          const done = procStep > i, active = procStep === i;
          return (
            <div key={label} className="flex items-center gap-3 transition-all"
              style={{ opacity: procStep >= i ? 1 : 0.35 }}>
              <div className={`rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary" : active ? "bg-primary-soft" : "bg-skeleton"}`}
                style={{ width: 22, height: 22 }}>
                {done ? <Check size={13} className="text-white" />
                  : active ? <Loader2 size={13} className="spin text-primary" />
                  : <div className="w-1.5 h-1.5 rounded-full bg-ink-soft" />}
              </div>
              <div>
                <p className={`ff-b text-sm font-medium ${done || active ? "text-ink" : "text-ink-soft"}`}>{label}</p>
                {(done || active) && <p className="ff-b text-xs text-ink-soft">{sub}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
