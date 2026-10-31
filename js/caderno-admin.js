// Painel: livros de um caderno de leitura (lista, títulos em lote, ficha com capa e ilustração)
// e a importação dos dois cadernos da Taís.
import { db, esc, capaHTML, prepararCapa, prepararIlustracao, guardarCapaNoCache } from "./firebase.js?v=20261031d";
import { desenharCapa, temaDe } from "./caderno.js?v=20261031d";
import {
  doc, getDocs, setDoc, deleteDoc, collection, query, where, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const A = { cad: null, livros: [], sub: null, edit: null, capaNova: null, tirarCapa: false, ilusNova: null, tirarIlus: false };
const STATUS = { fila: "na fila", lendo: "lendo", lido: "lido" };

/* ---------- lista de livros ---------- */
export function abrirLivrosCaderno(cad) {
  A.sub && A.sub();
  A.cad = cad; A.edit = null;
  const c = $("#cadAdmin"); c.hidden = false;
  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
      <h3>Livros · ${esc(cad.destaque || cad.autor || cad.titulo)}</h3>
      <button class="btn mini" type="button" id="cadAdmFechar">Fechar</button></div>
    <details class="cad-lote"><summary class="btn mini">+ Adicionar títulos</summary>
      <div style="display:grid;gap:8px;margin-top:10px">
        <label class="small" for="cadLote">Um título por linha. Eles entram no fim da lista, como "na fila".</label>
        <textarea id="cadLote" rows="5" placeholder="Sociedade do cansaço&#10;No enxame"></textarea>
        <button class="btn mini solid" type="button" id="cadLoteBtn" style="justify-self:start">Adicionar</button>
        <p class="small" id="cadLoteMsg" role="status"></p></div></details>
    <div id="cadFichaEd" hidden></div>
    <div class="tabela-wrap"><table><thead><tr><th>#</th><th></th><th>Livro</th><th>Situação</th><th></th></tr></thead><tbody id="cadAdmLista"></tbody></table></div>`;
  c.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#cadAdmFechar").addEventListener("click", fecharLivros);
  $("#cadLoteBtn").addEventListener("click", adicionarLote);
  $("#cadAdmLista").addEventListener("click", cliqueLista);
  A.sub = onSnapshot(query(collection(db, "cadernoLivros"), where("caderno", "==", cad.id)), s => {
    A.livros = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    renderLista();
  }, err => console.error(err));
}
function fecharLivros() { A.sub && A.sub(); A.sub = null; A.cad = null; $("#cadAdmin").hidden = true; $("#cadAdmin").innerHTML = ""; }
function miniAdmin(l) {
  if (l.capaDb) return capaHTML({ id: "cl_" + l.id, titulo: l.titulo, capaDb: true, capaV: l.capaV }, "mini-capa");
  return `<canvas class="mini-capa" width="88" height="132" data-admcapa="${esc(l.id)}" aria-hidden="true"></canvas>`;
}
function pintar(raiz) {
  raiz.querySelectorAll("canvas[data-admcapa]").forEach(cv => {
    const l = A.livros.find(x => x.id === cv.dataset.admcapa); if (l) desenharCapa(cv, l, temaDe(A.cad), A.cad?.autor);
  });
}
function renderLista() {
  const tb = $("#cadAdmLista"); if (!tb) return;
  tb.innerHTML = A.livros.length ? A.livros.map((l, i) => `<tr>
    <td style="font-family:var(--f-type)">${i + 1}</td>
    <td style="width:52px">${miniAdmin(l)}</td>
    <td><b style="font-family:var(--f-display);font-size:17px">${esc(l.titulo)}</b>${l.resumo ? `<br><span class="small">com resumo</span>` : ""}</td>
    <td><span class="chip ${l.status === "lido" ? "verde" : l.status === "lendo" ? "rosa" : ""}">${STATUS[l.status] || "na fila"}</span>${l.nota ? `<br><span style="color:var(--gold)">${"★".repeat(l.nota)}</span>` : ""}</td>
    <td><div class="acoes">
      <button class="btn mini solid" type="button" data-edlivro="${esc(l.id)}">Ficha</button>
      <button class="btn mini" type="button" data-sobe="${esc(l.id)}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
      <button class="btn mini" type="button" data-desce="${esc(l.id)}" ${i === A.livros.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
      <button class="btn mini perigo" type="button" data-remlivro="${esc(l.id)}">Remover</button></div></td></tr>`).join("")
    : `<tr><td colspan="5" class="vazio">Nenhum livro ainda. Use "Adicionar títulos" para colar a lista.</td></tr>`;
  pintar(tb);
}
async function adicionarLote() {
  const titulos = $("#cadLote").value.split("\n").map(t => t.trim()).filter(Boolean).slice(0, 100);
  if (!titulos.length) return;
  const base = Math.max(-1, ...A.livros.map(l => l.ordem ?? 0)) + 1;
  try {
    const b = writeBatch(db);
    titulos.forEach((t, i) => b.set(doc(collection(db, "cadernoLivros")), { caderno: A.cad.id, ordem: base + i, titulo: t.slice(0, 120), status: "fila", nota: 0 }));
    await b.commit();
    $("#cadLote").value = ""; $("#cadLoteMsg").textContent = `${titulos.length} título${titulos.length === 1 ? "" : "s"} adicionado${titulos.length === 1 ? "" : "s"}.`;
  } catch (err) { console.error(err); $("#cadLoteMsg").textContent = "Não foi possível adicionar. Confira se as regras novas já foram publicadas no Firebase."; }
}
async function trocarOrdem(id, d) {
  const i = A.livros.findIndex(l => l.id === id), j = i + d;
  if (i < 0 || j < 0 || j >= A.livros.length) return;
  const b = writeBatch(db);
  // Renumera a lista inteira para manter a ordem limpa.
  const nova = [...A.livros]; [nova[i], nova[j]] = [nova[j], nova[i]];
  nova.forEach((l, k) => { if (l.ordem !== k) b.update(doc(db, "cadernoLivros", l.id), { ordem: k }); });
  try { await b.commit(); } catch (err) { console.error(err); }
}
async function cliqueLista(ev) {
  const ed = ev.target.closest("[data-edlivro]"); if (ed) { abrirFicha(ed.dataset.edlivro); return; }
  const su = ev.target.closest("[data-sobe]"); if (su) { trocarOrdem(su.dataset.sobe, -1); return; }
  const de = ev.target.closest("[data-desce]"); if (de) { trocarOrdem(de.dataset.desce, 1); return; }
  const rm = ev.target.closest("[data-remlivro]");
  if (rm) {
    if (rm.dataset.confirma !== "1") { rm.dataset.confirma = "1"; rm.textContent = "Confirmar?"; return; }
    rm.disabled = true;
    try { await apagarLivro(A.livros.find(l => l.id === rm.dataset.remlivro)); if (A.edit === rm.dataset.remlivro) fecharFicha(); }
    catch (err) { console.error(err); rm.disabled = false; }
  }
}
async function apagarLivro(l) {
  if (!l) return;
  const refs = await getDocs(collection(db, "cadernoLivros", l.id, "reflexoes"));
  for (const r of refs.docs) await deleteDoc(r.ref);
  if (l.capaDb) await deleteDoc(doc(db, "capas", "cl_" + l.id)).catch(() => {});
  if (l.ilusDb) await deleteDoc(doc(db, "capas", "cli_" + l.id)).catch(() => {});
  await deleteDoc(doc(db, "cadernoLivros", l.id));
}
export async function apagarLivrosDoCaderno(cadId) {
  const s = await getDocs(query(collection(db, "cadernoLivros"), where("caderno", "==", cadId)));
  for (const d of s.docs) await apagarLivro({ id: d.id, ...d.data() });
  if (A.cad?.id === cadId) fecharLivros();
}

/* ---------- ficha de um livro ---------- */
const chaveRascunho = (id) => "refugio-rascunho-resumo-" + id;
function abrirFicha(id) {
  const l = A.livros.find(x => x.id === id); if (!l) return;
  A.edit = id; A.capaNova = null; A.tirarCapa = false; A.ilusNova = null; A.tirarIlus = false;
  const box = $("#cadFichaEd"); box.hidden = false;
  const estrelas = A.cad.usaEstrelas !== false;
  box.innerHTML = `<form id="cadFichaForm" class="cad-ficha-form" autocomplete="off">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
      <h3 style="font-size:22px">Ficha: ${esc(l.titulo)}</h3><button class="btn mini" type="button" id="cadFichaFechar">Fechar ficha</button></div>
    <div class="linha">
      <div class="field"><label for="cfTitulo">Título</label><input type="text" id="cfTitulo" maxlength="120" required></div>
      <div class="field"><label for="cfSubtitulo">Subtítulo</label><input type="text" id="cfSubtitulo" maxlength="140"></div></div>
    <div class="linha">
      <div class="field"><label for="cfEditora">Editora</label><input type="text" id="cfEditora" maxlength="80"></div>
      <div class="field"><label for="cfPublicacao">Data da publicação</label><input type="text" id="cfPublicacao" maxlength="60" placeholder="6ª reimpressão, 2025"></div></div>
    <div class="linha">
      <div class="field"><label for="cfPaginas">Total de páginas</label><input type="text" id="cfPaginas" maxlength="8" inputmode="numeric"></div>
      <div class="field"><label for="cfStatus">Situação</label><select id="cfStatus"><option value="fila">Na fila</option><option value="lendo">Lendo</option><option value="lido">Lido</option></select></div></div>
    <div class="linha">
      <div class="field"><label for="cfInicio">Início em</label><input type="text" id="cfInicio" maxlength="10" placeholder="04/09/2026"></div>
      <div class="field"><label for="cfTermino">Término em</label><input type="text" id="cfTermino" maxlength="10" placeholder="05/09/2026"></div></div>
    ${estrelas ? `<div class="field"><label for="cfNota">Avaliação</label><select id="cfNota"><option value="0">Sem avaliação</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select></div>` : ""}
    <div class="field"><label for="cfResumo">Resumo da obra</label>
      <textarea id="cfResumo" rows="10" maxlength="12000" placeholder="Um parágrafo por linha."></textarea>
      <span class="small">Para marca-texto, escreva entre sinais de igual duplos: ==psicopolítica==. O que você digita fica guardado neste aparelho até salvar.</span>
      <span class="small ok" id="cfRascunho" role="status"></span></div>
    <div class="linha">
      <div class="field"><span class="lbl">Capa</span><div class="capa-envio"><div class="capa-previa" id="cfCapaPrev"></div>
        <div style="display:grid;gap:8px;align-content:start;min-width:0"><input type="file" id="cfCapaArq" accept="image/*" class="visually-hidden">
          <label for="cfCapaArq" class="btn mini" style="justify-self:start">Enviar capa</label>
          <button class="btn mini perigo" type="button" id="cfCapaTirar" hidden style="justify-self:start">Tirar capa</button></div></div></div>
      <div class="field"><span class="lbl">Ilustração da página</span><div class="capa-envio"><div class="capa-previa" id="cfIlusPrev"></div>
        <div style="display:grid;gap:8px;align-content:start;min-width:0"><input type="file" id="cfIlusArq" accept="image/*" class="visually-hidden">
          <label for="cfIlusArq" class="btn mini" style="justify-self:start">Enviar ilustração</label>
          <button class="btn mini perigo" type="button" id="cfIlusTirar" hidden style="justify-self:start">Tirar ilustração</button></div></div></div></div>
    <p class="erro" id="cfErro" role="alert"></p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn solid" type="submit">Salvar ficha</button>
      <a class="btn" href="index.html#cadl-${esc(l.id)}" target="_blank" rel="noopener">Ver no site ↗</a></div>
    <p class="ok" id="cfOk" role="status"></p>
  </form>`;
  $("#cfTitulo").value = l.titulo || ""; $("#cfSubtitulo").value = l.subtitulo || ""; $("#cfEditora").value = l.editora || "";
  $("#cfPublicacao").value = l.publicacao || ""; $("#cfPaginas").value = l.paginas || ""; $("#cfStatus").value = l.status || "fila";
  $("#cfInicio").value = l.inicio || ""; $("#cfTermino").value = l.termino || ""; if (estrelas) $("#cfNota").value = String(l.nota || 0);
  let rasc = null; try { rasc = localStorage.getItem(chaveRascunho(id)); } catch (e) {}
  $("#cfResumo").value = rasc !== null && rasc !== (l.resumo || "") ? rasc : (l.resumo || "");
  if (rasc !== null && rasc !== (l.resumo || "")) $("#cfRascunho").textContent = "Recuperei um rascunho do resumo que ainda não tinha sido salvo.";
  $("#cfResumo").addEventListener("input", () => { try { localStorage.setItem(chaveRascunho(id), $("#cfResumo").value); } catch (e) {} });
  previas(l);
  $("#cadFichaFechar").addEventListener("click", fecharFicha);
  $("#cfCapaArq").addEventListener("change", async (e) => { const a = e.target.files[0]; e.target.value = ""; if (!a) return;
    try { A.capaNova = await prepararCapa(a); A.tirarCapa = false; previas(l); } catch (err) { $("#cfErro").textContent = err.message; } });
  $("#cfIlusArq").addEventListener("change", async (e) => { const a = e.target.files[0]; e.target.value = ""; if (!a) return;
    try { A.ilusNova = await prepararIlustracao(a); A.tirarIlus = false; previas(l); } catch (err) { $("#cfErro").textContent = err.message; } });
  $("#cfCapaTirar").addEventListener("click", () => { A.capaNova = null; A.tirarCapa = true; previas(l); });
  $("#cfIlusTirar").addEventListener("click", () => { A.ilusNova = null; A.tirarIlus = true; previas(l); });
  $("#cadFichaForm").addEventListener("submit", salvarFicha);
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}
function previas(l) {
  const capa = A.capaNova ? `<img src="${A.capaNova}" alt="">` : (l.capaDb && !A.tirarCapa) ? capaHTML({ id: "cl_" + l.id, titulo: l.titulo, capaDb: true, capaV: l.capaV }) : `<canvas width="96" height="144" id="cfCapaProv"></canvas>`;
  $("#cfCapaPrev").innerHTML = capa;
  const cv = $("#cfCapaProv"); if (cv) desenharCapa(cv, l, temaDe(A.cad), A.cad?.autor);
  $("#cfCapaTirar").hidden = !(A.capaNova || (l.capaDb && !A.tirarCapa));
  const temIlus = A.ilusNova || ((l.ilusDb || l.ilusPadrao) && !A.tirarIlus);
  $("#cfIlusPrev").innerHTML = A.ilusNova ? `<img src="${A.ilusNova}" alt="">`
    : (l.ilusDb && !A.tirarIlus) ? capaHTML({ id: "cli_" + l.id, titulo: l.titulo, capaDb: true, capaV: l.ilusV })
    : (l.ilusPadrao && !A.tirarIlus) ? `<span class="small">provisória</span>` : `<span class="small">sem ilustração</span>`;
  $("#cfIlusTirar").hidden = !temIlus;
}
function fecharFicha() { A.edit = null; const b = $("#cadFichaEd"); if (b) { b.hidden = true; b.innerHTML = ""; } }
async function salvarFicha(ev) {
  ev.preventDefault();
  const id = A.edit, l = A.livros.find(x => x.id === id); if (!l) return;
  $("#cfErro").textContent = ""; $("#cfOk").textContent = "";
  const btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true;
  const dados = {
    titulo: $("#cfTitulo").value.trim().slice(0, 120), subtitulo: $("#cfSubtitulo").value.trim(), editora: $("#cfEditora").value.trim(),
    publicacao: $("#cfPublicacao").value.trim(), paginas: $("#cfPaginas").value.trim(), status: $("#cfStatus").value,
    inicio: $("#cfInicio").value.trim(), termino: $("#cfTermino").value.trim(), resumo: $("#cfResumo").value.trim(),
    nota: $("#cfNota") ? Number($("#cfNota").value) : 0
  };
  try {
    if (A.capaNova) { const v = Date.now(); await setDoc(doc(db, "capas", "cl_" + id), { img: A.capaNova }); Object.assign(dados, { capaDb: true, capaV: v }); guardarCapaNoCache("cl_" + id, v, A.capaNova); }
    else if (A.tirarCapa) { await deleteDoc(doc(db, "capas", "cl_" + id)).catch(() => {}); dados.capaDb = false; }
    if (A.ilusNova) { const v = Date.now(); await setDoc(doc(db, "capas", "cli_" + id), { img: A.ilusNova }); Object.assign(dados, { ilusDb: true, ilusV: v }); guardarCapaNoCache("cli_" + id, v, A.ilusNova); }
    else if (A.tirarIlus) { await deleteDoc(doc(db, "capas", "cli_" + id)).catch(() => {}); Object.assign(dados, { ilusDb: false, ilusPadrao: "" }); }
    await setDoc(doc(db, "cadernoLivros", id), dados, { merge: true });
    try { localStorage.removeItem(chaveRascunho(id)); } catch (e) {}
    A.capaNova = null; A.ilusNova = null; A.tirarCapa = false; A.tirarIlus = false;
    $("#cfRascunho").textContent = ""; $("#cfOk").textContent = "Ficha salva.";
  } catch (err) { console.error(err); $("#cfErro").textContent = "Não foi possível salvar a ficha. Confira se as regras novas já foram publicadas no Firebase."; }
  finally { btn.disabled = false; }
}

/* ---------- importação dos cadernos da Taís ---------- */
const HAN = ["Vita contemplativa", "Infocracia", "Topologia da violência", "Sociedade do cansaço", "A crise da narração", "O desaparecimento dos rituais", "Sociedade paliativa", "No enxame", "Não-coisas", "A expulsão do outro", "Capitalismo e impulso de morte", "Falando sobre Deus", "O espírito da esperança", "Agonia do Eros", "Sem respeito", "Favor fechar os olhos", "Sociedade da transparência", "Ausência", "Filosofia do zen-budismo", "Bom entretenimento", "Hegel e o poder", "O coração de Heidegger", "O que é poder?", "Hiperculturalidade", "Morte e alteridade", "Psicopolítica", "Louvor à Terra"];
const HAN_FICHAS = {
  "Infocracia": { subtitulo: "Digitalização e a crise da democracia", editora: "Vozes", publicacao: "6ª reimpressão, 2025", paginas: "107", inicio: "04/09/2026", termino: "05/09/2026", nota: 5, status: "lido", ilusPadrao: "bustos",
    resumo: "Esta foi a primeira obra que li do autor Byung-Chul Han. Este livro examina como a passagem da sociedade industrial (focada no controle dos corpos e na produção de bens) para a sociedade da informação reconfigurou o exercício do poder e desestabilizou as bases da democracia representativa.\nSe no século XX a dominação ocorria pelo controle físico e disciplinar (a biopolítica de Michel Foucault), hoje somos regidos pela ==psicopolítica==. O regime de coação não nos coage pela força ou repressão; ele atua por estímulos positivos, promovendo uma falsa sensação de liberdade e engajamento. O poder já não se esconde na vigilância do Estado, mas na caixa-preta dos algoritmos.\nEnquanto as massas atuavam coletivamente, no século passado, por causas unificadas, agora, neste século, os…" },
  "Vita contemplativa": { subtitulo: "Ou sobre a inatividade", editora: "Vozes", publicacao: "4ª reimpressão, 2025", paginas: "174", inicio: "14/09/2026", status: "lendo", ilusPadrao: "lua" },
  "Sociedade do cansaço": { editora: "Vozes" }
};
const ANNE = ["Anne de Green Gables", "Anne de Avonlea", "Anne da Ilha", "Anne de Windy Poplars", "Anne e a Casa dos Sonhos", "Anne de Ingleside", "Vale do Arco-Íris", "Rilla de Ingleside", "Crônicas de Avonlea", "Mais crônicas de Avonlea", "Os contos dos Blythes – vol. 1", "Os poemas dos Blythes"];

export function renderImportarCadernos(especiais) {
  const box = $("#cadImportar"); if (!box) return;
  const temHan = especiais.some(e => e.id === "han"), temAnne = especiais.some(e => e.id === "anne");
  if (temHan && temAnne) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="caixa" style="margin-bottom:18px"><h3>Seus cadernos</h3>
    <p class="small">Cria ${!temHan && !temAnne ? "os dois cadernos" : "o caderno que falta"} a partir dos seus cadernos de papel: ${!temHan ? "<b>Byung-Chul Han</b> (27 livros, tema Noite estrelada)" : ""}${!temHan && !temAnne ? " e " : ""}${!temAnne ? "<b>Anne of Green Gables</b> (12 livros, tema Campo florido)" : ""}. Eles começam como rascunho.</p>
    <button class="btn solid" type="button" id="cadImpBtn" style="justify-self:start">Criar ${!temHan && !temAnne ? "os cadernos" : "o caderno"}</button><p class="erro" id="cadImpErro"></p></div>`;
  $("#cadImpBtn").addEventListener("click", async (ev) => {
    const botao = ev.currentTarget; botao.disabled = true;
    try {
      const b = writeBatch(db), agora = Date.now();
      if (!temHan) {
        b.set(doc(db, "especiais", "han"), { formato: "caderno", tema: "estrelas", titulo: "Livros e reflexões", autor: "Byung-Chul Han", destaque: "", rotuloAutor: "Autor",
          chamada: "", citacaoAutor: "", usaEstrelas: true, publicado: false, criadoEm: agora, atualizadoEm: agora });
        HAN.forEach((t, i) => b.set(doc(db, "cadernoLivros", `han-${String(i + 1).padStart(2, "0")}`), { caderno: "han", ordem: i, titulo: t, status: "fila", nota: 0, ...(HAN_FICHAS[t] || {}) }));
      }
      if (!temAnne) {
        b.set(doc(db, "especiais", "anne"), { formato: "caderno", tema: "campo", titulo: "Livros que li em", autor: "Lucy Maud Montgomery", destaque: "Anne of Green Gables", rotuloAutor: "Autora",
          chamada: "Dear old world, you are very lovely, and I am glad to be alive in you.", citacaoAutor: "Anne Shirley, Anne of Green Gables", usaEstrelas: false, publicado: false, criadoEm: agora + 1, atualizadoEm: agora });
        ANNE.forEach((t, i) => b.set(doc(db, "cadernoLivros", `anne-${String(i + 1).padStart(2, "0")}`), { caderno: "anne", ordem: i, titulo: t, status: "fila", nota: 0 }));
      }
      await b.commit();
    } catch (err) { console.error(err); $("#cadImpErro").textContent = "Não foi possível criar. Confira se as regras novas já foram publicadas no Firebase."; botao.disabled = false; }
  });
}
