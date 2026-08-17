import { memo } from "react";
import { ScanLine, ListChecks, ShoppingCart, Check } from "lucide-react";

function Stepper({ step }) {
  const steps = [["Lista", ScanLine], ["Revisar", ListChecks], ["Comprar", ShoppingCart]];
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Progresso: etapa ${step + 1} de 3`}>
      {steps.map(([label, Icon], i) => {
        const active = i === step, done = i < step;
        const tone = active ? "bg-primary text-white" : done ? "bg-primary-soft text-primary" : "text-ink-soft";
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all ${tone}`}
              aria-label={label} aria-current={active ? "step" : undefined}>
              {done ? <Check size={13} /> : <Icon size={13} />}
              <span className="ff-b text-xs font-medium hidden sm:inline" aria-hidden="true">{label}</span>
            </div>
            {i < 2 && <div className="w-3 h-px sm:w-4 bg-line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

export default memo(Stepper);
