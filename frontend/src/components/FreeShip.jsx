import { memo } from "react";
import { Truck } from "lucide-react";
import { brl } from "../utils/format";

// Barra "falta R$X para frete grátis" ou selo de frete grátis conquistado.
function FreeShip({ store, subtotal, free, toFree, compact = false }) {
  if (store.free == null) return null;
  if (free) return (
    <span className="ff-b inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
      <Truck size={12} /> frete GRÁTIS
    </span>
  );
  const pct = Math.max(4, Math.min(100, Math.round((subtotal / store.free) * 100)));
  return (
    <div className={compact ? "mt-1 w-full" : "mt-1.5 w-full"}>
      <div className="h-1.5 rounded-full overflow-hidden bg-track">
        <div className="h-full rounded-full transition-all bg-amber" style={{ width: pct + "%" }} />
      </div>
      <p className="ff-b mt-1 text-amber-dk" style={{ fontSize: 11 }}>
        faltam <b>{brl(toFree)}</b> para frete grátis
      </p>
    </div>
  );
}

export default memo(FreeShip);
