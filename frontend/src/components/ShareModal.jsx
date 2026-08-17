import { useEffect, useRef } from "react";
import { X, ClipboardPaste } from "lucide-react";

// Modal de compartilhar/copiar. Faz focus-trap (Tab não escapa para trás do overlay)
// e fecha no Escape — navegação por teclado acessível.
export default function ShareModal({ title, text, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const focusables = () => [...el.querySelectorAll('button, textarea, a[href], input, [tabindex]:not([tabindex="-1"])')];
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(12,43,41,.45)" }} onClick={onClose}
      role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className="pop w-full max-w-md rounded-2xl p-4 bg-card"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="ff-d text-base font-bold">{title}</p>
          <button onClick={onClose} aria-label="fechar" className="hover:opacity-70">
            <X size={18} className="text-ink-soft" />
          </button>
        </div>
        <p className="ff-b text-xs mb-2 text-ink-soft">
          Copiado! {title.includes("Link") ? "Mande o link pra turma — a lista abre montada." : "Cole no site de cada dental — ou mande no grupo."}
        </p>
        <textarea readOnly value={text} rows={10} onFocus={(e) => e.target.select()}
          className="ff-m w-full text-xs rounded-xl border p-3 resize-none outline-none border-line bg-canvas text-ink" />
        <button onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); }}
          className="ff-b mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 bg-primary">
          <ClipboardPaste size={16} /> Copiar de novo
        </button>
      </div>
    </div>
  );
}
