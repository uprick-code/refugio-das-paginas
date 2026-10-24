// Conexão com o Firebase e funções comuns às duas páginas.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCINEvNwtlj20R0fwxQAmPydKJrEyxg4hI",
  authDomain: "refugio-das-paginas.firebaseapp.com",
  projectId: "refugio-das-paginas",
  storageBucket: "refugio-das-paginas.firebasestorage.app",
  messagingSenderId: "139871450623",
  appId: "1:139871450623:web:f00355af5cb2a458eea3ca"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// As leitoras entram só com usuário e senha. Por baixo, o Firebase precisa de um e-mail,
// então cada usuário vira "<usuario>.<geração>@<DOMINIO>" — um endereço interno que nunca recebe mensagens.
// A "geração" muda quando a Taís gera uma senha nova (veja admin.js).
export const DOMINIO = "refugio-das-paginas.firebaseapp.com";
// Quem administra o clube. Precisa ser igual à lista em firestore.rules.
export const ADMINS = ["tais", "rick"];

export const emailDe = (usuario, geracao = 1) => `${usuario}.${geracao}@${DOMINIO}`;
export const usuarioDoEmail = (email) => (email || "").split("@")[0].split(".")[0];
export const isAdminEmail = (email) => ADMINS.some(u => email === emailDe(u, 1));

export const normalizaUsuario = (s) => (s || "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]/g, "");

export async function entrar(usuarioDigitado, senha) {
  const usuario = normalizaUsuario(usuarioDigitado);
  if (!usuario) throw new Error("Digite seu usuário.");
  let geracao = 1;
  try {
    const l = await getDoc(doc(db, "logins", usuario));
    if (l.exists() && l.data().g) geracao = l.data().g;
  } catch (e) { /* sem registro: primeira geração */ }
  try {
    return await signInWithEmailAndPassword(auth, emailDe(usuario, geracao), senha);
  } catch (e) {
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(e.code))
      throw new Error("Usuário ou senha não conferem. Confira com a Taís se precisar de uma senha nova.");
    if (e.code === "auth/too-many-requests")
      throw new Error("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    if (e.code === "auth/network-request-failed")
      throw new Error("Sem conexão com a internet. Confira sua rede e tente de novo.");
    throw new Error("Não foi possível entrar agora. Tente de novo em instantes.");
  }
}

// "atual" é pedida quando a troca é voluntária: o Firebase exige confirmar a senha antes de mudá-la.
export async function trocarSenha(nova, atual) {
  if (!nova || nova.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  try {
    if (atual !== undefined) {
      try { await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, atual)); }
      catch (e) {
        if (e.code === "auth/too-many-requests") throw new Error("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
        throw new Error("A senha atual não confere.");
      }
    }
    await updatePassword(auth.currentUser, nova);
  }
  catch (e) {
    if (!e.code) throw e;
    if (e.code === "auth/requires-recent-login") throw new Error("Por segurança, saia e entre de novo antes de trocar a senha.");
    if (e.code === "auth/weak-password") throw new Error("Essa senha é fraca demais. Use pelo menos 6 caracteres.");
    throw new Error("Não foi possível trocar a senha agora. Tente de novo.");
  }
}

export { onAuthStateChanged, signOut };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Datas: encontros guardam "AAAA-MM-DD" e "HH:MM" (horário de Brasília).
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
export const MESES_CAP = MESES.map(m => m[0].toUpperCase() + m.slice(1));
export function parseData(iso) { const [a, m, d] = (iso || "").split("-").map(Number); return new Date(a, (m || 1) - 1, d || 1); }
export function dataExtenso(iso) {
  const d = parseData(iso);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase() + dia.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
export function dataCurta(iso) { const d = parseData(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; }
export function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function diasAte(iso) {
  const h = new Date(); const hoje = new Date(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((parseData(iso) - hoje) / 864e5);
}

// Capas: ou um link/arquivo do site (campo "capa"), ou uma imagem enviada pelo painel,
// guardada à parte na coleção "capas" (campo "capaDb") e carregada só quando aparece na tela.
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const cacheCapas = new Map();
export function capaHTML(livro, cls = "") {
  const alt = `Capa de ${esc(livro.titulo)}`;
  if (livro.capaDb) {
    const chave = `${livro.id}:${livro.capaV || 0}`;
    const pronta = cacheCapas.get(chave);
    return `<img class="capa-db ${cls}" src="${pronta || PIXEL}" alt="${alt}" ${pronta ? "" : `data-capadb="${esc(livro.id)}" data-chave="${esc(chave)}"`}>`;
  }
  return livro.capa
    ? `<img class="${cls}" src="${esc(livro.capa)}" alt="${alt}" loading="lazy">`
    : `<div class="sem-capa ${cls}">${esc(livro.titulo)}</div>`;
}
export function guardarCapaNoCache(livroId, capaV, img) { cacheCapas.set(`${livroId}:${capaV || 0}`, img); }

const observador = "IntersectionObserver" in window ? new IntersectionObserver((itens) => {
  itens.forEach(i => { if (i.isIntersecting) { observador.unobserve(i.target); baixarCapa(i.target); } });
}, { rootMargin: "300px" }) : null;
const pedidos = new Map();
async function baixarCapa(img) {
  const id = img.dataset.capadb, chave = img.dataset.chave;
  if (!id) return;
  if (!pedidos.has(chave)) pedidos.set(chave, getDoc(doc(db, "capas", id)).then(s => {
    const dado = s.exists() ? s.data().img : null;
    if (dado) cacheCapas.set(chave, dado);
    return dado;
  }).catch(() => null));
  const dado = await pedidos.get(chave);
  if (dado) { img.src = dado; img.removeAttribute("data-capadb"); }
}
// Chamar depois de cada atualização da tela.
export function carregarCapas(raiz = document) {
  raiz.querySelectorAll("img[data-capadb]").forEach(img => {
    if (img.dataset.obs) return;
    img.dataset.obs = "1";
    observador ? observador.observe(img) : baixarCapa(img);
  });
}

// Reduz uma imagem escolhida no aparelho para o tamanho de capa (até 300 × 450) e devolve um JPEG em texto.
export async function prepararCapa(arquivo) {
  if (!arquivo || !arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (JPG ou PNG).");
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const escala = Math.min(1, 300 / imagem.naturalWidth, 450 / imagem.naturalHeight);
    const w = Math.max(1, Math.round(imagem.naturalWidth * escala)), h = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(imagem, 0, 0, w, h);
    let q = 0.85, dado = c.toDataURL("image/jpeg", q);
    while (dado.length > 200000 && q > 0.4) { q -= 0.1; dado = c.toDataURL("image/jpeg", q); }
    return dado;
  } catch (e) {
    throw new Error("Não foi possível ler essa imagem. Tente um print da capa ou um arquivo JPG/PNG.");
  } finally { URL.revokeObjectURL(url); }
}

export function ligarTema(botao) {
  try { const t = localStorage.getItem("refugio-tema"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  botao?.addEventListener("click", () => {
    const r = document.documentElement;
    const escuro = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = escuro ? "light" : "dark";
    try { localStorage.setItem("refugio-tema", r.dataset.theme); } catch (e) {}
  });
}

// Sempre que a tela muda, procura capas novas para carregar.
new MutationObserver(() => carregarCapas()).observe(document.body, { childList: true, subtree: true });
