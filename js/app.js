// Área das leitoras.
import {
  auth, db, entrar, trocarSenha, onAuthStateChanged, signOut, esc, usuarioDoEmail, isAdminEmail,
  dataExtenso, dataCurta, hojeISO, diasAte, parseData, MESES_CAP, capaHTML, ligarTema
} from "./firebase.js?v=20261031e";
import { enfeitarRosto, planta } from "./ornamentos.js?v=20261031e";
import { cardCaderno, pintarCartoes, abrirCadernoPeloEndereco, fecharCaderno, contextoCaderno } from "./caderno.js?v=20261031e";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, onSnapshot, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const VAGAS = 15;
const TRECHOS = ["Sem spoiler", "Até a metade", "Livro inteiro"];

enfeitarRosto();
ligarTema($("#themeBtn"));

const estado = {
  usuario: null, admin: false,
  membros: {}, livros: [], encontros: [], clube: {},
  presencas: [], meuVoto: null, notas: [], especiais: [], registros: [],
  filtro: "todos",
  subs: [], subPresencas: null, subVoto: null, subNotas: null,
  chavePres: null, chaveVoto: null, chaveNotas: null
};
try { estado.filtro = localStorage.getItem("refugio-filtro") || "todos"; } catch (e) {}

function mostrar(tela) {
  $("#carregando").hidden = tela !== "carregando";
  $("#telaLogin").hidden = tela !== "login";
  $("#telaApp").hidden = tela !== "app";
  $("#navlinks").hidden = tela !== "app";
  $("#quemSou").hidden = tela !== "app";
  $("#btnMenu").hidden = tela !== "app";
  fecharMenu();
}

/* ---------------- menu no celular ---------------- */
const nav = document.querySelector("nav.top");
function fecharMenu() {
  nav.classList.remove("aberto");
  $("#btnMenu").setAttribute("aria-expanded", "false");
  $("#btnMenu .btn-menu-txt").textContent = "Menu";
}
$("#btnMenu").addEventListener("click", () => {
  const abrir = !nav.classList.contains("aberto");
  nav.classList.toggle("aberto", abrir);
  $("#btnMenu").setAttribute("aria-expanded", String(abrir));
  $("#btnMenu .btn-menu-txt").textContent = abrir ? "Fechar" : "Menu";
});
$("#navlinks").addEventListener("click", (e) => { if (e.target.closest("a")) fecharMenu(); });
document.addEventListener("click", (e) => { if (nav.classList.contains("aberto") && !nav.contains(e.target)) fecharMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharMenu(); });

// Destaca no menu a seção que está na tela.
const espiao = "IntersectionObserver" in window ? new IntersectionObserver((itens) => {
  itens.forEach(i => {
    if (!i.isIntersecting) return;
    document.querySelectorAll("#navlinks a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + i.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" }) : null;
document.querySelectorAll("#telaApp section[id]").forEach(s => espiao?.observe(s));

/* ---------------- entrada ---------------- */
$("#formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginErro").textContent = "";
  $("#btnEntrar").disabled = true;
  try { await entrar($("#loginUsuario").value, $("#loginSenha").value); }
  catch (err) { $("#loginErro").textContent = err.message; }
  finally { $("#btnEntrar").disabled = false; }
});
$("#btnSair").addEventListener("click", () => signOut(auth));
$("#btnSairMenu").addEventListener("click", () => signOut(auth));

// Troca de senha: obrigatória no primeiro acesso, ou quando a leitora quiser (menu "Trocar senha").
let senhaVoluntaria = false;
function abrirTrocaSenha(voluntaria) {
  senhaVoluntaria = voluntaria;
  $("#tituloSenha").textContent = voluntaria ? "Trocar senha" : "Crie sua senha";
  $("#textoSenha").textContent = voluntaria
    ? "Digite a senha que você usa hoje e escolha a nova, com pelo menos 6 caracteres."
    : "Você entrou com uma senha provisória. Escolha uma senha só sua, com pelo menos 6 caracteres.";
  $("#campoAtual").hidden = !voluntaria; $("#senhaAtual").required = voluntaria;
  $("#btnCancelarSenha").hidden = !voluntaria;
  $("#senhaErro").textContent = ""; $("#senhaOk").textContent = "";
  $("#formSenha").reset();
  $("#modalSenha").hidden = false;
  setTimeout(() => (voluntaria ? $("#senhaAtual") : $("#senhaNova")).focus(), 50);
}
function fecharTrocaSenha() { $("#modalSenha").hidden = true; $("#formSenha").reset(); }
document.querySelectorAll("[data-trocar-senha]").forEach(b => b.addEventListener("click", () => { fecharMenu(); abrirTrocaSenha(true); }));
$("#btnCancelarSenha").addEventListener("click", fecharTrocaSenha);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && senhaVoluntaria && !$("#modalSenha").hidden) fecharTrocaSenha(); });
$("#formSenha").addEventListener("submit", async (e) => {
  e.preventDefault();
  const a = $("#senhaNova").value, b = $("#senhaConf").value;
  $("#senhaErro").textContent = ""; $("#senhaOk").textContent = "";
  if (a !== b) { $("#senhaErro").textContent = "As duas senhas não são iguais."; return; }
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    await trocarSenha(a, senhaVoluntaria ? $("#senhaAtual").value : undefined);
    if (!senhaVoluntaria) await updateDoc(doc(db, "membros", estado.usuario), { trocarSenha: false });
    $("#formSenha").reset();
    if (senhaVoluntaria) { $("#senhaOk").textContent = "Senha trocada! Use a nova no próximo acesso."; setTimeout(fecharTrocaSenha, 1800); }
    else $("#modalSenha").hidden = true;
  } catch (err) { $("#senhaErro").textContent = err.message; }
  finally { btn.disabled = false; }
});

function pararTudo() {
  fecharEspecial(true); fecharRegistroView(); fecharLightbox(); fecharCaderno();
  estado.subs.forEach(u => u()); estado.subs = [];
  [estado.subPresencas, estado.subVoto, estado.subNotas].forEach(u => u && u());
  estado.subPresencas = estado.subVoto = estado.subNotas = null;
  estado.chavePres = estado.chaveVoto = estado.chaveNotas = null;
}

onAuthStateChanged(auth, async (user) => {
  pararTudo();
  if (!user) { estado.usuario = null; mostrar("login"); return; }
  mostrar("carregando");
  const u = usuarioDoEmail(user.email);
  const admin = isAdminEmail(user.email);
  estado.usuario = u; estado.admin = admin;
  try {
    const ref = doc(db, "membros", u);
    let snap = await getDoc(ref).catch(() => null);
    let m = snap && snap.exists() ? snap.data() : null;
    if (admin && (!m || m.uid !== user.uid)) {
      // Administradoras são criadas no console do Firebase; aqui o cadastro delas se completa sozinho.
      m = { nome: m?.nome || u[0].toUpperCase() + u.slice(1), uid: user.uid, papel: "admin", ativo: true, g: 1, trocarSenha: m?.trocarSenha ?? false };
      await setDoc(ref, m, { merge: true });
    }
    if (!m || m.uid !== user.uid || m.ativo === false) {
      await signOut(auth);
      $("#loginErro").textContent = "Este acesso não está ativo. Fale com a Taís.";
      return;
    }
    contextoCaderno({ usuario: u, admin, nomeDe: (x) => nomeDe(x) });
    $("#nomeTopo").textContent = m.nome;
    $("#nomeMenu").textContent = m.nome;
    $("#saudacao").textContent = `Que bom te ver por aqui, ${m.nome}.`;
    $("#linkPainel").hidden = !admin; $("#linkPainelTopo").hidden = !admin;
    if (m.trocarSenha) abrirTrocaSenha(false); else $("#modalSenha").hidden = true;
    mostrar("app");
    ouvir();
  } catch (err) {
    console.error(err);
    $("#loginErro").textContent = "Não foi possível abrir sua área agora. Tente de novo em instantes.";
    await signOut(auth);
  }
});

/* ---------------- dados ao vivo ---------------- */
function ouvir() {
  const falha = (e) => console.error(e);
  estado.subs.push(onSnapshot(collection(db, "membros"), s => {
    estado.membros = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); render();
  }, falha));
  estado.subs.push(onSnapshot(collection(db, "livros"), s => {
    estado.livros = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.titulo.localeCompare(b.titulo));
    render();
  }, falha));
  estado.subs.push(onSnapshot(query(collection(db, "encontros"), orderBy("data")), s => {
    estado.encontros = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
  }, falha));
  estado.subs.push(onSnapshot(query(collection(db, "especiais"), where("publicado", "==", true)), s => {
    estado.especiais = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    render();
  }, falha));
  estado.subs.push(onSnapshot(query(collection(db, "registros"), where("publicado", "==", true)), s => {
    estado.registros = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
  }, falha));
  estado.subs.push(onSnapshot(doc(db, "config", "clube"), s => {
    estado.clube = s.exists() ? s.data() : {}; render();
  }, falha));
}

const livroPorId = (id) => estado.livros.find(l => l.id === id);
const nomeDe = (u) => estado.membros[u]?.nome || u;
function proximoEncontro() { const h = hojeISO(); return estado.encontros.find(e => e.data >= h) || null; }
function encontrosPassados() { const h = hojeISO(); return estado.encontros.filter(e => e.data < h); }

// Inscrições que dependem de qual encontro / rodada / livro está em foco.
function ajustarInscricoes() {
  const prox = proximoEncontro();
  const chaveP = prox?.id || null;
  if (chaveP !== estado.chavePres) {
    estado.subPresencas && estado.subPresencas();
    estado.chavePres = chaveP; estado.presencas = []; estado.subPresencas = null;
    if (chaveP) estado.subPresencas = onSnapshot(collection(db, "encontros", chaveP, "presencas"),
      s => { estado.presencas = s.docs.map(d => ({ usuario: d.id, ...d.data() })); renderEncontro(); },
      e => console.error(e));
  }
  const v = estado.clube.votacao;
  const chaveV = v?.status === "aberta" ? v.rodada : null;
  if (chaveV !== estado.chaveVoto) {
    estado.subVoto && estado.subVoto();
    estado.chaveVoto = chaveV; estado.meuVoto = null; estado.subVoto = null;
    if (chaveV) estado.subVoto = onSnapshot(doc(db, "votos", chaveV, "v", estado.usuario),
      s => { estado.meuVoto = s.exists() ? s.data().livro : null; renderVotacao(); },
      () => { /* sem voto ainda */ });
  }
  const livro = livroDoMes();
  const chaveN = livro?.id || null;
  if (chaveN !== estado.chaveNotas) {
    estado.subNotas && estado.subNotas();
    estado.chaveNotas = chaveN; estado.notas = []; estado.subNotas = null;
    if (chaveN) estado.subNotas = onSnapshot(query(collection(db, "livros", chaveN, "notas"), orderBy("criadoEm", "desc")),
      s => { estado.notas = s.docs.map(d => ({ id: d.id, ...d.data() })); renderMural(); },
      e => console.error(e));
  }
}

function livroDoMes() {
  const prox = proximoEncontro();
  if (prox?.livroId) return livroPorId(prox.livroId) || null;
  return null;
}

function render() {
  if (!estado.usuario) return;
  ajustarInscricoes();
  renderEncontro(); renderVotacao(); renderLivroMes(); renderAcervo(); renderEspeciais(); renderCalendario(); renderEstante(); renderMemorias();
}

/* ---------------- encontro e presença ---------------- */
function renderEncontro() {
  const area = $("#encontroArea");
  const e = proximoEncontro();
  if (!e) {
    area.innerHTML = `<div class="urna"><h3>O próximo encontro ainda vai ser marcado</h3><p>Assim que a Taís definir a data, ela aparece aqui.</p></div>`;
    return;
  }
  const livro = e.livroId ? livroPorId(e.livroId) : null;
  const d = diasAte(e.data);
  const cont = d > 1 ? `<b>${d}</b> dias para o encontro` : d === 1 ? `<b>1</b> dia: é amanhã!` : `<b>Hoje</b>${e.hora ? " às " + esc(e.hora) : ""}`;
  const vao = estado.presencas.filter(p => p.modo === "presencial" || p.modo === "online");
  const minha = estado.presencas.find(p => p.usuario === estado.usuario);
  const mapa = e.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((e.local || "") + " " + e.endereco)}` : "";
  // Rascunho de quem está preenchendo agora não pode sumir com uma atualização ao vivo.
  const rascunho = document.activeElement?.id === "presLanche" ? $("#presLanche").value : null;
  area.innerHTML = `<div class="recanto">
    <div class="info">
      <p class="contagem">${cont}</p>
      <p class="data-grande">${esc(dataExtenso(e.data))}${e.hora ? `<br><span style="font-size:.7em;font-weight:500">às ${esc(e.hora)}</span>` : ""}</p>
      <dl class="det">
        <dt>Onde</dt><dd>${esc(e.local || "A definir")}${e.endereco ? `<br><span class="small">${esc(e.endereco)}</span>` : ""}</dd>
        ${e.titulo ? `<dt>Pauta</dt><dd>${esc(e.titulo)}</dd>` : ""}
        <dt>Livro</dt><dd>${livro ? `<a href="#livro">${esc(livro.titulo)}</a>, de ${esc(livro.autor)}` : "Será definido na votação"}</dd>
      </dl>
      ${mapa ? `<a class="btn" style="justify-self:start" href="${mapa}" target="_blank" rel="noopener">Ver no mapa ↗</a>` : ""}
    </div>
    <div style="display:grid;gap:20px;align-content:start">
      <form id="formPresenca">
        <fieldset><legend>Você vai?</legend>
          <div class="radios">
            <label><input type="radio" name="modo" value="presencial" ${minha?.modo === "presencial" ? "checked" : ""} required> Presencial</label>
            <label><input type="radio" name="modo" value="online" ${minha?.modo === "online" ? "checked" : ""}> Online</label>
            <label><input type="radio" name="modo" value="nao" ${minha?.modo === "nao" ? "checked" : ""}> Não poderei</label>
          </div></fieldset>
        <div class="field"><label for="presLanche">Vou levar para o lanche (opcional)</label>
          <input type="text" id="presLanche" maxlength="60" placeholder="Bolo de laranja, pão de queijo…" value="${esc(minha?.lanche || "")}"></div>
        <button class="btn solid" type="submit">${minha ? "Atualizar minha resposta" : "Confirmar"}</button>
        <p class="ok" id="presOk" role="status"></p>
      </form>
      <div style="display:grid;gap:8px">
        <span class="label">${vao.length} confirmada${vao.length === 1 ? "" : "s"} · ${Math.max(0, VAGAS - vao.length)} vagas livres</span>
        <div class="vagas" aria-hidden="true">${Array.from({ length: VAGAS }, (_, i) => `<i class="${i < vao.length ? "on" : ""}"></i>`).join("")}</div>
        <div class="pessoas">${vao.length ? vao.map(p => `<span class="pessoa">${esc(nomeDe(p.usuario))}<small>${p.modo === "online" ? "online" : "presencial"}${p.lanche ? " · " + esc(p.lanche) : ""}</small></span>`).join("") : `<p class="vazio">Ninguém confirmou ainda. Que tal ser a primeira?</p>`}</div>
      </div>
    </div></div>`;
  if (rascunho !== null) { const i = $("#presLanche"); i.value = rascunho; i.focus(); }
  $("#formPresenca").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const modo = ev.target.querySelector("input[name=modo]:checked")?.value;
    if (!modo) return;
    if (modo !== "nao" && !minha?.modo?.match(/presencial|online/) && vao.length >= VAGAS) {
      $("#presOk").textContent = "As 15 vagas estão preenchidas. Fale com a Taís para entrar na lista de espera."; return;
    }
    try {
      await setDoc(doc(db, "encontros", e.id, "presencas", estado.usuario),
        { modo, lanche: modo === "presencial" ? $("#presLanche").value.trim().slice(0, 60) : "", em: serverTimestamp() });
      const ok = $("#presOk"); if (ok) ok.textContent = modo === "nao" ? "Anotado. Vamos sentir sua falta!" : "Presença confirmada!";
    } catch (err) { console.error(err); const ok = $("#presOk"); if (ok) ok.textContent = "Não foi possível salvar. Tente de novo."; }
  });
}

/* ---------------- votação ---------------- */
function cardLivro(l, extra = "", cls = "") {
  return `<article class="cand ${cls}">${extra}
    ${capaHTML(l)}
    <div><p class="label" style="font-size:11px">${esc(l.meta || "")}</p><h3>${esc(l.titulo)}</h3><p class="aut">${esc(l.autor)}</p>
    ${l.chamada ? `<p class="chamada">${esc(l.chamada)}</p>` : ""}${l.aviso ? `<p class="aviso">aviso: ${esc(l.aviso)}</p>` : ""}
    <span data-slot></span></div></article>`;
}
function renderVotacao() {
  const area = $("#votacaoArea");
  const v = estado.clube.votacao;
  const enc = v?.encontroId ? estado.encontros.find(e => e.id === v.encontroId) : null;
  const para = enc ? `para o encontro de ${dataCurta(enc.data)}` : "";
  if (!v || !v.status || v.status === "preparando") {
    area.innerHTML = `<div class="urna"><h3>A Taís está escolhendo as opções</h3><p>Quando a votação abrir, os livros aparecem aqui.</p></div>`;
    return;
  }
  if (v.status === "aberta") {
    const cands = (v.candidatos || []).map(livroPorId).filter(Boolean);
    area.innerHTML = `<p class="small" style="margin-bottom:16px">Votação aberta ${esc(para)}. Você pode mudar seu voto até a Taís encerrar.</p>
      <div class="candidatos">${cands.map(l => {
        const meu = estado.meuVoto === l.id;
        return cardLivro(l, meu ? `<span class="fita rosa">Seu voto</span>` : "", meu ? "meu" : "")
          .replace("<span data-slot></span>", meu ? `<p class="ok">Você votou neste livro.</p>` : `<button class="btn solid mini" type="button" data-votar="${esc(l.id)}" style="justify-self:start;margin-top:6px">Votar neste</button>`);
      }).join("")}</div><p class="erro" id="votoErro" role="alert" style="margin-top:12px"></p>`;
    area.querySelectorAll("[data-votar]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true;
      try { await setDoc(doc(db, "votos", v.rodada, "v", estado.usuario), { livro: b.dataset.votar, em: serverTimestamp() }); }
      catch (err) { console.error(err); $("#votoErro").textContent = "Não foi possível registrar o voto. A votação pode ter sido encerrada."; b.disabled = false; }
    }));
    return;
  }
  if (v.status === "revelada") {
    const venc = livroPorId(v.vencedor);
    const cont = v.contagem || {};
    const outros = (v.candidatos || []).filter(id => id !== v.vencedor).map(livroPorId).filter(Boolean);
    area.innerHTML = venc ? `<div class="candidatos">${cardLivro(venc, `<span class="fita">Livro escolhido</span>`, "venceu")
        .replace("<span data-slot></span>", `<p class="small">${cont[venc.id] || 0} voto${cont[venc.id] === 1 ? "" : "s"} ${esc(para)}</p>`)}</div>
      ${outros.length ? `<p class="small" style="margin-top:14px">Também concorreram: ${outros.map(l => `${esc(l.titulo)} (${cont[l.id] || 0})`).join(" · ")}. Eles voltam para o acervo.</p>` : ""}`
      : `<div class="urna"><h3>Resultado revelado</h3></div>`;
  }
}

/* ---------------- livro do mês + mural ---------------- */
function renderLivroMes() {
  const area = $("#livroMesArea");
  const l = livroDoMes();
  if (!l) {
    $("#livroMesTitulo").textContent = "Leitura em andamento";
    area.innerHTML = `<div class="urna"><h3>O livro do próximo encontro sai na votação</h3><p>Depois da revelação, ele aparece aqui com o link de compra e o mural de comentários.</p></div>`;
    return;
  }
  const prox = proximoEncontro();
  $("#livroMesTitulo").textContent = `Para ${dataCurta(prox.data)}`;
  if (!area.querySelector(`[data-livro="${l.id}"]`)) {
    area.innerHTML = `<div data-livro="${esc(l.id)}">
      <div class="livro-mes">
        <div class="capa-col">${capaHTML(l)}</div>
        <div>
          <p class="label">${esc(l.meta || "")}</p>
          <h3>${esc(l.titulo)}</h3>
          <p style="font-family:var(--f-type);font-size:14px;color:var(--ink-soft)">${esc(l.autor)}</p>
          ${l.chamada ? `<p class="chamada" style="font-family:var(--f-display);font-style:italic;font-size:21px;color:var(--rose-ink)">${esc(l.chamada)}</p>` : ""}
          ${l.aviso ? `<p class="aviso">aviso: ${esc(l.aviso)}</p>` : ""}
          <p style="max-width:62ch">${esc(l.sinopse || "")}</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${l.compra ? `<a class="btn solid" href="${esc(l.compra)}" target="_blank" rel="noopener">Comprar o livro ↗</a>` : ""}
            <a class="btn" href="https://www.estantevirtual.com.br/busca?q=${encodeURIComponent(l.titulo)}" target="_blank" rel="noopener">Procurar em sebos ↗</a>
          </div>
        </div>
      </div>
      <div class="mural-grid">
        <form class="form-nota" id="formNota">
          <h3 style="font-size:24px;font-weight:500">Mural do livro</h3>
          <fieldset><legend>Tipo</legend><div class="radios">
            <label><input type="radio" name="tipo" value="imp" checked> Impressão</label>
            <label><input type="radio" name="tipo" value="cit"> Citação</label></div></fieldset>
          <div class="field"><label for="notaTrecho">Fala de qual trecho?</label>
            <select id="notaTrecho">${TRECHOS.map((t, i) => `<option value="${i}">${t}</option>`).join("")}</select></div>
          <div class="field"><label for="notaTxt">Sua nota</label>
            <textarea id="notaTxt" rows="4" maxlength="600" required placeholder="Uma frase que ficou, uma cena, uma pergunta…"></textarea></div>
          <button class="btn solid" type="submit">Colar no mural</button>
          <p class="erro" id="notaErro" role="alert"></p>
        </form>
        <div>
          <div class="onde"><label class="label" for="ondeEstou">Onde estou</label>
            <select id="ondeEstou"><option value="0">Ainda não comecei</option><option value="1">Estou na metade</option><option value="2">Terminei o livro</option></select></div>
          <div class="pautado"><ul class="notas" id="notas"></ul></div>
        </div>
      </div></div>`;
    let onde = "0"; try { onde = localStorage.getItem("refugio-onde-" + l.id) || "0"; } catch (e) {}
    $("#ondeEstou").value = onde;
    $("#ondeEstou").addEventListener("change", (e) => { try { localStorage.setItem("refugio-onde-" + l.id, e.target.value); } catch (err) {} renderMural(); });
    $("#formNota").addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = $("#notaTxt").value.trim(); if (!texto) return;
      $("#notaErro").textContent = "";
      try {
        await addDoc(collection(db, "livros", l.id, "notas"), {
          autor: estado.usuario, texto: texto.slice(0, 600),
          tipo: e.target.querySelector("input[name=tipo]:checked").value,
          trecho: Number($("#notaTrecho").value), criadoEm: serverTimestamp()
        });
        $("#notaTxt").value = "";
      } catch (err) { console.error(err); $("#notaErro").textContent = "Não foi possível publicar. Tente de novo."; }
    });
    renderMural();
  }
}

const reveladas = new Set();
function renderMural() {
  const ul = $("#notas"); if (!ul) return;
  const onde = Number($("#ondeEstou")?.value || 0);
  if (!estado.notas.length) { ul.innerHTML = `<li class="nota vazio">Ninguém escreveu ainda. Deixe a primeira impressão.</li>`; return; }
  ul.innerHTML = estado.notas.map(n => {
    const oculta = (n.trecho || 0) > onde && !reveladas.has(n.id) && n.autor !== estado.usuario;
    const podeApagar = n.autor === estado.usuario || estado.admin;
    return `<li class="nota ${n.tipo === "cit" ? "cit" : ""} ${oculta ? "oculta" : ""}">
      <div class="quem"><b>${esc(nomeDe(n.autor))}</b> · ${TRECHOS[n.trecho || 0]}
        ${oculta ? `<button class="revelar" type="button" data-rev="${esc(n.id)}">mostrar spoiler</button>` : ""}
        ${podeApagar ? `<button class="revelar" type="button" data-apagar="${esc(n.id)}">apagar</button>` : ""}</div>
      <div class="txt">${esc(n.texto)}</div></li>`;
  }).join("");
}
document.addEventListener("click", async (e) => {
  const r = e.target.closest("[data-rev]");
  if (r) { reveladas.add(r.dataset.rev); renderMural(); return; }
  const a = e.target.closest("[data-apagar]");
  if (a) {
    if (a.dataset.confirma !== "1") { a.dataset.confirma = "1"; a.textContent = "confirmar?"; return; }
    try { await deleteDoc(doc(db, "livros", estado.chaveNotas, "notas", a.dataset.apagar)); } catch (err) { console.error(err); }
  }
});

/* ---------------- acervo ---------------- */
const FILTROS = [
  { id: "todos", nome: "Todos", f: () => true },
  { id: "br", nome: "Brasil", f: l => l.brasil },
  { id: "mundo", nome: "Outros países", f: l => !l.brasil },
  { id: "mulheres", nome: "Escritoras", f: l => l.escritora }
];
$("#filtros").addEventListener("click", (e) => {
  const b = e.target.closest(".filtro"); if (!b) return;
  estado.filtro = b.dataset.f;
  try { localStorage.setItem("refugio-filtro", estado.filtro); } catch (err) {}
  renderAcervo();
});
function renderAcervo() {
  if (!FILTROS.some(f => f.id === estado.filtro)) estado.filtro = "todos";
  $("#filtros").innerHTML = FILTROS.map(x => `<button class="filtro" type="button" data-f="${x.id}" aria-pressed="${x.id === estado.filtro}">${x.nome}<span>${estado.livros.filter(x.f).length}</span></button>`).join("");
  const lidos = new Map(encontrosPassados().filter(e => e.livroId).map(e => [e.livroId, e.data]));
  const mes = livroDoMes()?.id;
  const v = estado.clube.votacao;
  const lista = estado.livros.filter(FILTROS.find(f => f.id === estado.filtro).f);
  $("#acervoGrid").innerHTML = lista.length ? lista.map(l => {
    let selo = "";
    if (lidos.has(l.id)) selo = `<span class="selo">lido · ${dataCurta(lidos.get(l.id))}</span>`;
    else if (mes === l.id) selo = `<span class="selo esc">livro do mês</span>`;
    else if (v?.status === "aberta" && v.candidatos?.includes(l.id)) selo = `<span class="selo esc">em votação</span>`;
    return `<article class="livro">
      <div class="capa-box">${capaHTML(l)}${selo}</div>
      <p class="meta">${esc(l.meta || "")}</p><h3>${esc(l.titulo)}</h3><p class="aut">${esc(l.autor)}</p>
      ${l.chamada ? `<p class="chamada">${esc(l.chamada)}</p>` : ""}
      ${l.aviso ? `<span class="aviso">aviso: ${esc(l.aviso)}</span>` : ""}
      ${l.sinopse ? `<details><summary>sinopse</summary><p>${esc(l.sinopse)}</p></details>` : ""}
    </article>`;
  }).join("") : `<p class="vazio">O acervo ainda está vazio.</p>`;
}

/* ---------------- calendário e estante ---------------- */
function renderCalendario() {
  const prox = proximoEncontro();
  const h = hojeISO();
  $("#cal").innerHTML = estado.encontros.length ? estado.encontros.map(e => {
    const l = e.livroId ? livroPorId(e.livroId) : null;
    const d = parseData(e.data);
    const cls = e.id === prox?.id ? "proximo" : e.data < h ? "passado" : "";
    return `<div class="slot ${cls}">
      <span class="small" style="font-family:var(--f-type)">${d.getFullYear()}</span>
      <span class="m">${MESES_CAP[d.getMonth()]}</span>
      <span class="when">${dataCurta(e.data)}${e.hora ? " · " + esc(e.hora) : ""}${e.local ? " · " + esc(e.local) : ""}</span>
      ${l ? `<div style="display:flex;gap:10px;align-items:flex-start">${l.capa || l.capaDb ? capaHTML(l) : ""}<span style="font-family:var(--f-display);font-size:17px;line-height:1.2">${esc(l.titulo)}</span></div>`
          : `<span class="small">${esc(e.titulo || "Livro escolhido na votação")}</span>`}
    </div>`;
  }).join("") : `<p class="vazio">As datas ainda vão ser combinadas.</p>`;
}

function renderEstante() {
  const prox = proximoEncontro();
  const h = hojeISO();
  const comLivro = estado.encontros.filter(e => e.livroId && (e.data < h || e.id === prox?.id));
  const alturas = [176, 150, 190, 160, 184, 142, 170, 188, 156, 178, 148, 168];
  const total = Math.max(12, comLivro.length + 2);
  let html = planta("l");
  for (let i = 0; i < total; i++) {
    const e = comLivro[i];
    const l = e ? livroPorId(e.livroId) : null;
    const cls = e ? (e.data < h ? "lida" : "lendo") : "";
    const mes = e ? MESES_CAP[parseData(e.data).getMonth()].slice(0, 3).toLowerCase() : "";
    html += `<div class="lombada ${cls}" style="height:${alturas[i % 12]}px" title="${esc(l?.titulo || "Ainda por vir")}">${l ? `<span class="t">${esc(l.titulo)}</span>` : ""}<span class="mes">${mes}</span></div>`;
  }
  $("#prateleira").innerHTML = html + planta("r");
}

/* ---------------- especiais ---------------- */
const fotoDe = (e) => ({ id: "esp_" + e.id, titulo: e.titulo, capaDb: e.fotoDb, capaV: e.fotoV, capa: e.fotoUrl || "" });
function renderEspeciais() {
  const tem = estado.especiais.length > 0;
  $("#especiaisBloco").hidden = !tem;
  $("#linkEspeciais").hidden = !tem;
  $("#espGrid").innerHTML = estado.especiais.map(e => e.formato === "caderno" ? cardCaderno(e, !!e.fotoDb, capaHTML(fotoDe(e))) : `
    <a class="esp-card" href="#esp-${esc(e.id)}">
      <div class="esp-foto">${e.fotoDb || e.fotoUrl ? capaHTML(fotoDe(e)) : `<div class="sem-capa">${esc(e.autor || e.titulo)}</div>`}</div>
      <div class="esp-txt"><span class="label">Especial</span><h3>${esc(e.titulo)}</h3>${e.chamada ? `<p>${esc(e.chamada)}</p>` : ""}<span class="esp-ler">Ler o especial →</span></div>
    </a>`).join("");
  pintarCartoes($("#espGrid"));
  abrirPeloEndereco();
  abrirCadernoPeloEndereco(estado.especiais);
}

function linhas(txt) { return String(txt || "").split("\n").map(l => l.trim()).filter(Boolean); }
function abrirPeloEndereco() {
  const m = location.hash.match(/^#esp-(.+)$/);
  const e = m ? estado.especiais.find(x => x.id === decodeURIComponent(m[1])) : null;
  if (e) abrirEspecial(e); else fecharEspecial(true);
}
window.addEventListener("hashchange", () => { if (estado.usuario) { abrirPeloEndereco(); abrirRegistroPeloEndereco(); abrirCadernoPeloEndereco(estado.especiais); } });

function abrirEspecial(e) {
  const v = $("#espView");
  const lidos = new Set(encontrosPassados().filter(x => x.livroId).map(x => x.livroId));
  const livros = (e.livros || []).map(livroPorId).filter(Boolean);
  const tempo = linhas(e.linhaTempo).map(l => { const i = l.search(/\s[—–-]\s|:\s/); return i > 0 ? [l.slice(0, i).trim(), l.slice(i).replace(/^\s*[—–:-]\s*/, "")] : ["", l]; });
  const curios = linhas(e.curiosidades);
  const links = linhas(e.links).map(l => { const [rot, url] = l.includes("|") ? l.split("|").map(x => x.trim()) : [l, l]; return { rot, url }; })
    .filter(x => /^https?:\/\//.test(x.url));
  v.innerHTML = `<div class="wrap esp-artigo">
    <button class="btn mini" type="button" id="espFechar">← Voltar ao site</button>
    <header class="esp-cabeca">
      <div class="esp-foto grande">${e.fotoDb || e.fotoUrl ? capaHTML(fotoDe(e)) : ""}</div>
      <div>
        <p class="esp-script">Especial</p>
        <h1 id="espTitulo">${esc(e.titulo)}</h1>
        ${e.autor ? `<p class="label">${esc(e.autor)}</p>` : ""}
        ${e.chamada ? `<p class="esp-chamada">${esc(e.chamada)}</p>` : ""}
      </div>
    </header>
    ${e.bio ? `<section class="esp-bloco"><h2>Quem é</h2>${linhas(e.bio).map(p => `<p>${esc(p)}</p>`).join("")}</section>` : ""}
    ${tempo.length ? `<section class="esp-bloco"><h2>Linha do tempo</h2><ol class="tempo">${tempo.map(([a, t]) => `<li><span class="ano">${esc(a)}</span><span>${esc(t)}</span></li>`).join("")}</ol></section>` : ""}
    ${livros.length ? `<section class="esp-bloco"><h2>No nosso acervo</h2><div class="esp-livros">${livros.map(l => `
        <div class="livro"><div class="capa-box">${capaHTML(l)}${lidos.has(l.id) ? `<span class="selo">lido pelo clube</span>` : ""}</div>
        <h3>${esc(l.titulo)}</h3>${l.chamada ? `<p class="chamada">${esc(l.chamada)}</p>` : ""}</div>`).join("")}</div></section>` : ""}
    ${curios.length ? `<section class="esp-bloco"><h2>Curiosidades</h2><ul class="curios">${curios.map(c => `<li>${esc(c)}</li>`).join("")}</ul></section>` : ""}
    ${links.length ? `<section class="esp-bloco"><h2>Para ir além</h2><ul class="esp-links">${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.rot)} ↗</a></li>`).join("")}</ul></section>` : ""}
    <p class="small" style="margin-top:40px">Especial preparado por Taís Rick para o Refúgio das Páginas.</p>
  </div>`;
  const novo = v.hidden || v.dataset.id !== e.id;
  v.dataset.id = e.id; v.hidden = false; document.body.style.overflow = "hidden";
  if (novo) v.scrollTop = 0;
  $("#espFechar").addEventListener("click", () => { location.hash = "especiais"; });
}
function fecharEspecial(silencioso) {
  const v = $("#espView"); if (!v || v.hidden) return;
  v.hidden = true; v.innerHTML = ""; delete v.dataset.id; document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#espView").hidden) location.hash = "especiais"; });

/* ---------------- memórias: registro dos encontros ---------------- */
const miniCache = new Map();
async function miniDaFoto(id) {
  if (!id) return null;
  if (!miniCache.has(id)) miniCache.set(id, getDoc(doc(db, "fotos", id)).then(s => s.exists() ? s.data().mini : null).catch(() => null));
  return miniCache.get(id);
}
function registrosOrdenados() {
  return estado.registros.map(r => ({ r, e: estado.encontros.find(x => x.id === r.id) }))
    .filter(x => x.e).sort((a, b) => b.e.data.localeCompare(a.e.data));
}
function renderMemorias() {
  const lista = registrosOrdenados();
  $("#memoriasBloco").hidden = !lista.length;
  $("#linkMemorias").hidden = !lista.length;
  const grid = $("#memGrid");
  const chave = lista.map(x => x.r.id + ":" + (x.r.capa || "") + ":" + (x.r.atualizadoEm || "") + ":" + (x.e.livroId || "")).join("|");
  if (grid.dataset.chave === chave) { abrirRegistroPeloEndereco(); return; }
  grid.dataset.chave = chave;
  grid.innerHTML = lista.map(({ r, e }) => {
    const d = parseData(e.data), l = e.livroId ? livroPorId(e.livroId) : null;
    return `<a class="mem-card" href="#reg-${esc(r.id)}">
      <div class="mem-foto" data-capa-foto="${esc(r.capa || "")}">${r.capa ? "" : `<span class="mem-sem">sem fotos</span>`}</div>
      <div class="mem-txt">
        <span class="mem-mes">${MESES_CAP[d.getMonth()]}</span>
        <span class="label">${dataCurta(e.data)} ${d.getFullYear()}${e.local ? " · " + esc(e.local) : ""}</span>
        <h3>${l ? esc(l.titulo) : esc(e.titulo || "Encontro")}</h3>
        ${r.frase ? `<p class="mem-frase">“${esc(r.frase)}”</p>` : ""}
      </div></a>`;
  }).join("");
  grid.querySelectorAll("[data-capa-foto]").forEach(async el => {
    const mini = await miniDaFoto(el.dataset.capaFoto);
    if (mini) el.innerHTML = `<img src="${mini}" alt="">`;
  });
  abrirRegistroPeloEndereco();
}

const lb = { fotos: [], i: 0, grandes: new Map() };
function abrirRegistroPeloEndereco() {
  const m = location.hash.match(/^#reg-(.+)$/);
  const id = m ? decodeURIComponent(m[1]) : null;
  const x = id ? registrosOrdenados().find(y => y.r.id === id) : null;
  if (x) abrirRegistroView(x.r, x.e); else fecharRegistroView();
}
async function abrirRegistroView(r, e) {
  const v = $("#regView");
  const assinatura = r.id + ":" + (r.atualizadoEm || "");
  if (!v.hidden && v.dataset.assinatura === assinatura) return;
  const novo = v.hidden || v.dataset.id !== r.id;
  v.dataset.id = r.id; v.dataset.assinatura = assinatura;
  const d = parseData(e.data), l = e.livroId ? livroPorId(e.livroId) : null;
  const estrelas = r.nota != null ? `<p class="mem-nota" aria-label="Nota média ${String(r.nota).replace(".", ",")} de 5">${"★".repeat(Math.floor(r.nota))}${"☆".repeat(5 - Math.floor(r.nota))} <span>${String(r.nota).replace(".", ",")} de 5</span></p>` : "";
  v.innerHTML = `<div class="wrap esp-artigo">
    <button class="btn mini" type="button" id="regFechar">← Voltar ao site</button>
    <header class="reg-cabeca">
      <p class="esp-script">${MESES_CAP[d.getMonth()]} de ${d.getFullYear()}</p>
      <h1 id="regTitulo">${l ? esc(l.titulo) : esc(e.titulo || "Nosso encontro")}</h1>
      <p class="label">${esc(dataExtenso(e.data))}${e.local ? " · " + esc(e.local) : ""}</p>
      ${estrelas}
    </header>
    ${l ? `<div class="reg-livro">${capaHTML(l)}<div><span class="label">Livro do encontro</span><p style="font-family:var(--f-display);font-size:22px">${esc(l.titulo)}</p><p class="small">${esc(l.autor)}</p></div></div>` : ""}
    ${r.texto ? `<section class="esp-bloco">${linhas(r.texto).map(p => `<p>${esc(p)}</p>`).join("")}</section>` : ""}
    ${r.frase ? `<blockquote class="reg-frase"><span class="label">Frase da noite</span><p>“${esc(r.frase)}”</p></blockquote>` : ""}
    <section class="esp-bloco" id="regGaleriaBloco" hidden><h2>Fotos</h2><div class="galeria" id="regGaleria"></div></section>
  </div>`;
  v.hidden = false; document.body.style.overflow = "hidden";
  if (novo) v.scrollTop = 0;
  $("#regFechar").addEventListener("click", () => { location.hash = "memorias"; });
  try {
    const s = await getDocs(query(collection(db, "fotos"), where("encontro", "==", r.id)));
    if (v.dataset.id !== r.id) return;
    lb.fotos = s.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    $("#regGaleriaBloco").hidden = !lb.fotos.length;
    $("#regGaleria").innerHTML = lb.fotos.map((f, i) => `<button type="button" class="gal-item" data-foto="${i}" aria-label="Ampliar foto ${i + 1}${f.legenda ? ": " + esc(f.legenda) : ""}"><img src="${f.mini}" alt="" loading="lazy"></button>`).join("");
    $("#regGaleria").addEventListener("click", (ev) => { const b = ev.target.closest("[data-foto]"); if (b) abrirLightbox(Number(b.dataset.foto)); });
  } catch (err) { console.error(err); }
}
function fecharRegistroView() {
  const v = $("#regView"); if (!v || v.hidden) return;
  v.hidden = true; v.innerHTML = ""; delete v.dataset.id; delete v.dataset.assinatura;
  if ($("#espView").hidden) document.body.style.overflow = "";
}
async function mostrarFoto() {
  const f = lb.fotos[lb.i]; if (!f) return;
  const img = $("#lbImg");
  img.src = lb.grandes.get(f.id) || f.mini;
  $("#lbLegenda").textContent = f.legenda || "";
  $("#lbConta").textContent = `${lb.i + 1} de ${lb.fotos.length}`;
  $("#lbAnt").hidden = lb.i === 0; $("#lbProx").hidden = lb.i === lb.fotos.length - 1;
  if (!lb.grandes.has(f.id)) {
    try {
      const g = await getDoc(doc(db, "fotosGrandes", f.id));
      if (g.exists()) { lb.grandes.set(f.id, g.data().img); if (lb.fotos[lb.i]?.id === f.id) img.src = g.data().img; }
    } catch (err) { console.error(err); }
  }
}
function abrirLightbox(i) { lb.i = i; $("#lightbox").hidden = false; mostrarFoto(); $("#lbFechar").focus(); }
function fecharLightbox() { const l = $("#lightbox"); if (l) l.hidden = true; }
function passarFoto(d) { const n = lb.i + d; if (n >= 0 && n < lb.fotos.length) { lb.i = n; mostrarFoto(); } }
$("#lbFechar").addEventListener("click", fecharLightbox);
$("#lbAnt").addEventListener("click", () => passarFoto(-1));
$("#lbProx").addEventListener("click", () => passarFoto(1));
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") fecharLightbox(); });
let toqueX = null;
$("#lightbox").addEventListener("touchstart", (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
$("#lightbox").addEventListener("touchend", (e) => {
  if (toqueX === null) return; const dx = e.changedTouches[0].clientX - toqueX; toqueX = null;
  if (Math.abs(dx) > 50) passarFoto(dx < 0 ? 1 : -1);
});
document.addEventListener("keydown", (e) => {
  if (!$("#lightbox").hidden) {
    if (e.key === "Escape") { fecharLightbox(); e.stopImmediatePropagation(); }
    else if (e.key === "ArrowRight") passarFoto(1);
    else if (e.key === "ArrowLeft") passarFoto(-1);
    return;
  }
  if (e.key === "Escape" && !$("#regView").hidden) location.hash = "memorias";
  else if (e.key === "Escape" && !$("#cadView").hidden) location.hash = "especiais";
}, true);
