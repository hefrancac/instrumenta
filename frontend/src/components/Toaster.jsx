import { useEffect, useState } from "react";
import { Check, Info, AlertTriangle } from "lucide-react";
import { subscribe } from "../utils/toast";

const ICON = { success: Check, info: Info, error: AlertTriangle };

// Pilha de toasts flutuantes (canto inferior). Assina o pub/sub e auto-remove.
export default function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribe((t) => {
    setToasts((cur) => [...cur, t]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), t.duration);
  }), []);

  return (
    <div className="fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 pointer-events-none"
      aria-live="polite" aria-atomic="true">
      {toasts.map((t) => {
        const Icon = ICON[t.type] || Check;
        const tone = t.type === "error" ? "text-danger" : t.type === "info" ? "text-primary" : "text-emerald";
        return (
          <div key={t.id} className="pop pointer-events-auto flex items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg bg-card border-line max-w-sm">
            <Icon size={16} className={`shrink-0 ${tone}`} />
            <span className="ff-b text-sm">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
