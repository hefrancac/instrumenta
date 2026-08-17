// Toast minimalista sem dependência: um pub/sub que qualquer código chama via toast(),
// e o <Toaster/> escuta e renderiza. Leve o suficiente para não justificar uma lib.
let listeners = [];
let seq = 0;

export function toast(message, opts = {}) {
  const t = { id: ++seq, message, type: opts.type || "success", duration: opts.duration ?? 2600 };
  listeners.forEach((l) => l(t));
  return t.id;
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
