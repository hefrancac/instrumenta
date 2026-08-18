// Extrai o texto de um PDF direto no navegador (grátis, offline) via pdf.js.
// Reagrupa por linha usando a coordenada Y de cada trecho, pra reconstruir as
// linhas da lista (o matcher trabalha linha a linha). PDFs escaneados (imagem)
// devolvem pouco/nenhum texto -> quem chama trata como "precisa de OCR".
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 80;   // guarda contra PDFs gigantes travarem a aba

export async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, MAX_PAGES);
  let out = "";
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const rows = new Map();                 // Y arredondado -> trechos daquela linha
    for (const it of content.items) {
      const s = it.str;
      if (!s || !s.trim()) continue;
      const y = Math.round(it.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(s);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);   // de cima pra baixo
    for (const y of ys) out += rows.get(y).join(" ").trim() + "\n";
    out += "\n";
  }
  return out;
}
