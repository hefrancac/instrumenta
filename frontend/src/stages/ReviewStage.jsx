import { useState } from "react";
import { Sparkles, Check, Trash2 } from "lucide-react";
import { brandMin } from "../utils/engine";
import { brl } from "../utils/format";
import CatChip from "../components/CatChip";
import ProductPicker from "../components/ProductPicker";

// Tela de conferência da lista. Estado de edição (qual item/linha está aberto) é local.
export default function ReviewStage({
  items, unmatched, demo,
  toggleOwned, setQty, remove, setBrand, setProduct,
  onResolveUnmatched, onNewList,
}) {
  const [editUid, setEditUid] = useState(null);   // item cujo produto está sendo corrigido
  const [addRaw, setAddRaw] = useState(null);      // linha "não reconhecida" sendo resolvida

  return (
    <div className="fadeup">
      <div className="mb-5">
        <h2 className="ff-d text-2xl font-bold tracking-tight">Confira sua lista</h2>
        <p className="ff-b text-sm mt-1 text-ink-soft">
          {items.length} itens reconhecidos. Marque o que você já tem, escolha a marca
          e a gente busca o resto.
        </p>
      </div>

      {demo && (
        <div className="flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 mb-4 bg-amber-soft border-amber-line">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-dk" />
          <p className="ff-b text-xs leading-snug text-amber-dk">
            Demonstração com uma lista de exemplo. Na versão completa, o OCR lê direto da sua
            foto ou PDF — <button onClick={onNewList} className="underline font-semibold">enviar outra lista</button>.
          </p>
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="rounded-xl border px-3.5 py-3 mb-4 bg-card border-line">
          <p className="ff-b text-xs font-semibold mb-2 text-ink-soft">
            {unmatched.length} não reconhecidos — clique para escolher o produto:
          </p>
          <div className="flex flex-col gap-1.5">
            {unmatched.map((u, i) => (
              <div key={i}>
                <button onClick={() => setAddRaw(addRaw === u ? null : u)}
                  className="ff-b w-full text-left text-xs rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 transition-all hover:opacity-80 border-line text-ink bg-canvas">
                  <span className="truncate">{u}</span>
                  <span className="ff-b text-xs shrink-0 text-primary">
                    {addRaw === u ? "fechar" : "+ escolher"}
                  </span>
                </button>
                {addRaw === u && (
                  <ProductPicker currentId={null}
                    onPick={(catId) => { onResolveUnmatched(u, catId); setAddRaw(null); }}
                    onClose={() => setAddRaw(null)} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((it) => {
          const min = brandMin(it.brands[it.brandIndex]);
          return (
            <div key={it.uid} className="rounded-2xl border p-3.5 transition-all bg-card border-line"
              style={{ opacity: it.owned ? 0.5 : 1 }}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleOwned(it.uid)}
                  className={`mt-0.5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${it.owned ? "bg-primary border-primary" : "border-line"}`}
                  style={{ width: 24, height: 24 }}>
                  {it.owned && <Check size={15} className="text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`ff-d text-sm font-semibold leading-tight ${it.owned ? "line-through" : ""}`}>{it.raw || it.std}</p>
                    <CatChip cat={it.cat} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="ff-b text-xs truncate text-ink-soft">
                      reconhecido como <b className="text-primary">{it.std}</b>
                    </p>
                    {!it.owned && (
                      <button onClick={() => setEditUid(editUid === it.uid ? null : it.uid)}
                        className="ff-b text-xs underline shrink-0 transition-all hover:opacity-70 text-ink-soft">
                        {editUid === it.uid ? "fechar" : "trocar"}
                      </button>
                    )}
                  </div>
                  {editUid === it.uid && (
                    <ProductPicker currentId={it.catId}
                      onPick={(catId) => setProduct(it.uid, catId)}
                      onClose={() => setEditUid(null)} />
                  )}

                  {it.brands.length > 1 && !it.owned && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {it.brands.map((b, bi) => {
                        const on = bi === it.brandIndex;
                        return (
                          <button key={bi} onClick={() => setBrand(it.uid, bi)}
                            className={`ff-b text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${on ? "border-primary bg-primary-soft text-primary" : "border-line bg-card text-ink-soft"}`}>
                            {b.name} · {brl(brandMin(b))}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!it.owned && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="ff-b text-xs text-ink-soft">Qtd</span>
                      <div className="inline-flex items-center rounded-lg border overflow-hidden border-line">
                        <button onClick={() => setQty(it.uid, -1)} aria-label="menos" disabled={(it.qty || 1) <= 1}
                          className="px-2.5 py-0.5 ff-d text-base leading-none transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70 text-ink">–</button>
                        <span className="ff-n text-sm font-bold px-1 text-center" style={{ minWidth: "1.6rem" }}>{it.qty || 1}</span>
                        <button onClick={() => setQty(it.uid, +1)} aria-label="mais" disabled={(it.qty || 1) >= 99}
                          className="px-2.5 py-0.5 ff-d text-base leading-none transition-all active:scale-90 disabled:opacity-30 hover:opacity-70 text-ink">+</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  {!it.owned && (isFinite(min) ? (
                    <>
                      <p className="ff-b text-xs text-ink-soft">{(it.qty || 1) > 1 ? `${brl(min)} × ${it.qty}` : "a partir de"}</p>
                      <p className="ff-n text-sm font-bold">{brl(min * (it.qty || 1))}</p>
                    </>
                  ) : (
                    <p className="ff-b text-xs font-medium text-amber-dk">preço a confirmar</p>
                  ))}
                  <button onClick={() => remove(it.uid)}
                    className="ff-b mt-1 inline-flex items-center gap-1 text-xs transition-all hover:opacity-70 text-ink-soft">
                    <Trash2 size={12} /> remover
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
