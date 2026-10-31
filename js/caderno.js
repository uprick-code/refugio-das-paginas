// Caderno de leitura: um formato dos Especiais inspirado nos cadernos da Taís.
// Abertura, coleção de livros, ficha de cada livro, reflexões das leitoras e imagem para redes sociais.
import { db, esc, capaHTML } from "./firebase.js?v=20261031d";
import {
  doc, getDoc, getDocs, addDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ================= temas ================= */
export const TEMAS = {
  estrelas: { nome: "Noite estrelada", cores: ["#8E3B46","#5B6C8F","#C49A3C","#3F6B5B","#7A4E7E","#B5654A","#2F4858","#A3835B","#6E8B5E","#9C5F3B","#46516B","#B08B9E"] },
  campo: { nome: "Campo florido", cores: ["#C8475B","#E2A73B","#3FA3C4","#7DB04A","#8C6FB8","#7E9BA8","#E0B43A","#C94F8A","#3C9FB0","#2F6FB4","#8E3D95","#3A3F4F"] }
};
export const temaDe = (c) => TEMAS[c?.tema] ? c.tema : "estrelas";

/* ================= desenhos provisórios ================= */
export function linhasTexto(ctx, txt, larg) {
  const out = [];
  for (const par of String(txt).split("\n")) {
    let l = "";
    for (const p of par.split(" ")) { const t = l ? l + " " + p : p; if (ctx.measureText(t).width > larg && l) { out.push(l); l = p; } else l = t; }
    out.push(l);
  }
  return out;
}
// Capa provisória: não reproduz a capa real; a Taís troca pela capa de verdade no painel.
export function desenharCapa(cv, l, tema, autor) {
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  const cores = TEMAS[tema]?.cores || TEMAS.estrelas.cores, cor = cores[(l.ordem ?? 0) % cores.length];
  ctx.fillStyle = cor; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,.08)"; for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1);
  if (tema === "campo") {
    ctx.fillStyle = "rgba(255,250,240,.9)"; ctx.beginPath(); ctx.ellipse(w / 2, h * .66, w * .36, h * .22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(110,139,94,.55)"; ctx.beginPath(); ctx.ellipse(w / 2, h * .78, w * .34, h * .08, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(255,245,225,.55)"; ctx.lineWidth = w * .012; ctx.strokeRect(w * .07, h * .05, w * .86, h * .9);
  }
  ctx.fillStyle = "#FBF4E4"; ctx.textAlign = "center";
  let fs = w * .15;
  const fonte = tema === "campo" ? '"Caveat", cursive' : '"Cormorant Garamond", serif';
  const cabe = () => { ctx.font = `600 ${Math.round(fs)}px ${fonte}`; return l.titulo.split(" ").every(p => ctx.measureText(p).width <= w * .78) && linhasTexto(ctx, l.titulo, w * .78).length <= 4; };
  while (!cabe() && fs > w * .07) fs -= 1;
  let y = h * (tema === "campo" ? .17 : .32);
  for (const li of linhasTexto(ctx, l.titulo, w * .78)) { ctx.fillText(li, w / 2, y); y += fs * 1.05; }
  ctx.font = `${Math.round(w * .06)}px "Courier Prime", monospace`;
  ctx.fillStyle = tema === "campo" ? cor : "#FBF4E4";
  ctx.fillText((autor || "").toUpperCase(), w / 2, h * (tema === "campo" ? .69 : .86));
}
export function desenharCartaoCaderno(cv, tema) {
  const ctx = cv.getContext("2d"), w = cv.width, h = cv.height;
  if (tema === "campo") {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#F6D3DA"); g.addColorStop(1, "#EDB8C4"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { ctx.fillStyle = `rgba(255,255,255,${.12 + (k % 3) * .06})`; ctx.beginPath(); ctx.ellipse((k * 71) % w, (k * 113) % h, 50, 30, k, 0, 7); ctx.fill(); }
    casinha(ctx, w / 2, h * .62, w * .55);
    ctx.fillStyle = "#3d6b3a"; ctx.font = `${Math.round(w * .13)}px "Pinyon Script", cursive`; ctx.textAlign = "center"; ctx.fillText("Caderno", w / 2, h * .2);
    return;
  }
  ctx.fillStyle = "#3b2a1e"; ctx.fillRect(0, 0, w, h);
  let seed = 3; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cores = TEMAS.estrelas.cores, prat = 5, ph = h / prat;
  for (let p = 0; p < prat; p++) {
    let x = 6;
    while (x < w - 8) {
      const lw = 10 + r() * 18, lh = ph * (.62 + r() * .3);
      ctx.fillStyle = cores[Math.floor(r() * cores.length)]; ctx.fillRect(x, p * ph + ph - lh - 6, lw, lh);
      ctx.fillStyle = "rgba(255,240,200,.45)"; ctx.fillRect(x + 2, p * ph + ph - lh + 4, lw - 4, 2); ctx.fillRect(x + 2, p * ph + ph - 14, lw - 4, 2);
      x += lw + 1.5;
    }
    ctx.fillStyle = "#5a3d28"; ctx.fillRect(0, p * ph + ph - 6, w, 6);
  }
}
function casinha(ctx, cx, base, larg) {
  const a = larg * .55;
  ctx.fillStyle = "#FBF7EE"; ctx.fillRect(cx - larg / 2, base - a, larg, a);
  ctx.fillStyle = "#3f7d4a"; ctx.beginPath(); ctx.moveTo(cx - larg / 2 - 10, base - a); ctx.lineTo(cx, base - a - larg * .38); ctx.lineTo(cx + larg / 2 + 10, base - a); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + larg * .05, base - a * .55); ctx.lineTo(cx + larg * .3, base - a * 1.05); ctx.lineTo(cx + larg * .55, base - a * .55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5d8fb8"; [[-.3, -.7], [.05, -.7], [-.3, -.35], [.32, -.35]].forEach(([x, y]) => ctx.fillRect(cx + larg * x, base + a * y, larg * .12, a * .18));
  ctx.fillStyle = "#9a3b3b"; ctx.fillRect(cx - larg * .06, base - a * .38, larg * .12, a * .38);
  ctx.fillStyle = "#7DB04A"; ctx.fillRect(cx - larg * .8, base, larg * 1.6, 8);
  ["#E68FA6", "#F2C14E", "#B48AD8", "#E68FA6"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx - larg * .45 + i * larg * .3, base - 4, 7, 0, 7); ctx.fill(); });
}
// Ilustrações provisórias da página da esquerda (as do caderno Byung-Chul Han do protótipo).
export function ilustracaoPadrao(tipo) {
  if (tipo === "lua") {
    let s = `<svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="ceuL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd3e6"/><stop offset=".45" stop-color="#e6cfd2"/><stop offset="1" stop-color="#5a5a86"/></linearGradient></defs>
      <rect width="400" height="520" fill="url(#ceuL)"/><circle cx="120" cy="120" r="78" fill="#e8c98a" opacity=".95"/>
      <circle cx="96" cy="100" r="12" fill="#d7b06f" opacity=".6"/><circle cx="150" cy="140" r="9" fill="#d7b06f" opacity=".5"/>`;
    const pinho = (x, b, a, c) => `<path d="M${x} ${b - a} L${x - a * .22} ${b} L${x + a * .22} ${b} Z" fill="${c}"/><path d="M${x} ${b - a * .75} L${x - a * .28} ${b - a * .1} L${x + a * .28} ${b - a * .1} Z" fill="${c}"/>`;
    [[250, 360, 220, "#3f4a6e"], [300, 380, 260, "#2f3756"], [350, 370, 230, "#3f4a6e"], [200, 400, 170, "#2f3756"], [385, 400, 190, "#262c47"]].forEach(p => s += pinho(...p));
    s += `<path d="M0 420 Q120 380 220 410 T400 400 L400 520 L0 520 Z" fill="#2a2f4a"/><path d="M0 460 Q140 430 260 455 T400 450 L400 520 L0 520 Z" fill="#1f2338"/>`;
    [[60, 445], [90, 455], [140, 440], [330, 450], [360, 462]].forEach(([x, y]) => s += `<circle cx="${x}" cy="${y}" r="5" fill="#e8b5a8"/><circle cx="${x}" cy="${y}" r="2" fill="#e8c98a"/>`);
    return s + `</svg>`;
  }
  if (tipo === "bustos") {
    let s = `<svg viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="520" fill="#d9d0c3"/>`;
    for (let y = 0; y < 520; y += 52) for (let x = (y / 52) % 2 ? 26 : 0; x < 420; x += 52)
      s += `<g transform="translate(${x} ${y})" fill="none" stroke="#b9ad9b" stroke-width="1.2"><path d="M0 -14 C8 -6 8 6 0 14 C-8 6 -8 -6 0 -14Z"/><path d="M-14 0 C-6 -8 6 -8 14 0 C6 8 -6 8 -14 0Z"/></g>`;
    const busto = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" opacity=".9"><ellipse cx="0" cy="-30" rx="20" ry="24" fill="#efebe4"/><path d="M-20 -40 q20 -26 40 0" fill="none" stroke="#cfc8bc" stroke-width="7" stroke-linecap="round"/><path d="M-10 -8 L-12 6 L12 6 L10 -8" fill="#e6e1d8"/><path d="M-34 30 Q0 0 34 30 L30 40 L-30 40 Z" fill="#e9e4db"/><rect x="-22" y="40" width="44" height="10" fill="#d6cfc3"/></g>`;
    [[70, 80, 1.1], [330, 90, 1], [60, 440, 1.05], [340, 450, 1.1], [200, 470, .8]].forEach(b => s += busto(...b));
    return s + `</svg>`;
  }
  return "";
}
function ilustracaoAbertura(tema) {
  if (tema === "campo") {
    return `<svg viewBox="0 0 400 500" role="img" aria-label="Ilustração de abertura: uma casa de telhado verde entre flores">
      <defs><radialGradient id="aqA" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff6ee"/><stop offset=".7" stop-color="#f3d9c6"/><stop offset="1" stop-color="#c9a48a"/></radialGradient></defs>
      <rect width="400" height="500" fill="url(#aqA)"/>
      <path d="M0 360 Q120 320 220 350 T400 340 L400 500 L0 500 Z" fill="#a9c98e" opacity=".8"/>
      <path d="M0 410 Q140 380 260 405 T400 400 L400 500 L0 500 Z" fill="#7DB04A" opacity=".7"/>
      <g transform="translate(200 345)"><rect x="-90" y="-80" width="180" height="80" fill="#FBF7EE"/><path d="M-102 -80 L0 -150 L102 -80 Z" fill="#3f7d4a"/><path d="M10 -45 L55 -112 L100 -45 Z" fill="#3f7d4a"/>
        <rect x="-62" y="-62" width="22" height="20" fill="#5d8fb8"/><rect x="-12" y="-62" width="22" height="20" fill="#5d8fb8"/><rect x="40" y="-40" width="22" height="20" fill="#5d8fb8"/><rect x="-14" y="-34" width="20" height="34" fill="#9a3b3b"/></g>
      ${[[40, 420, "#E68FA6"], [80, 440, "#F2C14E"], [120, 415, "#B48AD8"], [300, 430, "#E68FA6"], [340, 410, "#F2C14E"], [360, 445, "#B48AD8"], [250, 450, "#E68FA6"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/><circle cx="${x}" cy="${y}" r="3" fill="#fff6c8"/>`).join("")}
      <path d="M60 120 q20 -30 40 0 q-20 10 -40 0z M300 90 q20 -30 40 0 q-20 10 -40 0z" fill="#8fb37a" opacity=".55"/></svg>`;
  }
  let s = `<svg viewBox="0 0 400 500" role="img" aria-label="Ilustração de abertura: um livro aberto sobre papel antigo"><defs><radialGradient id="sepA" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#efe2c6"/><stop offset=".7" stop-color="#c9ab7f"/><stop offset="1" stop-color="#6d4f34"/></radialGradient></defs><rect width="400" height="500" fill="url(#sepA)"/>`;
  for (let i = 0; i < 70; i++) s += `<circle cx="${(i * 53) % 400}" cy="${(i * 97) % 500}" r="${(i % 5) + 1}" fill="#5b3f28" opacity=".08"/>`;
  s += `<g transform="translate(200 310)"><path d="M-150 20 Q-75 -30 0 0 Q75 -30 150 20 L150 60 Q75 15 0 40 Q-75 15 -150 60 Z" fill="#f3e9d2" stroke="#6b4a2f" stroke-width="2"/><path d="M0 0 L0 40" stroke="#6b4a2f" stroke-width="2"/>
    ${Array.from({ length: 6 }, (_, k) => `<path d="M-130 ${26 + k * 5} Q-70 ${-14 + k * 5} -12 ${8 + k * 5}" stroke="#a88a63" stroke-width="1" fill="none"/><path d="M130 ${26 + k * 5} Q70 ${-14 + k * 5} 12 ${8 + k * 5}" stroke="#a88a63" stroke-width="1" fill="none"/>`).join("")}
    <path d="M-150 60 Q-75 15 0 40 Q75 15 150 60 L150 70 Q75 25 0 50 Q-75 25 -150 70 Z" fill="#8a2f2a"/></g>
    <text x="200" y="150" text-anchor="middle" font-family="Pinyon Script, cursive" font-size="54" fill="#5b3f28" opacity=".8">reflexões</text></svg>`;
  return s;
}
const JARRO = `<svg viewBox="0 0 90 110" aria-hidden="true"><path d="M30 60 q-12 24 4 44 h22 q16 -20 4 -44 z" fill="#f4efe6" stroke="#b8a68c" stroke-width="2"/><path d="M58 70 q14 0 10 16 q-4 8 -12 6" fill="none" stroke="#b8a68c" stroke-width="3"/>
  ${[[30, 40, "#B48AD8"], [45, 30, "#E68FA6"], [58, 42, "#F2C14E"], [38, 52, "#E68FA6"], [52, 54, "#8C6FB8"], [22, 50, "#F2C14E"]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`).join("")}
  <path d="M40 60 q-6 -14 -14 -22 M48 60 q2 -16 -2 -28 M54 60 q8 -10 12 -20" stroke="#6E8B5E" stroke-width="2" fill="none"/></svg>`;

/* ================= estado ================= */
const C = { usuario: null, admin: false, nomeDe: (u) => u, caderno: null, livros: [], atual: null, reflexoes: [], subRef: null, refShare: null };
const $ = (s) => document.querySelector(s);
export function contextoCaderno(ctx) { Object.assign(C, ctx); }
const estrelasTxt = (n) => `<b>${"★".repeat(n || 0)}</b>${"☆".repeat(5 - (n || 0))}`;
const statusTxt = { lido: "lido", lendo: "lendo", fila: "na fila" };

/* card na seção Especiais */
export function cardCaderno(e, temFoto, fotoHTML) {
  const tema = temaDe(e);
  return `<a class="esp-card cad-card tema-${tema}" href="#cad-${esc(e.id)}">
    <div class="esp-foto">${temFoto ? fotoHTML : `<canvas class="cad-capa-card" width="240" height="360" data-cartao="${tema}" aria-hidden="true"></canvas>`}</div>
    <div class="esp-txt"><span class="label">Caderno${e.titulo ? " · " + esc(e.titulo) : " de leitura"}</span><h3>${esc(e.destaque || e.autor || "")}</h3>
      ${e.chamada ? `<p>${esc(e.chamada)}</p>` : ""}<span class="esp-ler">Abrir o caderno →</span></div></a>`;
}
export function pintarCartoes(raiz = document) {
  raiz.querySelectorAll("canvas[data-cartao]").forEach(c => { if (!c.dataset.ok) { desenharCartaoCaderno(c, c.dataset.cartao); c.dataset.ok = "1"; } });
}

/* ================= abrir pelo endereço ================= */
// #cad-<especial>  ·  #cadl-<livro do caderno>
export async function abrirCadernoPeloEndereco(especiais) {
  const h = location.hash;
  let m = h.match(/^#cad-(.+)$/), livroId = null, cadId = m ? decodeURIComponent(m[1]) : null;
  const ml = h.match(/^#cadl-(.+)$/);
  if (ml) {
    livroId = decodeURIComponent(ml[1]);
    const ja = C.livros.find(l => l.id === livroId);
    if (ja) cadId = ja.caderno;
    else { try { const s = await getDoc(doc(db, "cadernoLivros", livroId)); cadId = s.exists() ? s.data().caderno : null; } catch (e) { cadId = null; } }
  }
  const e = cadId ? especiais.find(x => x.id === cadId && x.formato === "caderno") : null;
  if (!e) { fecharCaderno(); return; }
  await abrirCaderno(e);
  if (livroId && !(C.atual?.id === livroId && !$("#cadFicha")?.hidden)) abrirFicha(livroId, true);
}

async function abrirCaderno(e) {
  const v = $("#cadView");
  const assinatura = e.id + ":" + (e.atualizadoEm || "") + ":" + (e.fotoV || "");
  if (!v.hidden && v.dataset.assinatura === assinatura) return;
  const novo = v.hidden || v.dataset.id !== e.id;
  C.atual = null;
  v.dataset.id = e.id; v.dataset.assinatura = assinatura;
  C.caderno = e;
  const tema = temaDe(e);
  v.className = `esp-view cad-view tema-${tema}`;
  try {
    const s = await getDocs(query(collection(db, "cadernoLivros"), where("caderno", "==", e.id)));
    C.livros = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  } catch (err) { console.error(err); C.livros = []; }
  const lidos = C.livros.filter(l => l.status === "lido").length, lendo = C.livros.filter(l => l.status === "lendo").length;
  const abertura = e.fotoDb ? capaHTML({ id: "esp_" + e.id, titulo: e.titulo, capaDb: true, capaV: e.fotoV }) : ilustracaoAbertura(tema);
  const nomeGrande = e.destaque || e.autor || "";
  const palavrasAutor = nomeGrande.split(/\s+/).filter(Boolean);
  const etiquetas = tema === "estrelas"
    ? `<div class="etiquetas" aria-label="${esc(e.titulo)}: ${esc(nomeGrande)}"><span class="etq e1">${esc((e.titulo || "").toUpperCase())}</span>
        ${palavrasAutor.length > 1 ? `<span class="etq e2">${esc(palavrasAutor.slice(0, -1).join(" "))}</span><span class="etq e3">${esc(palavrasAutor.at(-1))}</span>` : `<span class="etq e2">${esc(nomeGrande)}</span>`}</div>
       <div class="paleta" aria-hidden="true"><i style="background:#E9C9A3"></i><i style="background:#D99A6C"></i><i style="background:#B85C3E"></i><span style="width:24px"></span><i style="background:#E9C9A3"></i><i style="background:#D99A6C"></i><i style="background:#B85C3E"></i></div>`
    : `<div class="campo-titulo"><span class="campo-pre">${esc(e.titulo || "")}</span><span class="fita-kraft"></span><span class="campo-autor">${esc(nomeGrande)}</span></div>`;
  const citacao = e.chamada ? `<figure class="cad-citacao"><blockquote>${esc(e.chamada)}</blockquote>${e.citacaoAutor ? `<figcaption>— ${esc(e.citacaoAutor)}</figcaption>` : ""}</figure>` : "";
  v.innerHTML = `<div class="wrap esp-artigo cad">
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn mini" type="button" id="cadFechar">← Voltar ao site</button>
      <button class="btn mini" type="button" id="cadLinkCad">Copiar link do caderno</button></div>
    <section class="cad-abertura" aria-label="Abertura do caderno"><div class="cad-folha">
      ${etiquetas}
      <div class="cad-ilus-abertura">${abertura}</div>
      ${citacao}
      <div class="progresso"><span class="label">${lidos} de ${C.livros.length} lidos${lendo ? ` · ${lendo} lendo` : ""}</span>
        <div class="barra" aria-hidden="true"><i style="width:${Math.max(2, C.livros.length ? lidos / C.livros.length * 100 : 0)}%"></i></div></div>
      <a class="btn solid" href="#cadColecao" id="cadVerColecao">Ver a coleção</a>
    </div></section>
    <section id="cadColecao" class="cad-colecao-sec"><div class="sec-head"><span class="label">A coleção</span><h2>${C.livros.length} livro${C.livros.length === 1 ? "" : "s"}</h2>
      <p>Toque numa capa para abrir a ficha.</p></div>
      <div class="cad-moldura"><div class="cad-grade">${C.livros.map(l => `<button class="cad-item" type="button" data-cadlivro="${esc(l.id)}" aria-label="${esc(l.titulo)}">
        <div class="cad-mini">${miniCapa(l)}</div>
        ${e.usaEstrelas !== false ? `<span class="estrelas" aria-label="${l.nota ? l.nota + " de 5 estrelas" : "sem avaliação"}">${estrelasTxt(l.nota)}</span>` : ""}
        <span class="selo-st ${esc(l.status || "fila")}">${statusTxt[l.status] || "na fila"}</span></button>`).join("") || `<p class="vazio">A Taís ainda não colocou livros neste caderno.</p>`}</div></div>
    </section>
    <section id="cadFicha" class="cad-ficha-sec" hidden></section>
  </div>`;
  v.hidden = false; document.body.style.overflow = "hidden";
  if (novo) v.scrollTop = 0;
  pintarCapas(v);
  $("#cadFechar").addEventListener("click", () => { location.hash = "especiais"; });
  $("#cadLinkCad").addEventListener("click", (ev) => copiarLink(ev.currentTarget, "#cad-" + e.id, "Copiar link do caderno"));
  $("#cadVerColecao").addEventListener("click", (ev) => { ev.preventDefault(); $("#cadColecao").scrollIntoView({ behavior: "smooth" }); });
  v.querySelector(".cad-grade").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-cadlivro]"); if (!b) return;
    history.replaceState(null, "", "#cadl-" + b.dataset.cadlivro);
    abrirFicha(b.dataset.cadlivro, true);
  });
}
export function fecharCaderno() {
  const v = $("#cadView"); if (!v || v.hidden) return;
  C.subRef && C.subRef(); C.subRef = null;
  v.hidden = true; v.innerHTML = ""; delete v.dataset.id; delete v.dataset.assinatura;
  if ($("#espView")?.hidden !== false && $("#regView")?.hidden !== false) document.body.style.overflow = "";
}

function miniCapa(l) {
  if (l.capaDb) return capaHTML({ id: "cl_" + l.id, titulo: l.titulo, capaDb: true, capaV: l.capaV });
  return `<canvas width="200" height="300" data-cadcapa="${esc(l.id)}" aria-hidden="true"></canvas>`;
}
function pintarCapas(raiz) {
  raiz.querySelectorAll("canvas[data-cadcapa]").forEach(c => {
    const l = C.livros.find(x => x.id === c.dataset.cadcapa); if (l) desenharCapa(c, l, temaDe(C.caderno), C.caderno?.autor);
  });
}

// Link direto para mandar no WhatsApp: abre o site já no caderno ou no livro (depois do login).
async function copiarLink(botao, hash, rotulo) {
  const url = location.origin + location.pathname + hash;
  try { await navigator.clipboard.writeText(url); botao.textContent = "Link copiado! Cole no WhatsApp"; }
  catch (e) { botao.textContent = url; }
  setTimeout(() => { botao.textContent = rotulo; }, 2500);
}

/* ================= ficha ================= */
function resumoHTML(t) {
  return String(t || "").split("\n").map(s => s.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/==(.+?)==/g, "<mark>$1</mark>")}</p>`).join("");
}
function campo(k, v) { return `<li><span class="k">${k}:</span><span class="v ${v ? "" : "vazio"}">${v ? esc(v) : "…"}</span></li>`; }
function abrirFicha(id, rolar) {
  const i = C.livros.findIndex(l => l.id === id); if (i < 0) return;
  const l = C.livros[i], e = C.caderno, tema = temaDe(e);
  C.atual = l;
  const sec = $("#cadFicha"); sec.hidden = false;
  const ilusHTML = l.ilusDb ? capaHTML({ id: "cli_" + l.id, titulo: l.titulo, capaDb: true, capaV: l.ilusV }) : ilustracaoPadrao(l.ilusPadrao);
  const temIlus = !!(l.ilusDb || l.ilusPadrao);
  const preenchida = l.status && l.status !== "fila";
  const marcador = tema === "campo" ? "❀" : "★";
  sec.innerHTML = `<div class="sec-head"><span class="label">Ficha do livro · ${i + 1} de ${C.livros.length}</span><h2>${esc(l.titulo)}</h2></div>
    <div class="ficha-wrap ${temIlus ? "" : "sem-ilus"}">
      ${temIlus ? `<div class="ficha-ilus ${l.ilusPadrao === "lua" && !l.ilusDb ? "lua" : ""}">${ilusHTML}
        ${l.ilusDb ? "" : `<div class="cartao"><h3>${esc(l.titulo)}</h3>${l.subtitulo && l.ilusPadrao !== "lua" ? `<p>${esc(l.subtitulo)}</p>` : ""}</div>`}</div>` : ""}
      <article class="ficha">
        ${tema === "campo" ? `<span class="adesivo-jarro">${JARRO}</span>` : `<span class="washi-canto" aria-hidden="true"></span>`}
        <div class="ficha-topo"><div class="cad-mini">${miniCapa(l)}</div>
          <ul class="campos">
            ${campo("Título", l.titulo)}${campo(e.rotuloAutor || "Autor", e.autor)}${campo("Editora", l.editora)}
            ${campo("Data da publicação", l.publicacao)}${campo("Total de páginas", l.paginas)}
            ${campo("Início em", l.inicio)}${campo("Término em", l.termino)}
            ${e.usaEstrelas !== false ? `<li><span class="k">Avaliação:</span><span class="v aval">${l.nota ? "★".repeat(l.nota) : '<span class="vazio">…</span>'}</span></li>` : ""}
          </ul></div>
        ${l.resumo ? `<p class="resumo-tit">${marcador} Resumo da obra:</p><div class="resumo">${resumoHTML(l.resumo)}</div>`
          : preenchida ? `<p class="na-fila">${marcador} Resumo da obra: a Taís está lendo este livro. O resumo chega quando ela terminar.</p>`
          : `<p class="na-fila">Este livro está na fila do caderno. Quando a Taís começar a leitura, a ficha se preenche aqui.</p>`}
      </article>
    </div>
    <div class="nav-ficha">
      <button class="btn mini" type="button" id="cadAnt" ${i === 0 ? "disabled" : ""}>‹ Livro anterior</button>
      <span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button class="btn mini solid" type="button" id="cadShareLivro">Compartilhar este livro</button>
        <button class="btn mini" type="button" id="cadLinkLivro">Copiar link deste livro</button></span>
      <button class="btn mini" type="button" id="cadProx" ${i === C.livros.length - 1 ? "disabled" : ""}>Próximo livro ›</button>
    </div>
    <div class="reflexoes">
      <form class="caixa" id="cadFormRef" autocomplete="off">
        <h3>Deixe sua reflexão</h3>
        <p class="small">Uma ideia que ficou, uma frase sublinhada, uma pergunta. As outras leitoras veem no caderno.</p>
        <textarea id="cadRefTxt" rows="5" maxlength="800" required placeholder="O que esse livro mexeu em você?"></textarea>
        <button class="btn solid" type="submit" style="justify-self:start">Colar no caderno</button>
        <p class="erro" id="cadRefErro" role="alert"></p>
      </form>
      <div><span class="label">Reflexões das leitoras</span><ul class="lista-ref" id="cadListaRef"></ul></div>
    </div>`;
  pintarCapas(sec);
  $("#cadAnt").addEventListener("click", () => irPara(i - 1));
  $("#cadProx").addEventListener("click", () => irPara(i + 1));
  $("#cadShareLivro").addEventListener("click", () => abrirShare(null));
  $("#cadLinkLivro").addEventListener("click", (ev) => copiarLink(ev.currentTarget, "#cadl-" + l.id, "Copiar link deste livro"));
  $("#cadFormRef").addEventListener("submit", enviarReflexao);
  $("#cadListaRef").addEventListener("click", cliqueReflexao);
  C.subRef && C.subRef();
  C.reflexoes = []; renderReflexoes();
  C.subRef = onSnapshot(collection(db, "cadernoLivros", l.id, "reflexoes"), s => {
    C.reflexoes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
    renderReflexoes();
  }, err => console.error(err));
  if (rolar) sec.scrollIntoView({ behavior: "smooth" });
}
function irPara(i) {
  const l = C.livros[i]; if (!l) return;
  history.replaceState(null, "", "#cadl-" + l.id);
  abrirFicha(l.id, true);
}

/* ================= reflexões ================= */
function dataRef(r) {
  const s = r.criadoEm?.seconds; if (!s) return "agora";
  return new Date(s * 1000).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}
function renderReflexoes() {
  const ul = $("#cadListaRef"); if (!ul) return;
  ul.innerHTML = C.reflexoes.length ? C.reflexoes.map(r => `<li class="ref"><span class="quem">${esc(C.nomeDe(r.autor))} · ${dataRef(r)}</span><p class="txt">${esc(r.texto)}</p>
      <div class="acoes"><button class="btn mini" type="button" data-shareref="${esc(r.id)}">Compartilhar esta reflexão</button>
      ${r.autor === C.usuario || C.admin ? `<button class="btn mini" type="button" data-apagaref="${esc(r.id)}">Apagar</button>` : ""}</div></li>`).join("")
    : `<li class="vazio-ref">Ainda não há reflexões sobre ${esc(C.atual?.titulo || "este livro")}. Que tal ser a primeira?</li>`;
}
async function enviarReflexao(ev) {
  ev.preventDefault();
  const txt = $("#cadRefTxt").value.trim(); if (!txt || !C.atual) return;
  $("#cadRefErro").textContent = "";
  const btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    await addDoc(collection(db, "cadernoLivros", C.atual.id, "reflexoes"), { autor: C.usuario, texto: txt.slice(0, 800), criadoEm: serverTimestamp() });
    $("#cadRefTxt").value = "";
  } catch (err) { console.error(err); $("#cadRefErro").textContent = "Não foi possível colar a reflexão. Tente de novo."; }
  finally { btn.disabled = false; }
}
async function cliqueReflexao(ev) {
  const sh = ev.target.closest("[data-shareref]");
  if (sh) { abrirShare(sh.dataset.shareref); return; }
  const ap = ev.target.closest("[data-apagaref]");
  if (ap) {
    if (ap.dataset.confirma !== "1") { ap.dataset.confirma = "1"; ap.textContent = "Confirmar?"; return; }
    try { await deleteDoc(doc(db, "cadernoLivros", C.atual.id, "reflexoes", ap.dataset.apagaref)); } catch (err) { console.error(err); }
  }
}

/* ================= imagem para redes sociais ================= */
function estrelaPath(ctx, cx, cy, r) {
  ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath();
}
function montarModal() {
  if ($("#cadShare")) return;
  const d = document.createElement("div");
  d.className = "modal cad-share"; d.id = "cadShare"; d.hidden = true;
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "cadShareTit");
  d.innerHTML = `<div class="share-in">
    <div style="display:grid;gap:10px;align-content:start"><img class="previa-img" id="cadPrevia" alt="Prévia da imagem para compartilhar"></div>
    <div class="opcoes">
      <h2 id="cadShareTit" style="font-size:28px;font-weight:500">Compartilhar</h2>
      <fieldset><legend>Formato</legend><div class="seg">
        <label><input type="radio" name="cadFmt" value="post" checked> Post (4:5)</label>
        <label><input type="radio" name="cadFmt" value="story"> Story (9:16)</label></div></fieldset>
      <fieldset><legend>O que mostrar</legend><div class="seg" id="cadSegCont">
        <label><input type="radio" name="cadCont" value="ficha" checked> Ficha do livro</label>
        <label><input type="radio" name="cadCont" value="reflexao"> Reflexão</label>
        <label><input type="radio" name="cadCont" value="ambos"> Os dois</label></div></fieldset>
      <fieldset><legend>Fundo</legend><div class="seg">
        <label><input type="radio" name="cadFundo" value="papel" checked> Papel</label>
        <label><input type="radio" name="cadFundo" value="tema"> <span id="cadFundoTema">Estrelas</span></label></div></fieldset>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn solid" type="button" id="cadBtnShare">Compartilhar</button>
        <button class="btn" type="button" id="cadBtnBaixar">Baixar imagem</button></div>
      <p class="small" id="cadShareMsg" role="status"></p>
      <div style="display:grid;gap:6px"><span class="label">Legenda pronta</span><div class="legenda-txt" id="cadLegenda"></div>
        <button class="btn mini" type="button" id="cadCopiarLeg" style="justify-self:start">Copiar legenda</button></div>
      <button class="btn" type="button" id="cadFecharShare" style="justify-self:start">Fechar</button>
    </div></div>`;
  document.body.appendChild(d);
  d.addEventListener("change", gerarImagem);
  d.addEventListener("click", (e) => { if (e.target.id === "cadShare") fecharShare(); });
  $("#cadFecharShare").addEventListener("click", fecharShare);
  $("#cadCopiarLeg").addEventListener("click", async () => {
    const b = $("#cadCopiarLeg");
    try { await navigator.clipboard.writeText($("#cadLegenda").textContent); b.textContent = "Copiada!"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("#cadLegenda")); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selecionada: copie com Ctrl+C"; }
    setTimeout(() => b.textContent = "Copiar legenda", 2200);
  });
  $("#cadBtnBaixar").addEventListener("click", baixarImagem);
  $("#cadBtnShare").addEventListener("click", compartilharImagem);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#cadShare").hidden) { fecharShare(); e.stopImmediatePropagation(); } }, true);
}
function abrirShare(refId) {
  montarModal();
  C.refShare = refId;
  const temRef = !!refId || C.reflexoes.length > 0;
  $("#cadSegCont").querySelectorAll("input").forEach(i => { i.disabled = !temRef && i.value !== "ficha"; });
  $("#cadSegCont").querySelector(`input[value="${refId ? "reflexao" : "ficha"}"]`).checked = true;
  $("#cadFundoTema").textContent = temaDe(C.caderno) === "campo" ? "Rosa" : "Estrelas";
  $("#cadShareMsg").textContent = "";
  $("#cadShare").hidden = false;
  gerarImagem(); $("#cadFecharShare").focus();
}
function fecharShare() { const m = $("#cadShare"); if (m) m.hidden = true; }

let ultimaImagem = null;
async function imagemDaCapa(l, tema) {
  const cw = 460, ch = 690, cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  if (l.capaDb) {
    try {
      const s = await getDoc(doc(db, "capas", "cl_" + l.id));
      if (s.exists()) {
        const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = s.data().img; });
        const ctx = cv.getContext("2d"), k = Math.max(cw / img.width, ch / img.height);
        ctx.drawImage(img, (cw - img.width * k) / 2, (ch - img.height * k) / 2, img.width * k, img.height * k);
        return cv;
      }
    } catch (e) { /* usa a capa provisória */ }
  }
  desenharCapa(cv, l, tema, C.caderno?.autor); return cv;
}
async function gerarImagem() {
  const l = C.atual, e = C.caderno; if (!l || !e) return;
  await document.fonts.ready;
  const tema = temaDe(e);
  const fmt = document.querySelector("input[name=cadFmt]:checked").value;
  let cont = document.querySelector("input[name=cadCont]:checked").value;
  const fundo = document.querySelector("input[name=cadFundo]:checked").value;
  const ref = C.refShare ? C.reflexoes.find(r => r.id === C.refShare) : C.reflexoes[0];
  if (!ref && cont !== "ficha") cont = "ficha";
  const W = 1080, H = fmt === "story" ? 1920 : 1350, m = 54, R = 56;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const corDestaque = tema === "campo" ? "#3d6b3a" : "#9E5A51";
  if (fundo === "tema" && tema === "estrelas") {
    ctx.fillStyle = "#1C1916"; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 260; k++) { ctx.fillStyle = `rgba(201,160,74,${.35 + (k % 5) / 8})`; estrelaPath(ctx, (k * 137) % W, (k * 251) % H, 6 + (k % 4) * 3); ctx.fill(); }
  } else if (fundo === "tema") {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#F6D3DA"); g.addColorStop(1, "#E8A9B8"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 18; k++) { ctx.fillStyle = `rgba(255,255,255,${.1 + (k % 3) * .05})`; ctx.beginPath(); ctx.ellipse((k * 211) % W, (k * 337) % H, 140, 80, k, 0, 7); ctx.fill(); }
  } else { ctx.fillStyle = tema === "campo" ? "#F3E9E4" : "#EDE5D6"; ctx.fillRect(0, 0, W, H); }
  if (tema === "campo") { ctx.fillStyle = "#D63A3A"; ctx.fillRect(m - 14, m - 14, W - 2 * m + 28, H - 2 * m + 28); }
  ctx.fillStyle = "#FFFDF6"; ctx.fillRect(m, m, W - 2 * m, H - 2 * m);
  const topo = m + 40;
  ctx.strokeStyle = "#E6DFCF"; ctx.lineWidth = 2;
  for (let y = topo + R; y < H - m; y += R) { ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(W - m, y); ctx.stroke(); }
  if (tema === "estrelas") {
    ctx.strokeStyle = "#D4A39B"; ctx.beginPath(); ctx.moveTo(m + 80, m); ctx.lineTo(m + 80, H - m); ctx.stroke();
    ctx.save(); ctx.translate(W - m - 130, m + 8); ctx.rotate(.25); ctx.fillStyle = "rgba(241,221,216,.95)"; ctx.fillRect(-110, -22, 220, 44);
    for (let x = -96; x < 110; x += 34) { ctx.fillStyle = "#D4A39B"; ctx.beginPath(); ctx.arc(x, 0, 8, 0, 7); ctx.fill(); ctx.fillStyle = "#6E8B5E"; ctx.beginPath(); ctx.ellipse(x + 16, -8, 8, 3.5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 16, 8, 8, 3.5, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  } else {
    // ramos de folhas no canto
    ctx.save(); ctx.translate(W - m - 90, m + 60);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = `rgba(110,150,95,${.35 + k * .06})`; ctx.beginPath(); ctx.ellipse(-k * 14, k * 22, 26, 10, -.6 - k * .1, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const xL = m + (tema === "estrelas" ? 115 : 70), larg = W - xL - m - 50;
  const linhaY = n => topo + R * n - 14;
  ctx.textAlign = "left";
  ctx.fillStyle = corDestaque; ctx.font = `700 28px "Courier Prime", monospace`;
  ctx.fillText(((e.titulo || "Caderno de leitura") + " · " + (e.destaque || e.autor || "")).toUpperCase().slice(0, 52), xL, linhaY(1));
  const grande = cont !== "reflexao";
  const cw = grande ? 230 : 150, ch = cw * 1.5;
  const capa = await imagemDaCapa(l, tema);
  const yCapa = linhaY(1) + 34;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 10; ctx.drawImage(capa, xL, yCapa, cw, ch); ctx.restore();
  const xd = xL + cw + 40, ld = W - xd - m - 30;
  let n = 2;
  ctx.fillStyle = "#2E2925"; ctx.font = `700 ${grande ? 66 : 56}px "Caveat", cursive`;
  for (const li of linhasTexto(ctx, l.titulo, ld)) { ctx.fillText(li, xd, linhaY(n)); n++; }
  ctx.font = `32px "Patrick Hand SC", cursive`; ctx.fillStyle = "#6B6158"; ctx.fillText(e.autor || "", xd, linhaY(n)); n++;
  if (l.nota && e.usaEstrelas !== false) { for (let k = 0; k < 5; k++) { estrelaPath(ctx, xd + 20 + k * 48, linhaY(n) - 14, 19); ctx.fillStyle = k < l.nota ? "#C9A04A" : "#E3DCCC"; ctx.fill(); } n++; }
  ctx.font = `26px "Courier Prime", monospace`; ctx.fillStyle = "#6B6158";
  const det = [l.paginas ? `${l.paginas} páginas` : "", l.inicio && l.termino ? `lido de ${l.inicio.slice(0, 5)} a ${l.termino}` : l.status === "lendo" ? "lendo agora" : ""].filter(Boolean).join("\n");
  if (det && grande) for (const li of linhasTexto(ctx, det, ld)) { ctx.fillText(li, xd, linhaY(n)); n++; }
  n = Math.max(n, Math.ceil((yCapa + ch + 30 - topo) / R) + 1);
  const ultima = Math.floor((H - m - 150 - topo) / R);
  const marc = tema === "campo" ? "❀" : "★";
  const blocos = [];
  if ((cont === "ficha" || cont === "ambos") && l.resumo) blocos.push({ rot: `${marc} Resumo da obra`, txt: l.resumo.replace(/==/g, ""), fonte: '"Lora", serif', tam: 30 });
  if ((cont === "reflexao" || cont === "ambos") && ref) blocos.push({ rot: `${marc} Reflexão de uma leitora`, txt: `“${ref.texto}”`, fonte: '"Caveat", cursive', tam: cont === "reflexao" ? 52 : 42 });
  for (const b of blocos) {
    if (n > ultima - 1) break;
    ctx.fillStyle = "#2E2925"; ctx.font = `34px "Patrick Hand SC", cursive`; ctx.fillText(b.rot, xL, linhaY(n)); n++;
    ctx.font = `${b.tam}px ${b.fonte}`;
    const ls = linhasTexto(ctx, b.txt, larg);
    const espaco = (blocos.length > 1 && b === blocos[0]) ? Math.max(2, Math.floor((ultima - n) * .55)) : ultima - n + 1;
    for (let k = 0; k < ls.length && k < espaco; k++) {
      let li = ls[k]; if (k === espaco - 1 && k < ls.length - 1) li = li.replace(/\s*\S*$/, "") + "…";
      ctx.fillText(li, xL, linhaY(n)); n++;
    }
    n++;
  }
  ctx.fillStyle = corDestaque; ctx.font = `48px "Pinyon Script", cursive`; ctx.textAlign = "center";
  ctx.fillText("Refúgio das Páginas", W / 2, H - m - 74);
  ctx.fillStyle = "#6B6158"; ctx.font = `24px "Courier Prime", monospace`; ctx.fillText(`clube de leitura · ${location.host || "refugiodaspaginas.com.br"}`, W / 2, H - m - 34);
  ultimaImagem = { cv, nome: `${l.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}-${cont}.jpg` };
  $("#cadPrevia").src = cv.toDataURL("image/jpeg", .9);
  const hashAutor = (e.autor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "");
  $("#cadLegenda").textContent = cont === "reflexao" && ref
    ? `“${ref.texto}”\n\nUma reflexão sobre ${l.titulo}${e.autor ? `, de ${e.autor}` : ""}, no nosso clube de leitura 📚\n\n#RefugioDasPaginas ${hashAutor ? "#" + hashAutor + " " : ""}#clubedoLivro`
    : `📖 ${l.titulo}${e.autor ? `, de ${e.autor}` : ""}${l.nota && e.usaEstrelas !== false ? "\n" + "⭐".repeat(l.nota) : ""}${l.paginas ? `\n${l.paginas} páginas` : ""}\n\nDo caderno "${e.titulo}" do Refúgio das Páginas, nosso clube de leitura.\n\n#RefugioDasPaginas ${hashAutor ? "#" + hashAutor + " " : ""}#bookjournal #clubedoLivro`;
}
function blobDaImagem() { return new Promise(ok => ultimaImagem.cv.toBlob(ok, "image/jpeg", .9)); }
async function baixarImagem() {
  if (!ultimaImagem) return;
  const blob = await blobDaImagem(), url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = ultimaImagem.nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  $("#cadShareMsg").textContent = "Imagem salva na pasta de downloads.";
}
async function compartilharImagem() {
  if (!ultimaImagem) return;
  const blob = await blobDaImagem();
  const arquivo = new File([blob], ultimaImagem.nome, { type: "image/jpeg" });
  const texto = $("#cadLegenda").textContent;
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], text: texto }); $("#cadShareMsg").textContent = ""; }
    catch (e) { if (e.name !== "AbortError") $("#cadShareMsg").textContent = "Não foi possível abrir o compartilhamento. Use Baixar imagem."; }
  } else {
    await baixarImagem();
    $("#cadShareMsg").textContent = "Este navegador não compartilha imagens direto. A imagem foi salva: poste pela galeria e cole a legenda.";
  }
}
