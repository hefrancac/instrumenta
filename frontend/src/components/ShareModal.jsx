import { useEffect, useRef } from "react";
import { X, ClipboardPaste } from "lucide-react";

// Modal de compartilhar/copiar sobre <dialog> nativo: o browser entrega backdrop,
// bloqueio de scroll de fundo e focus-trap. O fechamento é feito desmontando o
// componente (onClose) em todos os caminhos — botão, clique no backdrop e Escape
// (evento 'cancel') — sem depender do evento 'close' do <dialog>.
export default function ShareModal({ title, text, onClose }) {
  const ref = useRef(null);
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; }, [onClose]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e) => { e.preventDefault(); cb.current(); };   // Escape
    d?.addEventListener("cancel", onCancel);
    return () => d?.removeEventListener("cancel", onCancel);
  }, []);

  // Clique fora do card (na área do ::backdrop) fecha.
  const onClick = (e) => {
    const d = ref.current;
    if (!d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  };

  return (
    <dialog ref={ref} onClick={onClick} aria-label={title} className="share-dialog pop">
      <div className="p-4">
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
    </dialog>
  );
}
