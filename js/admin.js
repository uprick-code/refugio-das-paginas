// Painel da Taís: leitoras, encontros, votação e acervo.
import {
  auth, db, firebaseConfig, onAuthStateChanged, signOut, esc, emailDe, usuarioDoEmail, isAdminEmail,
  normalizaUsuario, dataCurta, hojeISO, capaHTML, ligarTema, ADMINS, prepararCapa, guardarCapaNoCache,
  prepararFoto, tamanhoLegivel
} from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, signOut as sairDe }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, query, orderBy,
  serverTimestamp, writeBatch, where, increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ACERVO_INICIAL } from "./acervo-inicial.js";
import { abrirLivrosCaderno, apagarLivrosDoCaderno, renderImportarCadernos } from "./caderno-admin.js";

const $ = (s) => document.querySelector(s);
ligarTema($("#themeBtn"));
$("#btnSair").addEventListener("click", () => signOut(auth).then(() => location.href = "index.html"));

// Uma segunda conexão, só na memória, para criar contas sem desconectar a Taís.
const appCadastro = initializeApp(firebaseConfig, "cadastro");
const authCadastro = initializeAuth(appCadastro, { persistence: inMemoryPersistence });

const S = { espaco: {}, regEnc: null, registro: null, regFotos: [], subReg: [], backup: {}, especiais: [], editEsp: null, fotoNova: null, tirarFoto: false, membros: [], encontros: [], livros: [], clube: {}, editEnc: null, editLivro: null, placarVisivel: false, contagem: null };
const livroPorId = (id) => S.livros.find(l => l.id === id);
const SITE = new URL("./", location.href).href;

/* ---------------- acesso ---------------- */
onAuthStateChanged(auth, (user) => {
  if (!user) { location.href = "index.html"; return; }
  $("#carregando").hidden = true;
  if (!isAdminEmail(user.email)) { $("#semAcesso").hidden = false; return; }
  $("#nomeTopo").textContent = usuarioDoEmail(user.email);
  $("#painel").hidden = false;
  iniciar();
});

/* ---------------- abas ---------------- */
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => abrirAba(t.dataset.tab)));
function abrirAba(nome) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === nome)));
  document.querySelectorAll("[data-painel]").forEach(p => p.hidden = p.dataset.painel !== nome);
  try { sessionStorage.setItem("refugio-aba", nome); } catch (e) {}
}
try { const a = sessionStorage.getItem("refugio-aba"); if (a) abrirAba(a); } catch (e) {}

function iniciar() {
  const falha = (e) => console.error(e);
  onSnapshot(collection(db, "membros"), s => {
    S.membros = s.docs.map(d => ({ usuario: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    renderLeitoras();
  }, falha);
  onSnapshot(query(collection(db, "encontros"), orderBy("data")), s => {
    S.encontros = s.docs.map(d => ({ id: d.id, ...d.data() })); renderEncontros(); renderVotacao();
  }, falha);
  onSnapshot(collection(db, "livros"), s => {
    S.livros = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.titulo.localeCompare(b.titulo));
    renderLivros(); renderEncontros(); renderVotacao(); renderLivrosEsp();
  }, falha);
  onSnapshot(collection(db, "especiais"), s => {
    S.especiais = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    renderEspeciais();
  }, falha);
  onSnapshot(doc(db, "config", "armazenamento"), s => { S.espaco = s.exists() ? s.data() : {}; renderEspaco(); }, falha);
  onSnapshot(doc(db, "config", "backup"), s => { S.backup = s.exists() ? s.data() : {}; renderBackup(); }, falha);
  onSnapshot(doc(db, "config", "clube"), s => { S.clube = s.exists() ? s.data() : {}; renderVotacao(); }, falha);
  $("#lSenha").value = gerarSenha();
}

/* ---------------- leitoras ---------------- */
const PALAVRAS = ["livro", "pagina", "leitura", "estante", "marcador", "prosa", "verso", "conto", "sebo", "folha", "capitulo", "enredo"];
function gerarSenha() {
  const r = new Uint32Array(2); crypto.getRandomValues(r);
  return `${PALAVRAS[r[0] % PALAVRAS.length]}-${String(r[1] % 900 + 100)}`;
}
$("#btnGerar").addEventListener("click", () => $("#lSenha").value = gerarSenha());
$("#lNome").addEventListener("input", () => {
  if ($("#lUsuario").dataset.mexido) return;
  $("#lUsuario").value = normalizaUsuario(($("#lNome").value.split(" ")[0] || ""));
});
$("#lUsuario").addEventListener("input", (e) => { e.target.dataset.mexido = "1"; e.target.value = normalizaUsuario(e.target.value); });

async function criarConta(usuario, geracao, senha) {
  const cred = await createUserWithEmailAndPassword(authCadastro, emailDe(usuario, geracao), senha);
  const uid = cred.user.uid;
  await sairDe(authCadastro);
  return uid;
}
function erroCadastro(e) {
  if (e.code === "auth/email-already-in-use") return "Já existe uma conta com esse usuário. Escolha outro nome de usuário.";
  if (e.code === "auth/weak-password") return "A senha precisa ter pelo menos 6 caracteres.";
  if (e.code === "auth/network-request-failed") return "Sem conexão com a internet.";
  return "Não foi possível criar o acesso. Tente de novo.";
}
function mostrarMensagem(nome, usuario, senha, nova) {
  const txt = nova
    ? `Oi, ${nome}! Gerei uma senha nova para o Refúgio das Páginas.\n\nSite: ${SITE}\nUsuário: ${usuario}\nSenha provisória: ${senha}\n\nNo próximo acesso, o site vai pedir para você criar a sua senha.`
    : `Oi, ${nome}! Seu acesso ao Refúgio das Páginas está pronto 📚\n\nSite: ${SITE}\nUsuário: ${usuario}\nSenha provisória: ${senha}\n\nNo primeiro acesso, o site vai pedir para você criar a sua senha. Lá você confirma presença, vota no livro do mês e deixa seus comentários.`;
  $("#msgZap").textContent = txt;
  $("#btnZap").href = "https://wa.me/?text=" + encodeURIComponent(txt);
  $("#msgArea").hidden = false;
  $("#msgArea").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("#btnCopiar").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#msgZap").textContent); $("#btnCopiar").textContent = "Copiada!"; }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("#msgZap")); getSelection().removeAllRanges(); getSelection().addRange(r); }
  setTimeout(() => $("#btnCopiar").textContent = "Copiar mensagem", 1800);
});

$("#formLeitora").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("#lNome").value.trim();
  const usuario = normalizaUsuario($("#lUsuario").value);
  const senha = $("#lSenha").value.trim();
  $("#leitoraErro").textContent = "";
  if (!nome || !usuario) return;
  if (senha.length < 6) { $("#leitoraErro").textContent = "A senha precisa ter pelo menos 6 caracteres."; return; }
  if (ADMINS.includes(usuario) || (await getDoc(doc(db, "membros", usuario))).exists()) {
    $("#leitoraErro").textContent = `O usuário "${usuario}" já existe. Escolha outro.`; return;
  }
  $("#btnCriar").disabled = true;
  try {
    const uid = await criarConta(usuario, 1, senha);
    await setDoc(doc(db, "membros", usuario), { nome, uid, papel: "leitora", ativo: true, trocarSenha: true, g: 1, criadoEm: serverTimestamp() });
    await setDoc(doc(db, "logins", usuario), { g: 1 });
    mostrarMensagem(nome, usuario, senha, false);
    $("#formLeitora").reset(); delete $("#lUsuario").dataset.mexido; $("#lSenha").value = gerarSenha();
  } catch (err) { console.error(err); $("#leitoraErro").textContent = erroCadastro(err); }
  finally { $("#btnCriar").disabled = false; }
});

function renderLeitoras() {
  const tb = $("#tLeitoras");
  if (!S.membros.length) { tb.innerHTML = `<tr><td colspan="4" class="vazio">Nenhuma leitora cadastrada ainda.</td></tr>`; return; }
  tb.innerHTML = S.membros.map(m => {
    const adm = m.papel === "admin";
    const sit = m.ativo === false ? `<span class="chip">desativada</span>`
      : m.trocarSenha ? `<span class="chip rosa">ainda não entrou</span>` : `<span class="chip verde">ativa</span>`;
    return `<tr><td>${esc(m.nome)}${adm ? ` <span class="small">(admin)</span>` : ""}</td><td style="font-family:var(--f-type)">${esc(m.usuario)}</td><td>${sit}</td>
      <td>${adm ? "" : `<div class="acoes">
        <button class="btn mini" type="button" data-novasenha="${esc(m.usuario)}">Nova senha</button>
        <button class="btn mini ${m.ativo === false ? "" : "perigo"}" type="button" data-ativo="${esc(m.usuario)}">${m.ativo === false ? "Reativar" : "Desativar"}</button></div>`}</td></tr>`;
  }).join("");
}
$("#tLeitoras").addEventListener("click", async (e) => {
  const ns = e.target.closest("[data-novasenha]");
  if (ns) {
    const m = S.membros.find(x => x.usuario === ns.dataset.novasenha); if (!m) return;
    if (ns.dataset.confirma !== "1") { ns.dataset.confirma = "1"; ns.textContent = "Confirmar?"; return; }
    ns.disabled = true;
    try {
      const g = (m.g || 1) + 1, senha = gerarSenha();
      const uid = await criarConta(m.usuario, g, senha);
      await updateDoc(doc(db, "membros", m.usuario), { uid, g, trocarSenha: true, ativo: true });
      await setDoc(doc(db, "logins", m.usuario), { g });
      mostrarMensagem(m.nome, m.usuario, senha, true);
      abrirAba("leitoras");
    } catch (err) { console.error(err); alertaLinha(ns, erroCadastro(err)); }
    return;
  }
  const at = e.target.closest("[data-ativo]");
  if (at) {
    const m = S.membros.find(x => x.usuario === at.dataset.ativo); if (!m) return;
    try { await updateDoc(doc(db, "membros", m.usuario), { ativo: m.ativo === false }); } catch (err) { console.error(err); }
  }
});
function alertaLinha(el, msg) { const p = document.createElement("p"); p.className = "erro"; p.textContent = msg; el.closest("td").appendChild(p); }

/* ---------------- encontros ---------------- */
function opcoesLivro(sel) {
  return `<option value="">— nenhum ainda —</option>` + S.livros.map(l => `<option value="${esc(l.id)}" ${l.id === sel ? "selected" : ""}>${esc(l.titulo)}</option>`).join("");
}
function limparEncontro() {
  S.editEnc = null; $("#formEncontro").reset(); $("#eHora").value = "16:00";
  $("#tituloEncontro").textContent = "Novo encontro"; $("#btnCancelarEnc").hidden = true;
  $("#eLivro").innerHTML = opcoesLivro("");
}
$("#btnCancelarEnc").addEventListener("click", limparEncontro);
$("#formEncontro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = { data: $("#eData").value, hora: $("#eHora").value, local: $("#eLocal").value.trim(), endereco: $("#eEnd").value.trim(),
    titulo: $("#ePauta").value.trim(), livroId: $("#eLivro").value || null };
  if (!dados.data) return;
  $("#encErro").textContent = "";
  try {
    if (S.editEnc) await setDoc(doc(db, "encontros", S.editEnc), dados, { merge: true });
    else await addDoc(collection(db, "encontros"), dados);
    limparEncontro();
  } catch (err) { console.error(err); $("#encErro").textContent = "Não foi possível salvar o encontro."; }
});
function renderEncontros() {
  if (!S.editEnc) $("#eLivro").innerHTML = opcoesLivro($("#eLivro").value);
  const h = hojeISO();
  $("#tEncontros").innerHTML = S.encontros.length ? S.encontros.map(e => {
    const l = e.livroId ? livroPorId(e.livroId) : null;
    return `<tr${e.data < h ? ' style="opacity:.65"' : ""}><td style="white-space:nowrap">${dataCurta(e.data)} ${e.data.slice(0, 4)}<br><span class="small">${esc(e.hora || "")}</span></td>
      <td>${esc(e.local || "—")}</td><td>${l ? esc(l.titulo) : '<span class="small">—</span>'}</td>
      <td><button class="btn mini" type="button" data-pres="${esc(e.id)}">Ver</button></td>
      <td><div class="acoes"><button class="btn mini" type="button" data-registro="${esc(e.id)}">Registro</button>
        <button class="btn mini" type="button" data-editenc="${esc(e.id)}">Editar</button>
        <button class="btn mini perigo" type="button" data-apagaenc="${esc(e.id)}">Apagar</button></div></td></tr>`;
  }).join("") : `<tr><td colspan="5" class="vazio">Nenhum encontro marcado. Se ainda não importou o acervo, a aba Acervo cria o 1º encontro junto.</td></tr>`;
}
$("#tEncontros").addEventListener("click", async (ev) => {
  const ed = ev.target.closest("[data-editenc]");
  if (ed) {
    const e = S.encontros.find(x => x.id === ed.dataset.editenc); if (!e) return;
    S.editEnc = e.id;
    $("#eData").value = e.data; $("#eHora").value = e.hora || ""; $("#eLocal").value = e.local || "";
    $("#eEnd").value = e.endereco || ""; $("#ePauta").value = e.titulo || ""; $("#eLivro").innerHTML = opcoesLivro(e.livroId || "");
    $("#tituloEncontro").textContent = "Editar encontro"; $("#btnCancelarEnc").hidden = false;
    $("#formEncontro").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const ap = ev.target.closest("[data-apagaenc]");
  if (ap) {
    if (ap.dataset.confirma !== "1") { ap.dataset.confirma = "1"; ap.textContent = "Confirmar?"; return; }
    try {
      const id = ap.dataset.apagaenc;
      const fs = await getDocs(query(collection(db, "fotos"), where("encontro", "==", id)));
      for (const f of fs.docs) await apagarFoto(f.id, f.data().bytes || 0);
      await deleteDoc(doc(db, "registros", id)).catch(() => {});
      await deleteDoc(doc(db, "encontros", id));
      if (S.regEnc === id) fecharRegistro();
    } catch (err) { console.error(err); }
    return;
  }
  const rg = ev.target.closest("[data-registro]");
  if (rg) { abrirRegistro(rg.dataset.registro); return; }
  const pr = ev.target.closest("[data-pres]");
  if (pr) {
    const e = S.encontros.find(x => x.id === pr.dataset.pres);
    const s = await getDocs(collection(db, "encontros", pr.dataset.pres, "presencas"));
    const nome = (u) => S.membros.find(m => m.usuario === u)?.nome || u;
    const grupos = { presencial: [], online: [], nao: [] };
    s.docs.forEach(d => (grupos[d.data().modo] || grupos.nao).push({ u: d.id, ...d.data() }));
    const respondeu = new Set(s.docs.map(d => d.id));
    const faltam = S.membros.filter(m => m.ativo !== false && !respondeu.has(m.usuario));
    const lista = (arr, lanche) => arr.length ? arr.map(p => `${esc(nome(p.u))}${lanche && p.lanche ? ` <span class="small">· ${esc(p.lanche)}</span>` : ""}`).join("<br>") : '<span class="small">—</span>';
    const c = $("#presencasCaixa");
    c.innerHTML = `<h3>Presenças · ${dataCurta(e.data)}</h3>
      <div class="linha"><div><span class="label">Presencial (${grupos.presencial.length})</span><p>${lista(grupos.presencial, true)}</p></div>
      <div><span class="label">Online (${grupos.online.length})</span><p>${lista(grupos.online)}</p></div></div>
      <div class="linha"><div><span class="label">Não poderão (${grupos.nao.length})</span><p>${lista(grupos.nao)}</p></div>
      <div><span class="label">Ainda não responderam (${faltam.length})</span><p>${faltam.length ? faltam.map(m => esc(m.nome)).join("<br>") : '<span class="small">—</span>'}</p></div></div>`;
    c.hidden = false;
  }
});

/* ---------------- votação ---------------- */
function renderVotacao() {
  const area = $("#votacaoPainel");
  const v = S.clube.votacao;
  const h = hojeISO();
  let topo = "";
  if (v?.status === "aberta") {
    const enc = S.encontros.find(e => e.id === v.encontroId);
    const cands = (v.candidatos || []).map(livroPorId).filter(Boolean);
    topo = `<div class="caixa" style="margin-bottom:26px">
      <span class="label">Votação aberta${enc ? ` · livro do encontro de ${dataCurta(enc.data)}` : ""}</span>
      <div class="candidatos">${cands.map(l => `<article class="cand">${capaHTML(l)}<div><h3>${esc(l.titulo)}</h3><p class="aut">${esc(l.autor)}</p></div></article>`).join("")}</div>
      <p id="totalVotos" class="small">Contando votos…</p>
      <div id="placar" class="placar" ${S.placarVisivel ? "" : "hidden"}></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" type="button" id="btnPlacar">${S.placarVisivel ? "Esconder placar" : "Ver placar (só você)"}</button>
        <button class="btn solid" type="button" id="btnRevelar">Encerrar e revelar</button>
        <button class="btn perigo" type="button" id="btnCancelarVot">Cancelar votação</button>
      </div>
      <div id="desempate"></div>
      <p class="erro" id="votErro" role="alert"></p>
    </div>`;
  } else if (v?.status === "revelada") {
    const venc = livroPorId(v.vencedor);
    topo = `<div class="caixa" style="margin-bottom:26px"><span class="label">Última votação</span>
      <p>Vencedor: <b>${esc(venc?.titulo || "—")}</b> · ${(v.candidatos || []).map(id => `${esc(livroPorId(id)?.titulo || id)}: ${(v.contagem || {})[id] || 0}`).join(" · ")}</p></div>`;
  }
  const futuros = S.encontros.filter(e => e.data >= h);
  const lidos = new Set(S.encontros.filter(e => e.livroId).map(e => e.livroId));
  const form = v?.status === "aberta" ? "" : `<div class="caixa">
    <h3>Nova votação</h3>
    ${futuros.length ? `<form id="formVot">
      <div class="field"><label for="vEnc">Livro para qual encontro?</label>
        <select id="vEnc" required>${futuros.map(e => `<option value="${esc(e.id)}">${dataCurta(e.data)} ${e.data.slice(0, 4)}${e.local ? " · " + esc(e.local) : ""}${e.livroId ? " (já tem livro)" : ""}</option>`).join("")}</select></div>
      <fieldset><legend>Escolha 2 ou 3 livros</legend>
        <div class="checks" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${S.livros.filter(l => !lidos.has(l.id)).map(l => `<label><input type="checkbox" name="cand" value="${esc(l.id)}"> ${esc(l.titulo)}</label>`).join("")}</div></fieldset>
      <button class="btn solid" type="submit">Abrir votação</button>
      <p class="erro" id="votErro" role="alert"></p>
    </form>` : `<p class="vazio">Crie primeiro o próximo encontro na aba Encontros.</p>`}
  </div>`;
  area.innerHTML = topo + form;

  if (v?.status === "aberta") {
    contarVotos(v).then(c => {
      S.contagem = c;
      const total = Object.values(c).reduce((a, b) => a + b, 0);
      const t = $("#totalVotos"); if (t) t.textContent = `${total} voto${total === 1 ? "" : "s"} recebido${total === 1 ? "" : "s"} até agora.`;
      const max = Math.max(1, ...Object.values(c));
      const p = $("#placar"); if (p) p.innerHTML = (v.candidatos || []).map(id => `<div><span class="small">${esc(livroPorId(id)?.titulo || id)}</span>
        <div class="barra"><div style="width:${(c[id] || 0) / max * 100}%"></div><span style="font-family:var(--f-type)">${c[id] || 0}</span></div></div>`).join("");
    }).catch(e => console.error(e));
    $("#btnPlacar").addEventListener("click", () => { S.placarVisivel = !S.placarVisivel; renderVotacao(); });
    $("#btnCancelarVot").addEventListener("click", async (ev) => {
      const b = ev.currentTarget;
      if (b.dataset.confirma !== "1") { b.dataset.confirma = "1"; b.textContent = "Confirmar cancelamento?"; return; }
      await setDoc(doc(db, "config", "clube"), { votacao: { status: "preparando" } });
    });
    $("#btnRevelar").addEventListener("click", async (ev) => {
      const b = ev.currentTarget;
      if (b.dataset.confirma !== "1") { b.dataset.confirma = "1"; b.textContent = "Revelar agora?"; return; }
      const c = await contarVotos(v);
      const max = Math.max(0, ...Object.values(c));
      const empatados = (v.candidatos || []).filter(id => (c[id] || 0) === max);
      if (max === 0) { $("#votErro").textContent = "Ainda não há votos."; return; }
      if (empatados.length > 1) {
        $("#desempate").innerHTML = `<p style="margin-top:10px">Empate entre ${empatados.map(id => `<b>${esc(livroPorId(id)?.titulo)}</b>`).join(" e ")}. Quem decide é você:</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${empatados.map(id => `<button class="btn mini" type="button" data-desempate="${esc(id)}">${esc(livroPorId(id)?.titulo)}</button>`).join("")}</div>`;
        $("#desempate").querySelectorAll("[data-desempate]").forEach(x => x.addEventListener("click", () => revelar(v, x.dataset.desempate, c)));
        return;
      }
      revelar(v, empatados[0], c);
    });
  } else if (futuros.length) {
    $("#formVot").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const cands = [...ev.target.querySelectorAll("input[name=cand]:checked")].map(i => i.value);
      if (cands.length < 2 || cands.length > 3) { $("#votErro").textContent = "Escolha 2 ou 3 livros."; return; }
      try {
        await setDoc(doc(db, "config", "clube"), { votacao: {
          rodada: "r" + Date.now(), status: "aberta", candidatos: cands, encontroId: $("#vEnc").value, vencedor: null, contagem: null
        } });
        S.placarVisivel = false;
      } catch (err) { console.error(err); $("#votErro").textContent = "Não foi possível abrir a votação."; }
    });
  }
}
async function contarVotos(v) {
  const s = await getDocs(collection(db, "votos", v.rodada, "v"));
  const c = Object.fromEntries((v.candidatos || []).map(id => [id, 0]));
  s.docs.forEach(d => { const l = d.data().livro; if (l in c) c[l]++; });
  return c;
}
async function revelar(v, vencedor, contagem) {
  try {
    const b = writeBatch(db);
    b.set(doc(db, "config", "clube"), { votacao: { ...v, status: "revelada", vencedor, contagem } });
    if (v.encontroId) b.update(doc(db, "encontros", v.encontroId), { livroId: vencedor });
    await b.commit();
  } catch (err) { console.error(err); const e = $("#votErro"); if (e) e.textContent = "Não foi possível revelar. Tente de novo."; }
}

/* ---------------- acervo ---------------- */
const CAMPOS = { titulo: "#bTitulo", autor: "#bAutor", meta: "#bMeta", chamada: "#bChamada", sinopse: "#bSinopse", capa: "#bCapa", compra: "#bCompra", aviso: "#bAviso" };
S.capaNova = null; S.tirarCapa = false;
function mostrarPrevia(html) {
  $("#capaPrevia").innerHTML = html || `<span class="small">sem capa</span>`;
  $("#btnTirarCapa").hidden = !S.capaNova && !(S.editLivro && livroPorId(S.editLivro)?.capaDb && !S.tirarCapa);
}
function limparLivro() {
  S.editLivro = null; S.capaNova = null; S.tirarCapa = false; $("#formLivro").reset();
  $("#tituloLivro").textContent = "Novo livro"; $("#btnCancelarLivro").hidden = true;
  $("#capaErro").textContent = ""; mostrarPrevia("");
}
$("#btnCancelarLivro").addEventListener("click", limparLivro);
$("#bArquivo").addEventListener("change", async (e) => {
  const arq = e.target.files[0]; if (!arq) return;
  $("#capaErro").textContent = "";
  try {
    S.capaNova = await prepararCapa(arq); S.tirarCapa = false;
    mostrarPrevia(`<img src="${S.capaNova}" alt="Prévia da capa">`);
  } catch (err) { $("#capaErro").textContent = err.message; }
  e.target.value = "";
});
$("#btnTirarCapa").addEventListener("click", () => {
  S.capaNova = null;
  if (S.editLivro && livroPorId(S.editLivro)?.capaDb) S.tirarCapa = true;
  const link = $("#bCapa").value.trim();
  mostrarPrevia(link ? `<img src="${esc(link)}" alt="">` : "");
});
$("#formLivro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(Object.entries(CAMPOS).map(([k, sel]) => [k, $(sel).value.trim()]));
  dados.brasil = $("#bBrasil").checked; dados.escritora = $("#bEscritora").checked;
  for (const k of ["capa", "compra"]) if (dados[k] && !/^(https?:\/\/|capas\/)/.test(dados[k])) { $("#livroErro").textContent = "Os links precisam começar com https://"; return; }
  $("#livroErro").textContent = "";
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    const id = S.editLivro || doc(collection(db, "livros")).id;
    if (S.capaNova) {
      const v = Date.now();
      await setDoc(doc(db, "capas", id), { img: S.capaNova });
      dados.capaDb = true; dados.capaV = v;
      guardarCapaNoCache(id, v, S.capaNova);
    } else if (S.tirarCapa) {
      dados.capaDb = false;
      await deleteDoc(doc(db, "capas", id)).catch(() => {});
    }
    if (S.editLivro) await setDoc(doc(db, "livros", id), dados, { merge: true });
    else await setDoc(doc(db, "livros", id), { ...dados, ordem: (Math.max(0, ...S.livros.map(l => l.ordem || 0)) + 1) });
    limparLivro();
  } catch (err) {
    console.error(err);
    $("#livroErro").textContent = "Não foi possível salvar o livro. Se enviou uma capa, confira se as regras novas já foram publicadas no Firebase.";
  } finally { btn.disabled = false; }
});
function renderLivros() {
  $("#importarArea").innerHTML = S.livros.length ? "" : `<div class="caixa"><h3>Começar o acervo</h3>
    <p class="small">Importa os 20 livros da sua lista, com capas e sinopses, e cria o 1º encontro (7 de novembro, 16h, Mirante Bistrô). Use uma vez só.</p>
    <button class="btn solid" type="button" id="btnImportar">Importar acervo inicial</button><p class="erro" id="impErro"></p></div>`;
  $("#btnImportar")?.addEventListener("click", importar);
  $("#tLivros").innerHTML = S.livros.map(l => `<tr>
    <td style="width:52px">${l.capa || l.capaDb ? capaHTML(l, "mini-capa") : ""}</td>
    <td><b style="font-family:var(--f-display);font-size:18px">${esc(l.titulo)}</b><br><span class="small">${esc(l.autor)}</span></td>
    <td>${l.compra ? '<span class="chip verde">tem link</span>' : '<span class="chip">sem link</span>'}</td>
    <td><div class="acoes"><button class="btn mini" type="button" data-editlivro="${esc(l.id)}">Editar</button>
      <button class="btn mini perigo" type="button" data-apagalivro="${esc(l.id)}">Remover</button></div></td></tr>`).join("");
}
$("#tLivros").addEventListener("click", async (ev) => {
  const ed = ev.target.closest("[data-editlivro]");
  if (ed) {
    const l = livroPorId(ed.dataset.editlivro); if (!l) return;
    S.editLivro = l.id; S.capaNova = null; S.tirarCapa = false;
    Object.entries(CAMPOS).forEach(([k, sel]) => $(sel).value = l[k] || "");
    $("#bBrasil").checked = !!l.brasil; $("#bEscritora").checked = !!l.escritora;
    $("#tituloLivro").textContent = "Editar livro"; $("#btnCancelarLivro").hidden = false;
    $("#capaErro").textContent = "";
    mostrarPrevia(l.capa || l.capaDb ? capaHTML(l) : "");
    $("#formLivro").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const ap = ev.target.closest("[data-apagalivro]");
  if (ap) {
    if (ap.dataset.confirma !== "1") { ap.dataset.confirma = "1"; ap.textContent = "Confirmar?"; return; }
    const id = ap.dataset.apagalivro, tinhaCapa = !!livroPorId(id)?.capaDb;
    try {
      await deleteDoc(doc(db, "livros", id));
      if (tinhaCapa) await deleteDoc(doc(db, "capas", id)).catch(() => {});
    } catch (err) { console.error(err); }
  }
});
async function importar() {
  $("#btnImportar").disabled = true;
  try {
    const b = writeBatch(db);
    ACERVO_INICIAL.forEach(({ id, ...l }) => b.set(doc(db, "livros", id), l));
    if (!S.encontros.length) b.set(doc(db, "encontros", "e2026-11-07"), {
      data: "2026-11-07", hora: "16:00", local: "Restaurante Mirante Bistrô",
      endereco: "Rua 109, nº 453 · Canto da Praia · Itapema/SC", titulo: "Encontro de abertura", livroId: null
    });
    b.set(doc(db, "config", "clube"), { votacao: { status: "preparando" } }, { merge: true });
    await b.commit();
  } catch (err) { console.error(err); $("#impErro").textContent = "Não foi possível importar. Confira se as regras de segurança já foram publicadas."; $("#btnImportar").disabled = false; }
}

/* ---------------- especiais ---------------- */
const fotoDe = (e) => ({ id: "esp_" + e.id, titulo: e.titulo, capaDb: e.fotoDb, capaV: e.fotoV, capa: "" });
const CAMPOS_ESP = { titulo: "#xTitulo", autor: "#xAutor", chamada: "#xChamada", bio: "#xBio", linhaTempo: "#xTempo", curiosidades: "#xCurios", links: "#xLinks" };
function renderLivrosEsp(marcados) {
  const sel = marcados || [...document.querySelectorAll("#xLivros input:checked")].map(i => i.value);
  $("#xLivros").innerHTML = S.livros.map(l => `<label><input type="checkbox" value="${esc(l.id)}" ${sel.includes(l.id) ? "checked" : ""}> ${esc(l.titulo)} <span class="small">· ${esc(l.autor)}</span></label>`).join("")
    || `<p class="small">O acervo está vazio.</p>`;
}
function previaFoto(html) {
  $("#fotoPrevia").innerHTML = html || `<span class="small">sem foto</span>`;
  const atual = S.editEsp && S.especiais.find(x => x.id === S.editEsp);
  $("#btnTirarFoto").hidden = !S.fotoNova && !(atual?.fotoDb && !S.tirarFoto);
}
// Formato do especial: "Página do autor" (biografia, linha do tempo) ou "Caderno de leitura" (coleção de livros).
function formatoEsp() { return $("#xFmtCaderno").checked ? "caderno" : "pagina"; }
function ajustarFormato() {
  const cad = formatoEsp() === "caderno";
  document.querySelectorAll("#formEsp .so-caderno").forEach(el => el.hidden = !cad);
  document.querySelectorAll("#formEsp .so-pagina").forEach(el => el.hidden = cad);
  $("#lblXTitulo").textContent = cad ? "Título do caderno" : "Título";
  $("#xTitulo").placeholder = cad ? "Livros e reflexões" : "Han Kang";
  $("#lblXAutor").textContent = cad ? "Autor ou autora dos livros" : "Subtítulo";
  $("#xAutor").placeholder = cad ? "Byung-Chul Han" : "Coreia do Sul · Nobel de Literatura 2024";
  $("#lblXChamada").textContent = cad ? "Citação da abertura (opcional)" : "Frase de abertura";
  $("#lblXFoto").textContent = cad ? "Imagem de abertura" : "Foto";
}
document.querySelectorAll("input[name=xFormato]").forEach(r => r.addEventListener("change", ajustarFormato));
function limparEsp() {
  S.editEsp = null; S.fotoNova = null; S.tirarFoto = false; $("#formEsp").reset(); ajustarFormato();
  $("#tituloEsp").textContent = "Novo especial"; $("#btnCancelarEsp").hidden = true;
  $("#fotoErro").textContent = ""; $("#espErro").textContent = ""; previaFoto(""); renderLivrosEsp([]);
}
$("#btnCancelarEsp").addEventListener("click", limparEsp);
$("#xArquivo").addEventListener("change", async (e) => {
  const arq = e.target.files[0]; if (!arq) return;
  $("#fotoErro").textContent = "";
  try { S.fotoNova = await prepararCapa(arq); S.tirarFoto = false; previaFoto(`<img src="${S.fotoNova}" alt="Prévia da foto">`); }
  catch (err) { $("#fotoErro").textContent = err.message; }
  e.target.value = "";
});
$("#btnTirarFoto").addEventListener("click", () => { S.fotoNova = null; if (S.editEsp) S.tirarFoto = true; previaFoto(""); });
$("#formEsp").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(Object.entries(CAMPOS_ESP).map(([k, sel]) => [k, $(sel).value.trim()]));
  dados.livros = [...document.querySelectorAll("#xLivros input:checked")].map(i => i.value);
  dados.publicado = $("#xPublicado").checked;
  dados.formato = formatoEsp();
  if (dados.formato === "caderno") {
    Object.assign(dados, { tema: $("#xTema").value, rotuloAutor: $("#xRotulo").value, destaque: $("#xDestaque").value.trim(),
      citacaoAutor: $("#xCitAutor").value.trim(), usaEstrelas: $("#xEstrelas").checked, atualizadoEm: Date.now() });
  }
  $("#espErro").textContent = "";
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    const id = S.editEsp || doc(collection(db, "especiais")).id;
    if (S.fotoNova) {
      const v = Date.now();
      await setDoc(doc(db, "capas", "esp_" + id), { img: S.fotoNova });
      dados.fotoDb = true; dados.fotoV = v;
      guardarCapaNoCache("esp_" + id, v, S.fotoNova);
    } else if (S.tirarFoto) {
      dados.fotoDb = false;
      await deleteDoc(doc(db, "capas", "esp_" + id)).catch(() => {});
    }
    if (S.editEsp) await setDoc(doc(db, "especiais", id), dados, { merge: true });
    else await setDoc(doc(db, "especiais", id), { ...dados, criadoEm: Date.now() });
    limparEsp();
  } catch (err) { console.error(err); $("#espErro").textContent = "Não foi possível salvar o especial. Confira se as regras novas já foram publicadas no Firebase."; }
  finally { btn.disabled = false; }
});
function renderEspeciais() {
  $("#tEsp").innerHTML = S.especiais.length ? S.especiais.map(x => `<tr>
    <td style="width:52px">${x.fotoDb ? capaHTML(fotoDe(x), "mini-capa") : ""}</td>
    <td><b style="font-family:var(--f-display);font-size:18px">${esc(x.formato === "caderno" ? (x.destaque || x.autor || x.titulo) : x.titulo)}</b><br><span class="small">${esc(x.formato === "caderno" ? "Caderno · " + (x.titulo || "") : (x.autor || ""))}</span></td>
    <td>${x.publicado ? '<span class="chip verde">publicado</span>' : '<span class="chip">rascunho</span>'}</td>
    <td><div class="acoes">
      ${x.formato === "caderno" ? `<button class="btn mini solid" type="button" data-livroscad="${esc(x.id)}">Livros</button>` : ""}
      <button class="btn mini" type="button" data-editesp="${esc(x.id)}">Editar</button>
      <button class="btn mini" type="button" data-pubesp="${esc(x.id)}">${x.publicado ? "Despublicar" : "Publicar"}</button>
      <button class="btn mini perigo" type="button" data-apagaesp="${esc(x.id)}">Apagar</button></div></td></tr>`).join("")
    : `<tr><td colspan="4" class="vazio">Nenhum especial ainda. Comece pelo formulário ao lado; ele fica como rascunho até você marcar "Publicado".</td></tr>`;
  renderImportarCadernos(S.especiais);
}
$("#tEsp").addEventListener("click", async (ev) => {
  const ed = ev.target.closest("[data-editesp]");
  if (ed) {
    const x = S.especiais.find(y => y.id === ed.dataset.editesp); if (!x) return;
    S.editEsp = x.id; S.fotoNova = null; S.tirarFoto = false;
    Object.entries(CAMPOS_ESP).forEach(([k, sel]) => $(sel).value = x[k] || "");
    $("#xPublicado").checked = !!x.publicado; renderLivrosEsp(x.livros || []);
    (x.formato === "caderno" ? $("#xFmtCaderno") : $("#xFmtPagina")).checked = true;
    $("#xTema").value = x.tema || "estrelas"; $("#xRotulo").value = x.rotuloAutor || "Autor";
    $("#xDestaque").value = x.destaque || ""; $("#xCitAutor").value = x.citacaoAutor || ""; $("#xEstrelas").checked = x.usaEstrelas !== false;
    ajustarFormato();
    $("#tituloEsp").textContent = "Editar especial"; $("#btnCancelarEsp").hidden = false;
    previaFoto(x.fotoDb ? capaHTML(fotoDe(x)) : "");
    $("#formEsp").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const lc = ev.target.closest("[data-livroscad]");
  if (lc) { const x = S.especiais.find(y => y.id === lc.dataset.livroscad); if (x) abrirLivrosCaderno(x); return; }
  const pb = ev.target.closest("[data-pubesp]");
  if (pb) {
    const x = S.especiais.find(y => y.id === pb.dataset.pubesp); if (!x) return;
    try { await updateDoc(doc(db, "especiais", x.id), { publicado: !x.publicado }); } catch (err) { console.error(err); }
    return;
  }
  const ap = ev.target.closest("[data-apagaesp]");
  if (ap) {
    if (ap.dataset.confirma !== "1") { ap.dataset.confirma = "1"; ap.textContent = "Confirmar?"; return; }
    const id = ap.dataset.apagaesp, tinhaFoto = !!S.especiais.find(y => y.id === id)?.fotoDb;
    try {
      if (S.especiais.find(y => y.id === id)?.formato === "caderno") await apagarLivrosDoCaderno(id);
      await deleteDoc(doc(db, "especiais", id));
      if (tinhaFoto) await deleteDoc(doc(db, "capas", "esp_" + id)).catch(() => {});
    } catch (err) { console.error(err); }
  }
});

/* ---------------- cópia de segurança ---------------- */
function renderBackup() {
  const ult = S.backup?.ultimo;
  const dias = ult ? Math.floor((Date.now() - ult) / 864e5) : null;
  const quando = ult ? new Date(ult).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : null;
  $("#backupInfo").textContent = !ult
    ? "Nenhuma cópia baixada ainda. Baixe uma agora e guarde o arquivo no computador ou no Google Drive."
    : dias > 35
      ? `A última cópia foi baixada em ${quando}, há ${dias} dias. Vale baixar uma nova.`
      : `Última cópia baixada em ${quando}. Sugestão: baixar uma por mês, depois de cada encontro.`;
  $("#backupBox").classList.toggle("atrasado", !ult || dias > 35);
}
// Converte datas do Firestore para texto legível no arquivo.
function limpo(v) {
  if (v && typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(limpo);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limpo(x)]));
  return v;
}
async function lerColecao(...caminho) {
  const s = await getDocs(collection(db, ...caminho));
  return Object.fromEntries(s.docs.map(d => [d.id, limpo(d.data())]));
}
$("#btnBackup").addEventListener("click", async () => {
  const btn = $("#btnBackup"); btn.disabled = true; btn.textContent = "Preparando…";
  try {
    const dados = {
      membros: await lerColecao("membros"),
      logins: {},
      livros: await lerColecao("livros"),
      notas: {},
      encontros: await lerColecao("encontros"),
      presencas: {},
      especiais: await lerColecao("especiais"),
      capas: await lerColecao("capas"),
      config: await lerColecao("config"),
      registros: await lerColecao("registros"),
      cadernoLivros: await lerColecao("cadernoLivros"),
      reflexoes: {},
      fotos: {},
      votos: {}
    };
    // Só a lista das fotos (encontro, legenda, ordem); as imagens vão na "Cópia das fotos".
    for (const [id, f] of Object.entries(await lerColecao("fotos"))) { const { mini, ...resto } = f; dados.fotos[id] = resto; }
    for (const u of Object.keys(dados.membros)) {
      const l = await getDoc(doc(db, "logins", u)); if (l.exists()) dados.logins[u] = l.data();
    }
    for (const id of Object.keys(dados.livros)) {
      const n = await lerColecao("livros", id, "notas"); if (Object.keys(n).length) dados.notas[id] = n;
    }
    for (const id of Object.keys(dados.cadernoLivros)) {
      const r = await lerColecao("cadernoLivros", id, "reflexoes"); if (Object.keys(r).length) dados.reflexoes[id] = r;
    }
    for (const id of Object.keys(dados.encontros)) {
      const p = await lerColecao("encontros", id, "presencas"); if (Object.keys(p).length) dados.presencas[id] = p;
    }
    const rodada = dados.config.clube?.votacao?.rodada;
    if (rodada) dados.votos[rodada] = await lerColecao("votos", rodada, "v");
    const arquivo = { clube: "Refúgio das Páginas", versao: 1, exportadoEm: new Date().toISOString(), dados };
    const hoje = new Date();
    const nome = `refugio-das-paginas-dados-${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(arquivo, null, 1)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await setDoc(doc(db, "config", "backup"), { ultimo: Date.now() });
    btn.textContent = "Cópia baixada";
  } catch (err) {
    console.error(err);
    $("#backupInfo").textContent = "Não foi possível gerar a cópia. Confira a internet e tente de novo.";
    btn.textContent = "Cópia dos dados";
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = "Cópia dos dados"; }, 4000);
  }
});

/* ---------------- registro dos encontros ---------------- */
const MAX_FOTOS = 24, COTA = 1024 * 1024 * 1024;
function renderEspaco() {
  const b = S.espaco.bytes || 0, n = S.espaco.fotos || 0;
  const pct = Math.min(100, b / COTA * 100);
  const txt = n ? `Fotos dos encontros: ${n} foto${n === 1 ? "" : "s"}, cerca de ${tamanhoLegivel(b)} usados de 1 GB grátis (${pct < 1 ? "menos de 1" : Math.round(pct)}%).`
    : "Fotos dos encontros: nenhuma enviada ainda. O espaço grátis é de 1 GB, o bastante para uns 10 anos de encontros.";
  $("#espacoInfo").textContent = txt;
  const r = $("#regEspaco"); if (r) r.textContent = txt;
}
function fecharRegistro() {
  S.subReg.forEach(u => u()); S.subReg = []; S.regEnc = null; S.registro = null; S.regFotos = [];
  $("#registroCaixa").hidden = true; $("#registroCaixa").innerHTML = "";
}
function abrirRegistro(id) {
  fecharRegistro();
  const e = S.encontros.find(x => x.id === id); if (!e) return;
  S.regEnc = id;
  const c = $("#registroCaixa");
  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
      <h3>Registro · ${esc(dataCurta(e.data))} ${e.data.slice(0, 4)}</h3>
      <button class="btn mini" type="button" id="btnFecharReg">Fechar</button>
    </div>
    <form id="formReg" autocomplete="off">
      <div class="field"><label for="rTexto">Apresentação do encontro</label>
        <textarea id="rTexto" rows="6" maxlength="6000" placeholder="Como foi o encontro, o que mais rendeu na conversa… Um parágrafo por linha."></textarea></div>
      <div class="field"><label for="rFrase">Frase da noite (opcional)</label><input type="text" id="rFrase" maxlength="240" placeholder="Uma frase do livro ou de alguém do grupo"></div>
      <div class="linha">
        <div class="field"><label for="rNota">Nota média do grupo</label><input type="text" inputmode="decimal" id="rNota" maxlength="3" placeholder="4,5"></div>
        <div class="checks" style="align-content:end"><label><input type="checkbox" id="rPub"> Publicado</label></div>
      </div>
      <button class="btn solid" type="submit" style="justify-self:start">Salvar registro</button>
      <p class="erro" id="regErro" role="alert"></p><p class="ok" id="regOk" role="status"></p>
    </form>
    <div style="display:grid;gap:10px;border-top:1px dashed var(--line);padding-top:16px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <span class="label" id="regContagem">Fotos</span>
        <span style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="file" id="rArquivos" accept="image/*" multiple class="visually-hidden">
          <label for="rArquivos" class="btn mini solid" id="lblEnviarFotos">Enviar fotos</label>
          <button class="btn mini" type="button" id="btnZipEnc">Baixar fotos (.zip)</button>
        </span>
      </div>
      <p class="small" id="fotoProg" role="status"></p>
      <div class="reg-fotos" id="regFotos"></div>
      <p class="small" id="regEspaco"></p>
    </div>`;
  c.hidden = false;
  renderEspaco();
  c.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#btnFecharReg").addEventListener("click", fecharRegistro);
  $("#formReg").addEventListener("submit", salvarRegistro);
  $("#rArquivos").addEventListener("change", (ev) => { const a = [...ev.target.files]; ev.target.value = ""; enviarFotos(a); });
  $("#btnZipEnc").addEventListener("click", (ev) => baixarFotosZip([id], ev.currentTarget));
  $("#regFotos").addEventListener("click", cliqueFoto);
  $("#regFotos").addEventListener("change", async (ev) => {
    const i = ev.target.closest("[data-legenda]"); if (!i) return;
    try { await updateDoc(doc(db, "fotos", i.dataset.legenda), { legenda: i.value.trim().slice(0, 200) }); } catch (err) { console.error(err); }
  });
  let primeiro = true;
  S.subReg.push(onSnapshot(doc(db, "registros", id), s => {
    S.registro = s.exists() ? s.data() : {};
    if (primeiro) {
      primeiro = false;
      $("#rTexto").value = S.registro.texto || ""; $("#rFrase").value = S.registro.frase || "";
      $("#rNota").value = S.registro.nota != null ? String(S.registro.nota).replace(".", ",") : "";
      $("#rPub").checked = !!S.registro.publicado;
    }
    renderFotosReg();
  }, err => console.error(err)));
  S.subReg.push(onSnapshot(query(collection(db, "fotos"), where("encontro", "==", id)), s => {
    S.regFotos = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    renderFotosReg();
  }, err => console.error(err)));
}
async function salvarRegistro(ev) {
  ev.preventDefault();
  $("#regErro").textContent = ""; $("#regOk").textContent = "";
  const notaTxt = $("#rNota").value.trim().replace(",", ".");
  const nota = notaTxt ? Number(notaTxt) : null;
  if (nota !== null && (isNaN(nota) || nota < 0 || nota > 5)) { $("#regErro").textContent = "A nota precisa ser um número de 0 a 5, como 4,5."; return; }
  try {
    await setDoc(doc(db, "registros", S.regEnc), {
      texto: $("#rTexto").value.trim(), frase: $("#rFrase").value.trim(), nota: nota === null ? null : Math.round(nota * 10) / 10,
      publicado: $("#rPub").checked, atualizadoEm: Date.now()
    }, { merge: true });
    $("#regOk").textContent = $("#rPub").checked ? "Registro salvo e publicado para as leitoras." : "Registro salvo como rascunho.";
  } catch (err) { console.error(err); $("#regErro").textContent = "Não foi possível salvar. Confira se as regras novas já foram publicadas no Firebase."; }
}
function renderFotosReg() {
  const g = $("#regFotos"); if (!g) return;
  const capa = S.registro?.capa;
  const n = S.regFotos.length;
  $("#regContagem").textContent = `Fotos (${n} de ${MAX_FOTOS})`;
  if (n >= MAX_FOTOS) $("#lblEnviarFotos").setAttribute("aria-disabled", "true");
  else if (!$("#fotoProg").textContent.startsWith("Preparando")) $("#lblEnviarFotos").removeAttribute("aria-disabled");
  // Mantém o que a Taís está digitando numa legenda.
  const foco = document.activeElement?.dataset?.legenda, valor = foco ? document.activeElement.value : null;
  g.innerHTML = n ? S.regFotos.map(f => `<figure class="reg-foto ${f.id === capa ? "capa" : ""}">
      <img src="${f.mini}" alt="">
      <input type="text" data-legenda="${esc(f.id)}" value="${esc(f.legenda || "")}" maxlength="200" placeholder="Legenda" aria-label="Legenda da foto">
      <div class="reg-acoes">
        <button class="btn mini" type="button" data-capa="${esc(f.id)}" aria-pressed="${f.id === capa}">${f.id === capa ? "★ Capa" : "☆ Capa"}</button>
        <button class="btn mini perigo" type="button" data-apagafoto="${esc(f.id)}">Apagar</button>
      </div></figure>`).join("")
    : `<p class="vazio">Nenhuma foto ainda. Toque em "Enviar fotos" e escolha várias de uma vez na galeria.</p>`;
  if (foco) { const i = g.querySelector(`[data-legenda="${CSS.escape(foco)}"]`); if (i) { i.value = valor; i.focus(); } }
}
async function cliqueFoto(ev) {
  const cp = ev.target.closest("[data-capa]");
  if (cp) { try { await setDoc(doc(db, "registros", S.regEnc), { capa: cp.dataset.capa }, { merge: true }); } catch (err) { console.error(err); } return; }
  const ap = ev.target.closest("[data-apagafoto]");
  if (ap) {
    if (ap.dataset.confirma !== "1") { ap.dataset.confirma = "1"; ap.textContent = "Confirmar?"; return; }
    const f = S.regFotos.find(x => x.id === ap.dataset.apagafoto); if (!f) return;
    ap.disabled = true;
    try {
      await apagarFoto(f.id, f.bytes || 0);
      if (S.registro?.capa === f.id) {
        const outra = S.regFotos.find(x => x.id !== f.id);
        await setDoc(doc(db, "registros", S.regEnc), { capa: outra ? outra.id : null }, { merge: true });
      }
    } catch (err) { console.error(err); ap.disabled = false; }
  }
}
async function apagarFoto(id, bytes) {
  await deleteDoc(doc(db, "fotos", id));
  await deleteDoc(doc(db, "fotosGrandes", id)).catch(() => {});
  await setDoc(doc(db, "config", "armazenamento"), { bytes: increment(-bytes), fotos: increment(-1) }, { merge: true });
}
async function enviarFotos(arquivos) {
  const enc = S.regEnc; if (!enc || !arquivos.length) return;
  const vagas = MAX_FOTOS - S.regFotos.length;
  const prog = $("#fotoProg");
  if (vagas <= 0) { prog.textContent = `Este encontro já tem ${MAX_FOTOS} fotos. Apague alguma para enviar outras.`; return; }
  const lote = arquivos.slice(0, vagas);
  const avisos = [];
  if (arquivos.length > vagas) avisos.push(`Só cabiam mais ${vagas}; ${arquivos.length - vagas} foto${arquivos.length - vagas === 1 ? " ficou" : "s ficaram"} de fora.`);
  $("#lblEnviarFotos").setAttribute("aria-disabled", "true");
  let ok = 0, ordem = Date.now();
  for (let i = 0; i < lote.length; i++) {
    if (S.regEnc !== enc) break;
    prog.textContent = `Preparando e enviando ${i + 1} de ${lote.length}… Não feche esta página.`;
    try {
      const f = await prepararFoto(lote[i]);
      const id = doc(collection(db, "fotos")).id;
      const bytes = f.grande.length + f.mini.length;
      await setDoc(doc(db, "fotosGrandes", id), { img: f.grande });
      await setDoc(doc(db, "fotos", id), { encontro: enc, mini: f.mini, legenda: "", ordem: ordem + i, bytes });
      await setDoc(doc(db, "config", "armazenamento"), { bytes: increment(bytes), fotos: increment(1) }, { merge: true });
      if (!S.registro?.capa && ok === 0) await setDoc(doc(db, "registros", enc), { capa: id }, { merge: true });
      ok++;
    } catch (err) {
      console.error(err);
      avisos.push(err.message && !err.code ? err.message : `"${lote[i].name}" não foi enviada. Confira a internet e as regras do Firebase.`);
    }
  }
  $("#lblEnviarFotos").removeAttribute("aria-disabled");
  prog.textContent = `${ok} foto${ok === 1 ? " enviada" : "s enviadas"}.` + (avisos.length ? " " + avisos.join(" ") : "");
}

// ZIP com as fotos em tamanho grande, uma pasta por encontro, mais as legendas.
let jszip = null;
function carregarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszip) jszip = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => ok(window.JSZip); s.onerror = () => { jszip = null; falha(new Error("zip")); };
    document.head.appendChild(s);
  });
  return jszip;
}
async function baixarFotosZip(encontroIds, botao) {
  const rotulo = botao.textContent; botao.disabled = true; botao.textContent = "Preparando…";
  try {
    const JSZip = await carregarJSZip();
    const zip = new JSZip(); let total = 0;
    for (const id of encontroIds) {
      const e = S.encontros.find(x => x.id === id);
      const pasta = zip.folder(e ? e.data : id);
      const fs = (await getDocs(query(collection(db, "fotos"), where("encontro", "==", id)))).docs
        .map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const legendas = [];
      for (let i = 0; i < fs.length; i++) {
        botao.textContent = `Baixando ${++total}…`;
        const g = await getDoc(doc(db, "fotosGrandes", fs[i].id));
        const dado = g.exists() ? g.data().img : fs[i].mini;
        const nome = `${String(i + 1).padStart(2, "0")}.jpg`;
        pasta.file(nome, dado.split(",")[1], { base64: true });
        if (fs[i].legenda) legendas.push(`${nome}: ${fs[i].legenda}`);
      }
      if (legendas.length) pasta.file("legendas.txt", legendas.join("\n"));
    }
    if (!total) { botao.textContent = "Nenhuma foto"; return; }
    const blob = await zip.generateAsync({ type: "blob" });
    const hoje = hojeISO();
    const nome = encontroIds.length === 1 ? `refugio-fotos-${S.encontros.find(x => x.id === encontroIds[0])?.data || hoje}.zip` : `refugio-das-paginas-fotos-${hoje}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    botao.textContent = "Baixado";
  } catch (err) {
    console.error(err); botao.textContent = "Não foi possível baixar";
  } finally {
    botao.disabled = false; setTimeout(() => { botao.textContent = rotulo; }, 3500);
  }
}
$("#btnBackupFotos").addEventListener("click", (ev) => baixarFotosZip(S.encontros.map(e => e.id), ev.currentTarget));
