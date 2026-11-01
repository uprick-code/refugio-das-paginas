// Painel: Baú da Escrita (escrever, guardar como rascunho, publicar e apagar os textos da Taís).
import { db, esc, hojeISO } from "./firebase.js?v=20261101c";
import { TIPOS, ORIGENS, tipoDe, origemDe } from "./bau.js?v=20261101c";
import {
  doc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const MAX = 30000;
const T = { textos: [], edit: null };
const chave = (id) => "refugio-rascunho-bau-" + (id || "novo");
const opcoes = (obj) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");

export function iniciarBauAdmin() {
  const box = $("#bauAdmin");
  box.innerHTML = `<div class="painel-grid">
    <div class="caixa">
      <h3 id="bzTituloForm">Novo texto</h3>
      <form id="formBau" autocomplete="off">
        <div class="field"><label for="bzTitulo">Título</label><input type="text" id="bzTitulo" maxlength="120" required placeholder="Receita para guardar o tempo"></div>
        <div class="linha">
          <div class="field"><label for="bzTipo">Tipo</label><select id="bzTipo">${opcoes(TIPOS)}</select></div>
          <div class="field"><label for="bzData">Data</label><input type="date" id="bzData"></div></div>
        <div class="linha">
          <div class="field"><label for="bzOrigem">De onde veio</label><select id="bzOrigem">${opcoes(ORIGENS)}</select></div>
          <div class="field"><label for="bzOrigemNome">Nome (opcional)</label><input type="text" id="bzOrigemNome" maxlength="80" placeholder="Oficina de escrita criativa"></div></div>
        <div class="field"><label for="bzSobre">Sobre este texto (opcional)</label>
          <textarea id="bzSobre" rows="2" maxlength="600" placeholder="Uma linha de contexto: o exercício proposto, o que inspirou, para quem foi escrito."></textarea></div>
        <div class="field"><label for="bzTexto">Texto</label>
          <textarea id="bzTexto" class="texto-longo-ed" rows="8" maxlength="${MAX}" required placeholder="Na prosa, um parágrafo por linha. No poema, um verso por linha e uma linha em branco entre as estrofes."></textarea>
          <span class="small contador" id="bzTextoCont"></span>
          <span class="small">Para marca-texto, escreva entre sinais de igual duplos: ==assim==. O que você digita fica guardado neste aparelho até salvar.</span>
          <span class="small ok" id="bzRascunho" role="status"></span></div>
        <div class="checks"><label><input type="checkbox" id="bzPublicado"> Publicado (as leitoras já veem)</label></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn solid" type="submit">Guardar no baú</button>
          <button class="btn" type="button" id="bzCancelar" hidden>Cancelar edição</button>
          <a class="btn" id="bzVer" hidden target="_blank" rel="noopener">Ver no site ↗</a>
        </div>
        <p class="erro" id="bzErro" role="alert"></p><p class="ok" id="bzOk" role="status"></p>
      </form>
    </div>
    <div>
      <div class="tabela-wrap"><table><thead><tr><th>Texto</th><th>Situação</th><th></th></tr></thead><tbody id="tBau"></tbody></table></div>
    </div></div>`;
  limpar();
  $("#bzTexto").addEventListener("input", () => { ajustar(); try { localStorage.setItem(chave(T.edit), $("#bzTexto").value); } catch (e) {} });
  $("#bzCancelar").addEventListener("click", limpar);
  $("#formBau").addEventListener("submit", salvar);
  $("#tBau").addEventListener("click", cliqueLista);
  onSnapshot(collection(db, "bau"), s => {
    T.textos = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || 0) - (a.criadoEm || 0));
    renderLista();
  }, err => console.error(err));
}

function ajustar() {
  const t = $("#bzTexto");
  t.style.height = "auto";
  t.style.height = Math.min(Math.max(t.scrollHeight + 2, 220), Math.round(innerHeight * .65)) + "px";
  $("#bzTextoCont").textContent = `${t.value.length.toLocaleString("pt-BR")} de ${MAX.toLocaleString("pt-BR")} caracteres`;
}
function carregarTexto(salvo) {
  let r = null; try { r = localStorage.getItem(chave(T.edit)); } catch (e) {}
  const recuperou = r !== null && r !== (salvo || "");
  $("#bzTexto").value = recuperou ? r : (salvo || "");
  $("#bzRascunho").textContent = recuperou ? "Recuperei um rascunho do texto que ainda não tinha sido guardado." : "";
  requestAnimationFrame(ajustar);
}
function limpar() {
  T.edit = null;
  $("#formBau").reset(); $("#bzData").value = hojeISO();
  $("#bzTituloForm").textContent = "Novo texto"; $("#bzCancelar").hidden = true; $("#bzVer").hidden = true;
  $("#bzErro").textContent = ""; $("#bzOk").textContent = "";
  carregarTexto("");
}
function editar(t) {
  T.edit = t.id;
  $("#bzTitulo").value = t.titulo || ""; $("#bzTipo").value = TIPOS[t.tipo] ? t.tipo : "outro"; $("#bzData").value = t.data || "";
  $("#bzOrigem").value = ORIGENS[t.origem] ? t.origem : "autoral"; $("#bzOrigemNome").value = t.origemNome || "";
  $("#bzSobre").value = t.sobre || ""; $("#bzPublicado").checked = !!t.publicado;
  $("#bzTituloForm").textContent = "Editar: " + t.titulo; $("#bzCancelar").hidden = false;
  $("#bzVer").hidden = !t.publicado; $("#bzVer").href = "index.html#bau-" + encodeURIComponent(t.id);
  $("#bzErro").textContent = ""; $("#bzOk").textContent = "";
  carregarTexto(t.texto);
  $("#bauAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
}
function idDe(titulo) {
  const base = titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "texto";
  let id = base, n = 2;
  while (T.textos.some(t => t.id === id)) id = `${base}-${n++}`;
  return id;
}
async function salvar(ev) {
  ev.preventDefault();
  $("#bzErro").textContent = ""; $("#bzOk").textContent = "";
  const titulo = $("#bzTitulo").value.trim(), texto = $("#bzTexto").value.replace(/\s+$/, "");
  if (!titulo || !texto.trim()) { $("#bzErro").textContent = "Escreva o título e o texto."; return; }
  const btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true;
  const dados = {
    titulo: titulo.slice(0, 120), tipo: $("#bzTipo").value, data: $("#bzData").value, origem: $("#bzOrigem").value,
    origemNome: $("#bzOrigemNome").value.trim(), sobre: $("#bzSobre").value.trim(), texto: texto.slice(0, MAX),
    publicado: $("#bzPublicado").checked, atualizadoEm: Date.now()
  };
  try {
    const antigo = T.edit;
    const id = antigo || idDe(titulo);
    if (!antigo) dados.criadoEm = Date.now();
    await setDoc(doc(db, "bau", id), dados, { merge: true });
    try { localStorage.removeItem(chave(antigo)); } catch (e) {}
    const msg = dados.publicado ? "Guardado e publicado." : "Guardado como rascunho (só você vê).";
    const t = { id, ...(T.textos.find(x => x.id === id) || {}), ...dados };
    editar(t); $("#bzOk").textContent = msg;
  } catch (err) { console.error(err); $("#bzErro").textContent = "Não foi possível guardar. Tente de novo."; }
  finally { btn.disabled = false; }
}

function renderLista() {
  $("#tBau").innerHTML = T.textos.length ? T.textos.map(t => `<tr>
    <td><b style="font-family:var(--f-display);font-size:17px">${esc(t.titulo)}</b><br>
      <span class="small">${esc(tipoDe(t))}${origemDe(t) ? " · " + esc(origemDe(t)) : ""}${t.data ? " · " + esc(t.data.split("-").reverse().join("/")) : ""}</span></td>
    <td>${t.publicado ? `<span class="chip verde">publicado</span>` : `<span class="chip">rascunho</span>`}</td>
    <td style="white-space:nowrap"><button class="btn mini" type="button" data-bedit="${esc(t.id)}">Editar</button>
      <button class="btn mini" type="button" data-bpub="${esc(t.id)}">${t.publicado ? "Despublicar" : "Publicar"}</button>
      <button class="btn mini perigo" type="button" data-bdel="${esc(t.id)}">Apagar</button></td></tr>`).join("")
    : `<tr><td colspan="3" class="vazio">O baú ainda está vazio. Escreva o primeiro texto ao lado.</td></tr>`;
}
async function cliqueLista(ev) {
  const b = ev.target.closest("button"); if (!b) return;
  const id = b.dataset.bedit || b.dataset.bpub || b.dataset.bdel;
  const t = T.textos.find(x => x.id === id); if (!t) return;
  if (b.dataset.bedit) editar(t);
  else if (b.dataset.bpub) {
    try { await updateDoc(doc(db, "bau", id), { publicado: !t.publicado, atualizadoEm: Date.now() }); if (T.edit === id) $("#bzPublicado").checked = !t.publicado; }
    catch (err) { console.error(err); }
  } else if (b.dataset.bdel) {
    if (!confirm(`Apagar "${t.titulo}" e os comentários dele? Isso não tem volta.`)) return;
    try {
      const s = await getDocs(collection(db, "bau", id, "comentarios"));
      for (const d of s.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, "bau", id));
      try { localStorage.removeItem(chave(id)); } catch (e) {}
      if (T.edit === id) limpar();
    } catch (err) { console.error(err); }
  }
}
