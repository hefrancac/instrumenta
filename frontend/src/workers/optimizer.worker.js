// Web Worker: roda o otimizador de frete FORA da main thread, para a UI seguir a
// 60 FPS mesmo se o cálculo combinatório crescer. Recebe { items, jobId } e devolve
// { ok, opt, jobId } — o jobId volta para o controlador descartar respostas atrasadas.
import { optimize } from "../utils/engine";

self.onmessage = (e) => {
  const { items = [], jobId } = e.data || {};
  try {
    self.postMessage({ ok: true, opt: optimize(items), jobId });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err), jobId });
  }
};
