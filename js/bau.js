// Baú da Escrita: os textos da Taís (poemas, contos, crônicas, exercícios de oficina) e os comentários das leitoras.
import { db, esc, MESES_CAP } from "./firebase.js?v=20261101c";
import {
  doc, addDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
export const TIPOS = { poema: "Poema", conto: "Conto", cronica: "Crônica", exercicio: "Exercício de oficina", ensaio: "Ensaio", carta: "Carta", fragmento: "Fragmento", outro: "Texto" };
export const ORIGENS = { autoral: "Autoral", curso: "Curso", oficina: "Oficina", clube: "Encontro do clube" };
const B = { usuario: null, admin: false, nomeDe: (u) => u, textos: [], sub: null, subCom: null, comentarios: [] };

export const tipoDe = (t) => TIPOS[t.tipo] || TIPOS.outro;
export function origemDe(t) {
  const o = ORIGENS[t.origem] || "";
  return [o, t.origemNome].filter(Boolean).join(" · ");
}
const MESES = MESES_CAP.map(m => m.toLowerCase());
function mesAno(iso) {
  if (!iso) return "";
  const [a, m] = iso.split("-").map(Number);
  return m ? `${MESES[m - 1]} de ${a}` : String(a);
}
function dataTexto(iso) {
  const [a, m, d] = (iso || "").split("-").map(Number);
  return d ? `${d} de ${MESES[m - 1]} de ${a}` : mesAno(iso);
}
// Poemas guardam as quebras de verso e as estrofes (linha em branco); a prosa vira parágrafos.
export function corpoHTML(t) {
  const marca = (s) => esc(s).replace(/==(.+?)==/g, "<mark>$1</mark>");
  const txt = String(t.texto || "").replace(/\r/g, "");
  if (t.tipo === "poema") return txt.split(/\n\s*\n/).map(e => e.trim()).filter(Boolean)
    .map(e => `<p class="estrofe">${e.split("\n").map(marca).join("<br>")}</p>`).join("");
  return txt.split("\n").map(s => s.trim()).filter(Boolean).map(p => `<p>${marca(p)}</p>`).join("");
}
function trecho(t) {
  const s = String(t.texto || "").replace(/==/g, "").replace(/\s*\n\s*/g, t.tipo === "poema" ? " / " : " ").trim();
  return s.length > 170 ? s.slice(0, 170).replace(/\s+\S*$/, "") + "…" : s;
}

export function iniciarBau(ctx) {
  Object.assign(B, ctx);
  pararBau();
  B.sub = onSnapshot(query(collection(db, "bau"), where("publicado", "==", true)), s => {
    B.textos = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || 0) - (a.criadoEm || 0));
    renderBau();
  }, err => console.error(err));
}
export function pararBau() {
  B.sub && B.sub(); B.sub = null;
  fecharTexto();
}

function renderBau() {
  const tem = B.textos.length > 0;
  $("#bauBloco").hidden = !tem;
  $("#linkBau").hidden = !tem;
  $("#bauGrid").innerHTML = B.textos.map(t => `
    <a class="bau-card tipo-${esc(t.tipo || "outro")}" href="#bau-${esc(t.id)}">
      <span class="label">${esc(tipoDe(t))}${t.data ? " · " + esc(mesAno(t.data)) : ""}</span>
      <h3>${esc(t.titulo)}</h3>
      <p class="bau-trecho">${esc(trecho(t))}</p>
      <span class="bau-ler">Abrir →</span>
    </a>`).join("");
  abrirTextoPeloEndereco();
}

export function abrirTextoPeloEndereco() {
  const m = location.hash.match(/^#bau-(.+)$/);
  const t = m ? B.textos.find(x => x.id === decodeURIComponent(m[1])) : null;
  if (t) abrirTexto(t); else fecharTexto();
}

function abrirTexto(t) {
  const v = $("#bauView");
  const assinatura = t.id + ":" + (t.atualizadoEm || "");
  if (!v.hidden && v.dataset.assinatura === assinatura) return;
  const novo = v.hidden || v.dataset.id !== t.id;
  v.dataset.id = t.id; v.dataset.assinatura = assinatura;
  const origem = origemDe(t);
  v.innerHTML = `<div class="wrap esp-artigo bau-artigo">
    <button class="btn mini" type="button" id="bauFechar">← Voltar ao baú</button>
    <article class="bau-folha">
      <header>
        <p class="esp-script">${esc(tipoDe(t))}</p>
        <h1 id="bauTitulo">${esc(t.titulo)}</h1>
        <p class="label">${[t.data ? esc(dataTexto(t.data)) : "", esc(origem)].filter(Boolean).join(" · ")}</p>
      </header>
      ${t.sobre ? `<p class="bau-sobre">${esc(t.sobre)}</p>` : ""}
      <div class="bau-corpo ${t.tipo === "poema" ? "poema" : "prosa"}">${corpoHTML(t)}</div>
      <p class="bau-assinatura">Taís Rick</p>
    </article>
    <section class="bau-comentarios" aria-labelledby="bauComTit">
      <h2 id="bauComTit">Comentários</h2>
      <ul class="lista-ref" id="bauListaCom"></ul>
      <form class="caixa" id="bauFormCom" autocomplete="off">
        <label for="bauComTxt" class="label">Deixe um comentário para a Taís</label>
        <textarea id="bauComTxt" rows="3" maxlength="600" required placeholder="O que esse texto despertou em você?"></textarea>
        <button class="btn solid" type="submit" style="justify-self:start">Comentar</button>
        <p class="erro" id="bauComErro" role="alert"></p>
      </form>
    </section>
  </div>`;
  v.hidden = false; document.body.style.overflow = "hidden";
  if (novo) v.scrollTop = 0;
  $("#bauFechar").addEventListener("click", () => { location.hash = "bau"; });
  $("#bauFormCom").addEventListener("submit", (ev) => comentar(ev, t));
  $("#bauListaCom").addEventListener("click", (ev) => apagarComentario(ev, t));
  B.subCom && B.subCom();
  B.comentarios = []; renderComentarios();
  B.subCom = onSnapshot(collection(db, "bau", t.id, "comentarios"), s => {
    B.comentarios = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.criadoEm?.seconds || 9e12) - (b.criadoEm?.seconds || 9e12));
    renderComentarios();
  }, err => console.error(err));
}
export function fecharTexto() {
  const v = $("#bauView"); if (!v || v.hidden) return;
  B.subCom && B.subCom(); B.subCom = null;
  v.hidden = true; v.innerHTML = ""; delete v.dataset.id; delete v.dataset.assinatura;
  if ([...document.querySelectorAll(".esp-view")].every(x => x.hidden)) document.body.style.overflow = "";
}

function quando(c) {
  const s = c.criadoEm?.seconds; if (!s) return "agora";
  return new Date(s * 1000).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}
function renderComentarios() {
  const ul = $("#bauListaCom"); if (!ul) return;
  ul.innerHTML = B.comentarios.length ? B.comentarios.map(c => `<li class="ref"><span class="quem">${esc(B.nomeDe(c.autor))} · ${quando(c)}</span><p class="txt">${esc(c.texto)}</p>
      ${c.autor === B.usuario || B.admin ? `<div class="acoes"><button class="btn mini" type="button" data-apagacom="${esc(c.id)}">Apagar</button></div>` : ""}</li>`).join("")
    : `<li class="vazio-ref">Ninguém comentou ainda. Que tal ser a primeira?</li>`;
}
async function comentar(ev, t) {
  ev.preventDefault();
  const txt = $("#bauComTxt").value.trim(); if (!txt) return;
  const btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true; $("#bauComErro").textContent = "";
  try {
    await addDoc(collection(db, "bau", t.id, "comentarios"), { autor: B.usuario, texto: txt.slice(0, 600), criadoEm: serverTimestamp() });
    $("#bauComTxt").value = "";
  } catch (err) { console.error(err); $("#bauComErro").textContent = "Não foi possível enviar o comentário. Tente de novo."; }
  finally { btn.disabled = false; }
}
async function apagarComentario(ev, t) {
  const b = ev.target.closest("[data-apagacom]"); if (!b) return;
  if (!confirm("Apagar este comentário?")) return;
  try { await deleteDoc(doc(db, "bau", t.id, "comentarios", b.dataset.apagacom)); } catch (err) { console.error(err); }
}
