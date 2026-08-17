import { useState } from "react";
import { CATALOG } from "../constants/catalog";
import { norm } from "../utils/format";

// Seletor de correção manual do produto reconhecido. Mantém o estado da busca
// LOCAL (não sobe pro App), então digitar aqui não re-renderiza a lista inteira.
export default function ProductPicker({ currentId, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const nq = norm(query);
  const results = CATALOG
    .filter((c) => !nq || norm(c.std).includes(nq) || c.kw.some((k) => k.includes(nq)))
    .slice(0, 30);
  return (
    <div className="pop mt-2 rounded-xl border p-2 border-line bg-canvas">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar o produto certo…"
        className="ff-b w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none mb-1.5 border-line bg-card text-ink" />
      <div className="overflow-auto" style={{ maxHeight: 176 }}>
        {results.map((c) => (
          <button key={c.id} onClick={() => { onPick(c.id); onClose(); }}
            className={`ff-b w-full text-left text-sm px-2 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center justify-between gap-2 text-ink ${c.id === currentId ? "bg-primary-soft" : ""}`}>
            <span className="truncate">{c.std}</span>
            <span className="ff-b text-xs shrink-0 text-ink-soft">{c.cat}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
