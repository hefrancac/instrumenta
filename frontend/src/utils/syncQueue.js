// Fila de sincronização (localStorage): quando um PATCH falha por falta de rede,
// a ação fica guardada; ao voltar online, drena-se a fila re-enviando cada uma.
const QKEY = "instrumenta:syncQueue";

export function loadQueue() {
  try { const s = localStorage.getItem(QKEY); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* ignore */ }
}
export function queueSize() { return loadQueue().length; }
export function clearQueue() { try { localStorage.removeItem(QKEY); } catch { /* ignore */ } }

export function enqueue(action) {
  const q = loadQueue();
  // Squash: se já há uma ação pendente para a mesma url+método, faz merge do body
  // (os valores novos sobrescrevem os antigos) em vez de acumular requisições.
  const existing = q.find((a) => a.url === action.url && a.method === action.method);
  if (existing) {
    existing.body = { ...(existing.body || {}), ...(action.body || {}) };
  } else {
    q.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...action });
  }
  saveQueue(q);
}

// Envia cada ação via sender(action)->Promise. As que subirem saem da fila;
// as que falharem de novo permanecem para a próxima tentativa. Retorna quantas subiram.
export async function drainQueue(sender) {
  const q = loadQueue();
  if (!q.length) return 0;
  const remaining = [];
  let sent = 0;
  for (const action of q) {
    try { await sender(action); sent++; }
    catch { remaining.push(action); }
  }
  saveQueue(remaining);
  return sent;
}
