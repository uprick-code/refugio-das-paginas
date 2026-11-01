// Formatação simples dos textos longos (Baú da Escrita e fichas dos cadernos).
// **negrito**  //itálico//  __sublinhado__  ==marca-texto==   e, no começo da linha, [centro] ou [direita].
import { esc } from "./firebase.js?v=20261101e";

const ALINHA = /^\[(centro|direita)\]\s?/;
export function formatarLinha(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/(^|[^:])\/\/(.+?)\/\//g, "$1<em>$2</em>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>");
}
function alinhamento(linha) {
  const m = linha.match(ALINHA);
  return m ? { cls: ` class="al-${m[1]}"`, txt: linha.replace(ALINHA, "") } : { cls: "", txt: linha };
}
// Prosa: cada linha é um parágrafo.
export function paragrafosHTML(t) {
  return String(t || "").replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean)
    .map(l => { const a = alinhamento(l); return `<p${a.cls}>${formatarLinha(a.txt)}</p>`; }).join("");
}
// Poema: cada linha é um verso; linha em branco separa as estrofes.
export function poemaHTML(t) {
  return String(t || "").replace(/\r/g, "").split(/\n\s*\n/).map(e => e.replace(/^\n+|\s+$/g, "")).filter(Boolean)
    .map(e => `<p class="estrofe">${e.split("\n").map(l => { const a = alinhamento(l); return `<span class="verso${a.cls ? " " + a.cls.slice(8, -1) : ""}">${formatarLinha(a.txt) || "&nbsp;"}</span>`; }).join("")}</p>`).join("");
}
// Texto sem as marcas (para trechos, legendas e imagens de redes sociais).
export function semMarcas(t) {
  return String(t || "").split("\n").map(l => l.replace(ALINHA, "")).join("\n")
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/(^|[^:])\/\/(.+?)\/\//g, "$1$2").replace(/==(.+?)==/g, "$1");
}
