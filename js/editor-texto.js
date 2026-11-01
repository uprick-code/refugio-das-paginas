// Editor visual dos textos longos do painel: a Taís vê o texto já formatado (negrito, itálico,
// sublinhado, destaque, alinhamento), sem marcas. Por baixo, o texto é guardado na <textarea>
// original no formato simples que o site entende (ver texto.js), então salvar, rascunho e contador seguem iguais.
import { formatarLinha } from "./texto.js?v=20261101g";

const SVG_AL = (tipo) => {
  const l = { esquerda: [[3, 21], [3, 15], [3, 19], [3, 13]], centro: [[3, 21], [6, 18], [4, 20], [7, 17]], direita: [[3, 21], [9, 21], [5, 21], [11, 21]], justificado: [[3, 21], [3, 21], [3, 21], [3, 13]] }[tipo];
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${l.map(([a, b], i) => `<line x1="${a}" x2="${b}" y1="${5 + i * 5}" y2="${5 + i * 5}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`).join("")}</svg>`;
};
const ALINHA = /^\[(centro|direita|justificado)\]\s?/;
const ALINHAMENTOS = ["centro", "direita", "justificado"];

/* ---------- texto simples → editor ---------- */
function paraHTML(txt) {
  const linhas = String(txt || "").replace(/\r/g, "").split("\n");
  return linhas.map(l => {
    const m = l.match(ALINHA), resto = m ? l.replace(ALINHA, "") : l;
    return `<p${m ? ` class="al-${m[1]}"` : ""}>${formatarLinha(resto) || "<br>"}</p>`;
  }).join("");
}

/* ---------- editor → texto simples ---------- */
function inline(no) {
  if (no.nodeType === 3) return no.nodeValue.replace(/ /g, " ").replace(/\n/g, " ");
  if (no.nodeType !== 1) return "";
  const tag = no.tagName, dentro = [...no.childNodes].map(inline).join("");
  if (tag === "BR") return "\n";
  if (!dentro.trim()) return dentro;
  const st = no.style || {};
  let m = "";
  if (tag === "B" || tag === "STRONG" || Number(st.fontWeight) >= 600 || st.fontWeight === "bold") m = "**";
  else if (tag === "I" || tag === "EM" || st.fontStyle === "italic") m = "//";
  else if (tag === "U" || /underline/.test(st.textDecoration || "")) m = "__";
  else if (tag === "MARK") m = "==";
  if (!m) return dentro;
  // As marcas não atravessam linhas: marca cada pedaço e deixa os espaços de fora.
  return dentro.split("\n").map(p => { const a = p.match(/^\s*/)[0], z = p.match(/\s*$/)[0], c = p.trim(); return c ? a + m + c + m + z : p; }).join("\n");
}
function alinhamentoDe(bloco) {
  for (const a of ALINHAMENTOS) if (bloco.classList?.contains("al-" + a)) return a;
  const ta = bloco.style?.textAlign;
  return ta === "center" ? "centro" : ta === "right" ? "direita" : ta === "justify" ? "justificado" : "";
}
function paraTexto(area) {
  const linhas = [];
  const blocos = [...area.childNodes];
  let solto = [];
  const fechaSolto = () => { if (solto.length) { inline({ nodeType: 1, tagName: "SPAN", style: {}, childNodes: solto }).split("\n").forEach(l => linhas.push(l)); solto = []; } };
  for (const b of blocos) {
    if (b.nodeType === 1 && /^(P|DIV|H\d|LI|BLOCKQUOTE)$/.test(b.tagName)) {
      fechaSolto();
      const a = alinhamentoDe(b);
      let txt = [...b.childNodes].map(inline).join("");
      if (txt.endsWith("\n")) txt = txt.slice(0, -1);              // <br> final de parágrafo
      txt.split("\n").forEach(l => linhas.push(a && l.trim() ? `[${a}] ${l}` : l));
    } else solto.push(b);
  }
  fechaSolto();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  return linhas.map(l => l.replace(/[ \t]+$/, "")).join("\n");
}

/* ---------- comandos ---------- */
function blocosDaSelecao(area) {
  const sel = getSelection(); if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  if (!area.contains(r.commonAncestorContainer)) return [];
  return [...area.children].filter(b => r.intersectsNode(b));
}
function marcaTexto(area) {
  const sel = getSelection(); if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0); if (!area.contains(r.commonAncestorContainer)) return;
  const dentroDe = (n) => { while (n && n !== area) { if (n.nodeType === 1 && n.tagName === "MARK") return n; n = n.parentNode; } return null; };
  const m = dentroDe(r.startContainer) || dentroDe(r.endContainer);
  if (m) { m.replaceWith(...m.childNodes); return; }                         // já destacado: tira
  if (r.collapsed) return;
  const marcas = [...area.querySelectorAll("mark")].filter(x => r.intersectsNode(x));
  if (marcas.length) { marcas.forEach(x => x.replaceWith(...x.childNodes)); return; }
  // Destaca trecho a trecho, sem atravessar parágrafos.
  for (const b of blocosDaSelecao(area)) {
    const rb = document.createRange(); rb.selectNodeContents(b);
    if (b.contains(r.startContainer)) rb.setStart(r.startContainer, r.startOffset);
    if (b.contains(r.endContainer)) rb.setEnd(r.endContainer, r.endOffset);
    if (rb.collapsed) continue;
    const mk = document.createElement("mark"); mk.append(rb.extractContents()); rb.insertNode(mk);
  }
}
function alinhar(area, tipo) {
  const blocos = blocosDaSelecao(area);
  blocos.forEach(b => { ALINHAMENTOS.forEach(a => b.classList.remove("al-" + a)); b.style.textAlign = ""; if (tipo) b.classList.add("al-" + tipo); if (!b.className) b.removeAttribute("class"); });
}
function garantirBlocos(area) {
  if (!area.firstChild) { area.innerHTML = "<p><br></p>"; return; }
  // Texto solto direto no editor vira parágrafo.
  [...area.childNodes].forEach(n => {
    if (n.nodeType === 3 && n.nodeValue.trim() || (n.nodeType === 1 && !/^(P|DIV|H\d|LI|BLOCKQUOTE|UL|OL)$/.test(n.tagName))) {
      const p = document.createElement("p"); n.replaceWith(p); p.append(n);
    }
  });
}

/**
 * Liga o editor a uma <textarea> (que fica escondida, guardando o texto).
 * opcoes.render(texto) → HTML da prévia; opcoes.classe() → classes da prévia (para ficar igual ao site).
 */
export function ligarEditor(t, opcoes) {
  if (t.closest(".editor")) return;
  const box = document.createElement("div"); box.className = "editor";
  t.parentNode.insertBefore(box, t);
  box.innerHTML = `<div class="ed-barra" role="toolbar" aria-label="Formatação do texto">
      <button type="button" data-cmd="bold" title="Negrito (Ctrl+B)" aria-label="Negrito"><b>N</b></button>
      <button type="button" data-cmd="italic" title="Itálico (Ctrl+I)" aria-label="Itálico"><i>I</i></button>
      <button type="button" data-cmd="underline" title="Sublinhado (Ctrl+U)" aria-label="Sublinhado"><u>S</u></button>
      <button type="button" data-cmd="mark" title="Marca-texto" aria-label="Marca-texto"><mark>Destaque</mark></button>
      <span class="ed-sep" aria-hidden="true"></span>
      <button type="button" data-al="" title="Alinhar à esquerda" aria-label="Alinhar à esquerda">${SVG_AL("esquerda")}</button>
      <button type="button" data-al="centro" title="Centralizar" aria-label="Centralizar">${SVG_AL("centro")}</button>
      <button type="button" data-al="direita" title="Alinhar à direita" aria-label="Alinhar à direita">${SVG_AL("direita")}</button>
      <button type="button" data-al="justificado" title="Justificar" aria-label="Justificar">${SVG_AL("justificado")}</button>
      <span class="ed-sep" aria-hidden="true"></span>
      <button type="button" class="ed-txt" data-ed-previa aria-pressed="false">Prévia</button>
      <button type="button" class="ed-txt" data-ed-cheio>Tela cheia</button>
      <button type="button" class="ed-txt" data-ed-ajuda aria-expanded="false" title="Como funciona">?</button>
    </div>
    <p class="ed-ajuda small" hidden>Escreva normalmente. Para formatar, selecione um trecho e toque num botão; para tirar, selecione de novo e toque no mesmo botão.
      O alinhamento vale para o parágrafo inteiro (ou o verso). No computador também valem Ctrl+B, Ctrl+I e Ctrl+U.
      A <b>Prévia</b> mostra o texto do jeito exato da página (num poema, por exemplo, com os versos e as estrofes).</p>
    <div class="ed-corpo"><div class="ed-escrita"><div class="ed-area" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" lang="pt-BR"></div></div>
      <div class="ed-previa" hidden><span class="label">Prévia</span><div class="ed-previa-txt"></div></div></div>`;
  const area = box.querySelector(".ed-area");
  box.querySelector(".ed-escrita").append(t);
  t.classList.add("ed-guardado"); t.removeAttribute("required"); t.tabIndex = -1; t.setAttribute("aria-hidden", "true");
  if (t.placeholder) area.dataset.placeholder = t.placeholder;
  const rotulo = document.querySelector(`label[for="${t.id}"]`);
  if (rotulo) { area.setAttribute("aria-label", rotulo.textContent.trim()); rotulo.addEventListener("click", (e) => { e.preventDefault(); area.focus(); }); }

  // A textarea continua sendo a "fonte": quando o painel muda o valor dela, o editor redesenha.
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  const desenhar = () => { area.innerHTML = paraHTML(proto.get.call(t)); area.classList.toggle("vazio", !proto.get.call(t)); };
  Object.defineProperty(t, "value", { configurable: true, get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); desenhar(); } });
  t.form?.addEventListener("reset", () => setTimeout(desenhar, 0));
  desenhar();

  const previa = box.querySelector(".ed-previa"), previaTxt = box.querySelector(".ed-previa-txt");
  const bPrevia = box.querySelector("[data-ed-previa]"), bCheio = box.querySelector("[data-ed-cheio]");
  const atualizar = () => {
    if (previa.hidden) return;
    previaTxt.className = "ed-previa-txt " + (opcoes.classe ? opcoes.classe() : "");
    previaTxt.innerHTML = t.value.trim() ? opcoes.render(t.value) : `<p class="vazio">Nada escrito ainda.</p>`;
  };
  const sincronizar = () => {
    garantirBlocos(area);
    const txt = paraTexto(area);
    if (txt !== proto.get.call(t)) { proto.set.call(t, txt); t.dispatchEvent(new Event("input", { bubbles: true })); }
    area.classList.toggle("vazio", !txt);
    atualizar();
  };
  area.addEventListener("input", sincronizar);
  area.addEventListener("focus", () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); document.execCommand("styleWithCSS", false, false); } catch (e) {} });
  // Colar sempre como texto simples (sem fontes e cores de outros lugares).
  area.addEventListener("paste", (ev) => {
    ev.preventDefault();
    const txt = (ev.clipboardData || window.clipboardData).getData("text/plain");
    const html = txt.replace(/\r/g, "").split("\n").map(l => `<p>${l.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) || "<br>"}</p>`).join("");
    document.execCommand("insertHTML", false, txt.includes("\n") ? html : html.slice(3, -4));
  });

  const mostrarPrevia = (sim) => { previa.hidden = !sim; bPrevia.setAttribute("aria-pressed", String(sim)); atualizar(); };
  const cheio = (sim) => {
    box.classList.toggle("cheio", sim);
    bCheio.textContent = sim ? "Sair da tela cheia" : "Tela cheia";
    document.body.style.overflow = sim ? "hidden" : "";
    if (sim && innerWidth >= 900) mostrarPrevia(true);
    area.focus();
  };
  box.querySelector(".ed-barra").addEventListener("mousedown", (ev) => { if (ev.target.closest("[data-cmd],[data-al]")) ev.preventDefault(); });
  box.querySelector(".ed-barra").addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.cmd) {
      if (!area.contains(getSelection().anchorNode)) area.focus();
      if (b.dataset.cmd === "mark") marcaTexto(area); else document.execCommand(b.dataset.cmd, false, null);
      sincronizar();
    } else if (b.dataset.al !== undefined) {
      if (!area.contains(getSelection().anchorNode)) area.focus();
      garantirBlocos(area); alinhar(area, b.dataset.al); sincronizar();
    }
    else if (b.hasAttribute("data-ed-previa")) mostrarPrevia(previa.hidden);
    else if (b.hasAttribute("data-ed-cheio")) cheio(!box.classList.contains("cheio"));
    else if (b.hasAttribute("data-ed-ajuda")) { const a = box.querySelector(".ed-ajuda"); a.hidden = !a.hidden; b.setAttribute("aria-expanded", String(!a.hidden)); }
  });
  area.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && box.classList.contains("cheio")) { ev.preventDefault(); ev.stopPropagation(); cheio(false); }
  });
  return { atualizar, sair: () => box.classList.contains("cheio") && cheio(false) };
}

// Exportado para testes.
export const _interno = { paraHTML, paraTexto };
