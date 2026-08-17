import {
  TrendingDown, Store, Coins, BadgeCheck, ChevronDown, Package, Truck, ExternalLink,
} from "lucide-react";
import { STORES } from "../constants/stores";
import { brl, fresh, goUrl } from "../utils/format";
import StoreDot from "../components/StoreDot";
import FreeShip from "../components/FreeShip";

// Tela de resultados. Recebe o objeto otimizado (opt) e o estado de view (single/multi).
export default function ResultsStage({ opt, view, setView, openStore, setOpenStore }) {
  if (!opt) return null;
  return (
    <div className="fadeup">
      <div className="mb-4">
        <h2 className="ff-d text-2xl font-bold tracking-tight">Melhores preços</h2>
        <p className="ff-b text-sm mt-1 text-ink-soft">
          {opt.active.length} itens comparados em {STORES.length} dentais.
        </p>
        <p className="ff-b text-xs mt-1 text-amber-dk">
          Preços estimados — confirme na loja antes de comprar.
        </p>
      </div>

      {/* Recomendação */}
      <div className="rounded-2xl p-4 mb-4 text-white pop bg-accent-card">
        <div className="flex items-start gap-3">
          <div className="rounded-xl flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, background: "rgba(255,255,255,.12)" }}>
            <TrendingDown size={20} className="text-amber" />
          </div>
          <div className="flex-1">
            {opt.recommendMulti ? (
              <>
                <p className="ff-d text-base font-semibold">
                  Dividindo em {opt.multi.storeCount} lojas você economiza{" "}
                  <span className="text-amber">{brl(opt.savings)}</span>
                </p>
                <p className="ff-b text-sm mt-0.5 text-white/70">
                  vs. comprar tudo em {(opt.cheapestFull || opt.bestSingle).store.name} ({brl(opt.baseSingleTotal)}).
                  Já contando fretes e o frete grátis por valor.
                </p>
              </>
            ) : (
              <>
                <p className="ff-d text-base font-semibold">
                  Vale mais a pena comprar tudo em uma loja só
                </p>
                <p className="ff-b text-sm mt-0.5 text-white/70">
                  {(opt.cheapestFull || opt.bestSingle).free
                    ? "Concentrar o pedido atinge o frete grátis — dividir sairia mais caro."
                    : "Dividir sairia mais caro por causa dos fretes extras."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div role="group" aria-label="Modo de comparação de preços"
        className="flex gap-1 p-1 rounded-xl mb-4 bg-toggle">
        {[["single", "Loja única", Store], ["multi", "Melhor preço", Coins]].map(([id, label, Icon]) => {
          const on = view === id;
          return (
            <button key={id} onClick={() => setView(id)} aria-pressed={on}
              className={`ff-b flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${on ? "bg-card text-ink" : "text-ink-soft"}`}
              style={{ boxShadow: on ? "0 1px 3px rgba(0,0,0,.06)" : "none" }}>
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </div>

      {/* SINGLE STORE */}
      {view === "single" && (
        <div className="space-y-3">
          {opt.ranking.map((r) => {
            const isBest = r.store.id === (opt.cheapestFull || opt.bestSingle).store.id;
            const full = r.coverage === opt.active.length;
            const open = openStore === r.store.id;
            const sortedDesc = [...r.covered].sort((a, b) => b.price - a.price);
            return (
              <div key={r.store.id} className={`rounded-2xl border overflow-hidden bg-card ${isBest ? "border-primary" : "border-line"}`}
                style={{ borderWidth: isBest ? 2 : 1 }}>
                <button onClick={() => setOpenStore(open ? null : r.store.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left transition-all hover:opacity-95">
                  <StoreDot store={r.store} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="ff-d text-sm font-semibold">{r.store.name}</p>
                      {full
                        ? <span className="ff-b inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                            <BadgeCheck size={12} /> Tem todos
                          </span>
                        : <span className="ff-b text-xs font-medium px-2 py-0.5 rounded-full bg-amber-chip text-amber-dk">
                            faltam {r.missing.length}
                          </span>}
                    </div>
                    <p className="ff-b text-xs mt-0.5 text-ink-soft">
                      {r.coverage}/{opt.active.length} itens · {r.free ? "frete grátis" : `frete ${brl(r.shipping)}`}
                    </p>
                    {r.coverage > 0 && <FreeShip store={r.store} subtotal={r.subtotal} free={r.free} toFree={r.toFree} compact />}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`ff-n text-lg font-bold ${isBest ? "text-primary" : "text-ink"}`}>{brl(r.total)}</p>
                    <ChevronDown size={16} className="ml-auto transition-transform text-ink-soft"
                      style={{ transform: open ? "rotate(180deg)" : "none" }} />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-line">
                    <p className="ff-b text-xs px-3.5 pt-3 pb-1 font-medium text-ink-soft">
                      Itens do maior ao menor preço
                    </p>
                    <div className="px-3.5 pb-1">
                      {sortedDesc.map(({ it, price, unit, qty, image, offer_id }) => (
                        <div key={it.uid} className="flex items-center justify-between py-1.5 border-b last:border-0 border-divider">
                          <a href={goUrl(r.store, it)} target="_blank" rel="noopener noreferrer"
                            title="Ver este produto na loja"
                            className="ff-b text-sm pr-3 flex items-center gap-2 min-w-0 hover:underline text-ink">
                            {image && <img src={image} alt="" loading="lazy" className="rounded object-cover shrink-0 border border-line bg-white"
                              style={{ width: 30, height: 30 }}
                              onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                            <span className="truncate">
                              {it.std}
                              {qty > 1 && <span className="ff-n ml-1.5 text-ink-soft" style={{ fontSize: 11 }}>{qty}× {brl(unit)}</span>}
                            </span>
                            <ExternalLink size={11} className="shrink-0 text-ink-soft opacity-50" />
                          </a>
                          <span className="ff-n text-sm font-semibold shrink-0">{brl(price)}</span>
                        </div>
                      ))}
                    </div>
                    {r.missing.length > 0 && (
                      <p className="ff-b text-xs px-3.5 py-2 text-ink-soft">
                        Não disponível aqui: {r.missing.map((m) => m.std).join(", ")}
                      </p>
                    )}
                    <div className="flex items-center justify-between px-3.5 py-3 border-t border-line bg-canvas">
                      <div className="ff-b text-xs text-ink-soft">
                        <span className="flex items-center gap-1"><Package size={12} /> subtotal {brl(r.subtotal)}</span>
                        <span className="flex items-center gap-1 mt-0.5"><Truck size={12} /> {r.free ? "frete grátis" : `frete ${brl(r.shipping)}`}</span>
                        {r.covered.length > 0 && (
                          <span className="flex items-center gap-1 mt-0.5 text-emerald">
                            <BadgeCheck size={12} /> preços {fresh(Math.max(...r.covered.map((c) => c.ageH)))}
                          </span>
                        )}
                      </div>
                      <a href={r.store.url} target="_blank" rel="noopener noreferrer"
                        className="ff-b inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90"
                        style={{ background: r.store.color }}>
                        Ir para a loja <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MULTI STORE */}
      {view === "multi" && (
        <div className="space-y-3">
          <p className="ff-b text-sm text-ink-soft">
            Distribuição que minimiza <b>preço + frete</b> — aproveitando o frete grátis — em {opt.multi.storeCount} {opt.multi.storeCount === 1 ? "pedido" : "pedidos"}.
          </p>
          {opt.multi.groups.map((g) => {
            const sortedDesc = [...g.lines].sort((a, b) => b.price - a.price);
            return (
              <div key={g.store.id} className="rounded-2xl border overflow-hidden bg-card border-line">
                <div className="flex items-center gap-3 p-3.5 border-b border-line">
                  <StoreDot store={g.store} size={34} />
                  <div className="flex-1">
                    <p className="ff-d text-sm font-semibold">{g.store.name}</p>
                    <p className="ff-b text-xs text-ink-soft">{g.lines.length} {g.lines.length === 1 ? "item" : "itens"} · preços {fresh(g.oldest)}</p>
                    <FreeShip store={g.store} subtotal={g.subtotal} free={g.free} toFree={g.toFree} compact />
                  </div>
                  <p className="ff-n text-base font-bold">{brl(g.subtotal + g.shipping)}</p>
                </div>
                <div className="px-3.5 py-1">
                  {sortedDesc.map(({ it, price, unit, qty, image, offer_id }) => (
                    <div key={it.uid} className="flex items-center justify-between py-1.5 border-b last:border-0 border-divider">
                      <a href={goUrl(g.store, it)} target="_blank" rel="noopener noreferrer"
                        title="Ver este produto na loja"
                        className="ff-b text-sm pr-3 flex items-center gap-2 min-w-0 hover:underline text-ink">
                        {image && <img src={image} alt="" loading="lazy" className="rounded object-cover shrink-0 border border-line bg-white"
                          style={{ width: 30, height: 30 }}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                        <span className="truncate">
                          {it.std}
                          {qty > 1 && <span className="ff-n ml-1.5 text-ink-soft" style={{ fontSize: 11 }}>{qty}× {brl(unit)}</span>}
                        </span>
                        <ExternalLink size={11} className="shrink-0 text-ink-soft opacity-50" />
                      </a>
                      <span className="ff-n text-sm font-semibold shrink-0">{brl(price)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-canvas">
                  <span className={`ff-b text-xs flex items-center gap-1 ${g.free ? "text-primary" : "text-ink-soft"}`}>
                    <Truck size={12} /> {g.free ? "frete grátis" : `frete ${brl(g.shipping)}`}
                  </span>
                  <a href={g.store.url} target="_blank" rel="noopener noreferrer"
                    className="ff-b inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold transition-all hover:opacity-90"
                    style={{ background: g.store.color }}>
                    Ir para a loja <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl p-4 bg-primary-soft border border-banner-line">
            <div className="flex items-center justify-between mb-1.5">
              <span className="ff-b text-sm text-ink-soft">Produtos</span>
              <span className="ff-n text-sm font-semibold">{brl(opt.multi.itemsCost)}</span>
            </div>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-banner-line">
              <span className="ff-b text-sm flex items-center gap-1 text-ink-soft">
                <Truck size={13} /> {opt.multi.storeCount} {opt.multi.storeCount === 1 ? "frete" : "fretes"}
              </span>
              <span className="ff-n text-sm font-semibold">{brl(opt.multi.totalShipping)}</span>
            </div>
            {opt.multi.shippingSaved > 0.5 && (
              <div className="flex items-center gap-1.5 -mt-1 mb-2 ff-b text-xs text-emerald">
                <BadgeCheck size={13} /> {brl(opt.multi.shippingSaved)} de frete economizados por atingir o frete grátis
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="ff-d text-base font-bold text-primary">Total</span>
              <span className="ff-n text-xl font-bold text-primary">{brl(opt.multi.total)}</span>
            </div>
            {opt.savings > 0.5 && (
              <p className="ff-b text-xs mt-2 flex items-center gap-1 text-primary">
                <TrendingDown size={13} /> {brl(opt.savings)} mais barato que a loja única
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
