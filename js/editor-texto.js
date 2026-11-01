// Editor dos textos longos do painel: barra de formatação, prévia e tela cheia.
// O texto continua sendo texto simples, com marcas que o site transforma em formatação (ver texto.js).

const SVG_AL = (tipo) => {
  const l = { esquerda: [[3, 21], [3, 15], [3, 19], [3, 13]], centro: [[3, 21], [6, 18], [4, 20], [7, 17]], direita: [[3, 21], [9, 21], [5, 21], [11, 21]], justificado: [[3, 21], [3, 21], [3, 21], [3, 13]] }[tipo];
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${l.map(([a, b], i) => `<line x1="${a}" x2="${b}" y1="${5 + i * 5}" y2="${5 + i * 5}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`).join("")}</svg>`;
};

// Troca o trecho [a, b) por txt mantendo o "desfazer" do navegador quando possível, e avisa que o texto mudou.
function trocar(t, a, b, txt) {
  t.focus(); t.setSelectionRange(a, b);
  let ok = false;
  try { ok = document.execCommand("insertText", false, txt); } catch (e) { ok = false; }
  if (!ok) { t.setRangeText(txt, a, b, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); }
}

function envolver(t, m) {
  const v = t.value; let a = t.selectionStart, b = t.selectionEnd;
  while (a < b && /\s/.test(v[a])) a++;
  while (b > a && /\s/.test(v[b - 1])) b--;
  const sel = v.slice(a, b);
  if (v.slice(a - m.length, a) === m && v.slice(b, b + m.length) === m) {          // já marcado por fora: desmarca
    trocar(t, a - m.length, b + m.length, sel); t.setSelectionRange(a - m.length, b - m.length); return;
  }
  if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m)) {          // marcas dentro da seleção: desmarca
    const s = sel.slice(m.length, -m.length); trocar(t, a, b, s); t.setSelectionRange(a, a + s.length); return;
  }
  if (!sel) { trocar(t, a, b, m + "texto" + m); t.setSelectionRange(a + m.length, a + m.length + 5); return; }
  // Vários parágrafos: marca cada um (as marcas não atravessam linhas).
  const novo = sel.split("\n").map(l => {
    const pre = (l.match(/^\[(centro|direita|justificado)\]\s?/) || [""])[0], resto = l.slice(pre.length);
    return resto.trim() ? pre + m + resto + m : l;
  }).join("\n");
  trocar(t, a, b, novo); t.setSelectionRange(a, a + novo.length);
}

function alinhar(t, tipo) {
  const v = t.value, s = t.selectionStart;
  let e = t.selectionEnd; if (e > s && v[e - 1] === "\n") e--;
  const a = v.lastIndexOf("\n", s - 1) + 1;
  let b = v.indexOf("\n", e); if (b < 0) b = v.length;
  const novo = v.slice(a, b).split("\n").map(l => {
    const sem = l.replace(/^\[(centro|direita|justificado)\]\s?/, "");
    return tipo && sem.trim() ? `[${tipo}] ${sem}` : sem;
  }).join("\n");
  trocar(t, a, b, novo); t.setSelectionRange(a, a + novo.length);
}

/**
 * Liga o editor a uma <textarea>.
 * opcoes.render(texto) → HTML da prévia; opcoes.classe() → classes da prévia (para ficar igual ao site).
 */
export function ligarEditor(t, opcoes) {
  if (t.closest(".editor")) return;
  const box = document.createElement("div"); box.className = "editor";
  t.parentNode.insertBefore(box, t);
  box.innerHTML = `<div class="ed-barra" role="toolbar" aria-label="Formatação do texto">
      <button type="button" data-ed="**" title="Negrito (Ctrl+B)" aria-label="Negrito"><b>N</b></button>
      <button type="button" data-ed="//" title="Itálico (Ctrl+I)" aria-label="Itálico"><i>I</i></button>
      <button type="button" data-ed="__" title="Sublinhado (Ctrl+U)" aria-label="Sublinhado"><u>S</u></button>
      <button type="button" data-ed="==" title="Marca-texto" aria-label="Marca-texto"><mark>Destaque</mark></button>
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
    <p class="ed-ajuda small" hidden>Selecione um trecho e toque num botão. No texto, as marcas aparecem assim:
      <code>**negrito**</code>, <code>//itálico//</code>, <code>__sublinhado__</code> e <code>==destaque==</code>.
      O alinhamento vale para o parágrafo inteiro (ou o verso) e aparece como <code>[centro]</code>, <code>[direita]</code> ou <code>[justificado]</code> no começo da linha.
      Para tirar uma marca, selecione o trecho marcado e toque no mesmo botão. A <b>Prévia</b> mostra como fica no site.</p>
    <div class="ed-corpo"><div class="ed-escrita"></div><div class="ed-previa" hidden><span class="label">Prévia</span><div class="ed-previa-txt"></div></div></div>`;
  box.querySelector(".ed-escrita").append(t);
  const previa = box.querySelector(".ed-previa"), previaTxt = box.querySelector(".ed-previa-txt");
  const bPrevia = box.querySelector("[data-ed-previa]"), bCheio = box.querySelector("[data-ed-cheio]");
  const atualizar = () => {
    if (previa.hidden) return;
    previaTxt.className = "ed-previa-txt " + (opcoes.classe ? opcoes.classe() : "");
    previaTxt.innerHTML = t.value.trim() ? opcoes.render(t.value) : `<p class="vazio">Nada escrito ainda.</p>`;
  };
  const mostrarPrevia = (sim) => { previa.hidden = !sim; bPrevia.setAttribute("aria-pressed", String(sim)); atualizar(); };
  const cheio = (sim) => {
    box.classList.toggle("cheio", sim);
    bCheio.textContent = sim ? "Sair da tela cheia" : "Tela cheia";
    document.body.style.overflow = sim ? "hidden" : "";
    if (sim && innerWidth >= 900) mostrarPrevia(true);
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.focus();
  };
  box.querySelector(".ed-barra").addEventListener("mousedown", (ev) => { if (ev.target.closest("[data-ed],[data-al]")) ev.preventDefault(); });
  box.querySelector(".ed-barra").addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.ed) envolver(t, b.dataset.ed);
    else if (b.dataset.al !== undefined) alinhar(t, b.dataset.al);
    else if (b.hasAttribute("data-ed-previa")) mostrarPrevia(previa.hidden);
    else if (b.hasAttribute("data-ed-cheio")) cheio(!box.classList.contains("cheio"));
    else if (b.hasAttribute("data-ed-ajuda")) { const a = box.querySelector(".ed-ajuda"); a.hidden = !a.hidden; b.setAttribute("aria-expanded", String(!a.hidden)); }
  });
  t.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && box.classList.contains("cheio")) { ev.preventDefault(); ev.stopPropagation(); cheio(false); return; }
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const m = { b: "**", i: "//", u: "__" }[ev.key.toLowerCase()];
    if (m) { ev.preventDefault(); envolver(t, m); }
  });
  t.addEventListener("input", atualizar);
  return { atualizar, sair: () => box.classList.contains("cheio") && cheio(false) };
}
