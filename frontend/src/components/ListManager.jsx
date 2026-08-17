import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Pencil, Trash2, Check, FolderOpen, Copy } from "lucide-react";

// Gerenciador de listas nomeadas (dropdown no header): trocar, criar, renomear,
// excluir e "salvar como". Usa input inline para nomear (sem prompt()).
export default function ListManager({ lists, activeId, activeName, itemCount, onSwitch, onCreate, onSaveAs, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) { setOpen(false); setEditingId(null); setCreating(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const startRename = (l) => { setEditingId(l.id); setDraft(l.name); setCreating(false); };
  const commitRename = () => { if (draft.trim()) onRename(editingId, draft.trim()); setEditingId(null); };
  const commitCreate = () => { onCreate(draft.trim() || "Nova lista"); setDraft(""); setCreating(false); setOpen(false); };

  return (
    <div className="relative" ref={wrap}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="ff-b inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all hover:opacity-80 border-line text-ink max-w-[9rem]">
        <FolderOpen size={14} className="shrink-0 text-ink-soft" />
        <span className="truncate text-xs font-medium">{activeName || "Minha lista"}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-soft" />
      </button>

      {open && (
        <div role="menu" className="pop absolute right-0 mt-1.5 w-64 rounded-xl border shadow-xl z-30 bg-card border-line overflow-hidden">
          <p className="ff-b text-[11px] font-semibold px-3 pt-2.5 pb-1 text-ink-soft uppercase tracking-wide">Minhas listas</p>
          <div className="max-h-64 overflow-auto">
            {lists.length === 0 && <p className="ff-b text-xs px-3 py-2 text-ink-soft">Nenhuma lista salva ainda.</p>}
            {lists.map((l) => (
              <div key={l.id} className={`flex items-center gap-1 px-2 py-1 ${l.id === activeId ? "bg-primary-soft" : ""}`}>
                {editingId === l.id ? (
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                    onBlur={commitRename}
                    className="ff-b flex-1 min-w-0 text-sm rounded-md border px-2 py-1 outline-none border-line bg-canvas text-ink" />
                ) : (
                  <button onClick={() => { onSwitch(l.id); setOpen(false); }} role="menuitem"
                    className="ff-b flex-1 min-w-0 text-left px-1.5 py-1 rounded-md">
                    <span className={`block truncate text-sm ${l.id === activeId ? "font-semibold text-primary" : "text-ink"}`}>{l.name}</span>
                    <span className="block text-[11px] text-ink-soft">{(l.items?.length || 0)} {(l.items?.length || 0) === 1 ? "item" : "itens"}</span>
                  </button>
                )}
                {editingId === l.id ? (
                  <button onClick={commitRename} aria-label="salvar nome" className="p-1.5 rounded-md hover:opacity-70"><Check size={14} className="text-primary" /></button>
                ) : (
                  <>
                    <button onClick={() => startRename(l)} aria-label="renomear" className="p-1.5 rounded-md hover:opacity-70"><Pencil size={13} className="text-ink-soft" /></button>
                    <button onClick={() => onDelete(l.id)} aria-label="excluir" className="p-1.5 rounded-md hover:opacity-70"><Trash2 size={13} className="text-ink-soft" /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-line p-1.5 flex flex-col gap-1">
            {creating ? (
              <div className="flex items-center gap-1">
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitCreate(); if (e.key === "Escape") { setCreating(false); setDraft(""); } }}
                  placeholder="Nome da lista (ex: Endodontia)"
                  className="ff-b flex-1 min-w-0 text-sm rounded-md border px-2 py-1.5 outline-none border-line bg-canvas text-ink" />
                <button onClick={commitCreate} aria-label="criar" className="p-1.5 rounded-md hover:opacity-70"><Check size={16} className="text-primary" /></button>
              </div>
            ) : (
              <button onClick={() => { setCreating(true); setDraft(""); }}
                className="ff-b inline-flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all hover:opacity-80 text-primary">
                <Plus size={15} /> Nova lista
              </button>
            )}
            {itemCount > 0 && (
              <button onClick={() => { onSaveAs(); setOpen(false); }}
                className="ff-b inline-flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all hover:opacity-80 text-ink-soft">
                <Copy size={14} /> Salvar itens atuais como nova
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
