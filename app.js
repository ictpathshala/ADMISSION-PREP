import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, deleteDoc, collection, getDocs,
  query, where, serverTimestamp, writeBatch, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS, APP_NAME } from "./firebase-config.js";

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ============================================================
   Constants & state
   ============================================================ */
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  bangla: svg('<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5z"/><path d="M7 8h2.5M7 11h2.5M14.5 8H17M14.5 11H17"/>'),
  english: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>'),
  accounting: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3" rx=".5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>'),
  management: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'),
  "business-org": svg('<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M3 21h18"/><path d="M8 8h2M8 12h2M8 16h2"/>'),
  finance: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/><path d="M16 8h3v3"/>'),
  "banking-insurance": svg('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>'),
};
const SUBJECTS = [
  { id: "bangla", name: "বাংলা", en: "Bangla" },
  { id: "english", name: "ইংলিশ", en: "English" },
  { id: "accounting", name: "হিসাববিজ্ঞান", en: "Accounting" },
  { id: "management", name: "ব্যবস্থাপনা", en: "Management" },
  { id: "business-org", name: "ব্যবসায় সংগঠন", en: "Business Organization" },
  { id: "finance", name: "ফিনান্স", en: "Finance" },
  { id: "banking-insurance", name: "ব্যাংকিং ও ইন্স্যুরেন্স", en: "Banking & Insurance" },
].map((s) => ({ ...s, ico: ICONS[s.id] }));
const TYPES = [
  { id: "pdf", name: "PDF", add: "PDF" },
];
const DEFAULT_SETTINGS = {
  subscriptionEnabled: false,
  plans: [
    { id: "monthly", name: "মাসিক", price: 199, days: 30 },
    { id: "quarterly", name: "3 মাস", price: 499, days: 90 },
    { id: "yearly", name: "বার্ষিক", price: 1499, days: 365 },
  ],
  bkash: "01908523912",
  nagad: "01577653713",
};

const state = {
  user: null, isAdmin: false, settings: { ...DEFAULT_SETTINGS }, sub: null,
  content: null, books: null, purchases: {}, chapters: [], adminBook: null,
  adminTab: "overview", subjTab: {}, adminType: "pdf",
};

/* ============================================================
   Helpers
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const subjName = (id) => SUBJECTS.find((s) => s.id === id)?.name || id;
const bn = (n) => String(n).replace(/\d/g, (d) => "0123456789"[d]);
const fmtDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null)?.toLocaleDateString("bn-BD-u-nu-latn", { year: "numeric", month: "short", day: "numeric" }) || "—";

function toast(msg, kind = "") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function openModal(html, narrow = false) {
  $("#overlay").innerHTML = `<div class="modal-bg" data-act="closeModalBg"><div class="modal ${narrow ? "narrow" : ""} fade">${html}</div></div>`;
}
function closeModal() { $("#overlay").innerHTML = ""; }
function errMsg(e) {
  const c = e?.code || "";
  if (c.includes("popup-closed")) return "লগইন উইন্ডো বন্ধ করা হয়েছে";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "ইমেইল বা পাসওয়ার্ড ভুল";
  if (c.includes("email-already-in-use")) return "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে";
  if (c.includes("weak-password")) return "পাসওয়ার্ড কমপক্ষে 6 অক্ষরের দিন";
  if (c.includes("invalid-email")) return "ইমেইলটি সঠিক নয়";
  if (c.includes("permission-denied")) return "অনুমতি নেই";
  return e?.message || "কিছু একটা সমস্যা হয়েছে";
}

const subActive = () => !!(state.sub?.expiresAt && state.sub.expiresAt.toMillis() > Date.now());
const canAccess = (item) => state.isAdmin || item.free || !state.settings.subscriptionEnabled || subActive();

function toEmbed(url, type) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace("www.", "");
    if (h === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (h.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") || (u.pathname.match(/\/(embed|shorts|live)\/([\w-]+)/) || [])[2];
      if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
    }
    if (h === "drive.google.com") {
      const m = u.pathname.match(/\/d\/([\w-]+)/);
      if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
    if (h === "docs.google.com") {
      if (u.pathname.includes("/presentation/")) return url.replace(/\/(edit|view|pub).*$/, "/embed");
      return url.replace(/\/(edit|view).*$/, "/preview");
    }
    if (h === "drive.google.com") return url;
    if (type === "video" && /\.(mp4|webm)(\?|$)/i.test(url)) return null;
    return url;
  } catch { return null; }
}

/* ============================================================
   Data
   ============================================================ */
async function loadSettings() {
  try {
    const s = await getDoc(doc(db, "settings", "app"));
    if (s.exists()) state.settings = { ...DEFAULT_SETTINGS, ...s.data() };
  } catch (e) { console.warn("settings", e); }
}
async function loadSub() {
  if (!state.user) return null;
  try { const s = await getDoc(doc(db, "subs", state.user.uid)); return s.exists() ? s.data() : null; }
  catch { return null; }
}
async function loadContent(force = false) {
  if (state.content && !force) return state.content;
  const snap = await getDocs(collection(db, "content"));
  state.content = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
  return state.content;
}

async function loadBooks(force = false) {
  if (state.books && !force) return state.books;
  const snap = await getDocs(collection(db, "books"));
  state.books = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return state.books;
}
async function loadPurchases() {
  if (!state.user) return {};
  try {
    const snap = await getDocs(query(collection(db, "purchases"), where("uid", "==", state.user.uid)));
    return Object.fromEntries(snap.docs.map((d) => [d.data().bookId, { expiresAt: d.data().expiresAt, title: d.data().bookTitle }]));
  } catch { return {}; }
}
const bookExp = (b) => state.purchases[b.id]?.expiresAt;
const bookAccess = (b) => state.isAdmin || !(b.price > 0) || (bookExp(b)?.toMillis() > Date.now());

/* ============================================================
   Router
   ============================================================ */
const route = () => (location.hash.slice(1) || "/").split("/").filter(Boolean);

async function render() {
  const [r, p] = route();
  const view = $("#app");
  let body = "";
  try {
    if (!r) body = homeView();
    else if (r === "login") body = loginView();
    else if (r === "subject") body = await subjectView(p);
    else if (r === "book") body = await bookView(p);
    else if (r === "pricing") body = await pricingView();
    else if (r === "account") body = await accountView();
    else if (r === "admin") body = await adminView();
    else body = `<div class="wrap section"><div class="empty">পাতাটি পাওয়া যায়নি</div></div>`;
  } catch (e) {
    console.error(e);
    body = `<div class="wrap section"><div class="empty">লোড করতে সমস্যা: ${esc(errMsg(e))}</div></div>`;
  }
  view.innerHTML = navView(r) + `<main class="fade">${body}</main>` + footerView();
  window.scrollTo({ top: 0 });
  syncFx();
}
window.addEventListener("hashchange", render);

/* ============================================================
   Views
   ============================================================ */
function navView(r) {
  const u = state.user;
  const a = (h, t) => `<a href="#/${h}" class="${r === h ? "active" : ""}">${t}</a>`;
  return `<header class="nav"><div class="wrap">
    <a href="#/" class="brand"><span class="logo">ভ</span>${esc(APP_NAME)}</a>
    <nav class="links">
      ${a("", "হোম").replace('href="#/"', 'href="#/"')}
      ${a("pricing", "প্ল্যান")}
      ${u ? a("account", "আমার অ্যাকাউন্ট") : ""}
      ${state.isAdmin ? a("admin", "অ্যাডমিন") : ""}
      ${u ? `<button class="link" data-act="logout">লগআউট</button>${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="">` : ""}`
          : `<a class="btn primary sm" href="#/login">লগইন</a>`}
    </nav></div></header>`;
}
function footerView() {
  return `<footer class="footer wrap">© ${bn(new Date().getFullYear())} ${esc(APP_NAME)} · সব অধিকার সংরক্ষিত</footer>`;
}

function homeView() {
  const subOn = state.settings.subscriptionEnabled;
  return `
  <section class="wrap hero">
    <span class="pill">ভর্তি পরীক্ষার স্মার্ট প্রস্তুতি</span>
    <h1>সেরা প্রস্তুতি, <span class="grad">এক জায়গায়</span></h1>
    <p>অধ্যায় অনুযায়ী PDF নোট ও বই — বাংলা, ইংলিশ, হিসাববিজ্ঞান, ব্যবস্থাপনা, ফিনান্স সহ সব বিষয়ে গোছানো কনটেন্ট।</p>
    <div class="cta">
      <a class="btn primary" href="${state.user ? "#/subject/bangla" : "#/login"}">${state.user ? "পড়া শুরু করুন" : "ফ্রিতে শুরু করুন"}</a>
      <a class="btn" href="#/pricing">${subOn ? "প্ল্যান দেখুন" : "বিস্তারিত"}</a>
    </div>
    <div class="stats">
      <div class="stat"><b>${bn(SUBJECTS.length)}টি</b><span>বিষয়</span></div>
      <div class="stat"><b>PDF</b><span>অধ্যায় অনুযায়ী নোট</span></div>
      <div class="stat"><b>বই</b><span>চ্যাপ্টার ভিত্তিক</span></div>
    </div>
  </section>
  <section class="wrap section">
    <h2>বিষয়সমূহ</h2><p class="sub">যে বিষয়টি পড়তে চান সেটি বেছে নিন</p>
    <div class="grid">${SUBJECTS.map((s) => `
      <a class="card hover" href="#/subject/${s.id}">
        <div class="subj-ico">${s.ico}</div>
        <h3>${esc(s.name)}</h3><div class="muted small">${esc(s.en)}</div>
      </a>`).join("")}
    </div>
  </section>`;
}

function loginView() {
  if (state.user) { location.hash = "#/"; return ""; }
  return `<div class="wrap section login" style="max-width:460px">
    <div class="card">
      <div class="login-logo"><span class="logo">ভ</span></div>
      <h2 class="center" style="margin-bottom:4px">স্বাগতম 👋</h2>
      <p class="muted center" style="margin-bottom:18px">লগইন করে কনটেন্ট দেখুন</p>
      <button class="btn block" data-act="google">Google দিয়ে চালিয়ে যান</button>
      <div class="divider">অথবা ইমেইল ও পাসওয়ার্ড</div>
      <form id="authForm">
        <div id="nameWrap" style="display:none"><label>নাম</label><input id="aName" placeholder="আপনার নাম"></div>
        <label>ইমেইল</label><input id="aEmail" type="email" required placeholder="you@example.com">
        <label>পাসওয়ার্ড</label><input id="aPass" type="password" required minlength="6" placeholder="কমপক্ষে 6 অক্ষর">
        <button class="btn primary block" style="margin-top:18px" id="authBtn" data-mode="in">লগইন</button>
      </form>
      <p class="center small muted" style="margin-top:14px">
        <a href="#" data-act="toggleMode" id="modeLink" style="color:var(--gold)">নতুন অ্যাকাউন্ট খুলুন</a> ·
        <a href="#" data-act="resetPass" style="color:var(--gold)">পাসওয়ার্ড ভুলে গেছেন?</a>
      </p>
    </div></div>`;
}

async function subjectView(id) {
  const s = SUBJECTS.find((x) => x.id === id);
  if (!s) return `<div class="wrap section"><div class="empty">বিষয় পাওয়া যায়নি</div></div>`;
  if (!state.user) return gate("এই বিষয়ের কনটেন্ট দেখতে লগইন করুন");
  const tab = state.subjTab[id] || "pdf";
  const tabs = [...TYPES, { id: "book", name: "বই" }];
  let inner;
  if (tab === "book") inner = await bookListView(id);
  else {
    const all = await loadContent();
    const items = all.filter((c) => c.subject === id && c.type === tab);
    inner = items.length ? `<div class="grid">${items.map(contentCard).join("")}</div>` : `<div class="empty">এই বিভাগে এখনো কিছু যোগ করা হয়নি</div>`;
  }
  return `<div class="wrap section">
    <a href="#/" class="muted small">← সব বিষয়</a>
    <h2 style="margin-top:8px">${esc(s.name)} <span class="muted" style="font-size:1rem">${esc(s.en)}</span></h2>
    <div class="tabs">${tabs.map((t) => `<button class="${tab === t.id ? "on" : ""}" data-act="subjTab" data-subj="${id}" data-type="${t.id}">${t.name}</button>`).join("")}</div>
    ${inner}
  </div>`;
}
async function bookListView(id) {
  const [all, pays] = await Promise.all([loadBooks(), getDocs(query(collection(db, "payments"), where("uid", "==", state.user.uid)))]);
  const pending = new Set(pays.docs.map((d) => d.data()).filter((p) => p.kind === "book" && p.status === "pending").map((p) => p.bookId));
  const items = all.filter((b) => b.subject === id);
  return items.length ? `<div class="grid book-grid">${items.map((b) => bookCard(b, pending.has(b.id))).join("")}</div>`
    : `<div class="empty">এই বিষয়ের বই এখনো যোগ করা হয়নি</div>`;
}
function bookCard(b, pending) {
  const has = bookAccess(b), free = !(b.price > 0);
  const badge = free ? `<span class="badge free">ফ্রি</span>`
    : state.isAdmin ? `<span class="badge lock">৳${bn(b.price)} · ${bn(b.days)} দিন</span>`
    : has ? `<span class="badge free">কেনা · ${fmtDate(bookExp(b))} পর্যন্ত</span>`
    : pending ? `<span class="badge pending">যাচাই চলছে</span>`
    : `<span class="badge lock">৳${bn(b.price)} · ${bn(b.days)} দিন</span>`;
  const act = "goBook";
  return `<div class="card hover book" data-act="${act}" data-id="${b.id}" style="cursor:pointer">
    ${b.cover ? `<img class="book-cover" src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="book-cover ph"><span>${esc((b.title || "ব")[0])}</span></div>`}
    <div style="margin:12px 0 8px">${badge}</div>
    <h3 style="font-size:1.05rem">${esc(b.title)}</h3>
    ${b.author ? `<div class="muted small">${esc(b.author)}</div>` : ""}
    ${b.desc ? `<p class="muted small" style="margin-top:6px">${esc(b.desc)}</p>` : ""}
    <button class="btn ${has ? "" : "primary"} sm block" style="margin-top:12px">${has ? "পড়ুন" : "চ্যাপ্টার দেখুন"}</button>
  </div>`
}
function contentCard(c) {
  const ok = canAccess(c);
  return `<div class="card hover" data-act="openContent" data-id="${c.id}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px">
      <span class="badge ${c.free ? "free" : ok ? "free" : "lock"}">${c.free ? "ফ্রি" : ok ? "আনলকড" : "🔒 প্রিমিয়াম"}</span>
      <span class="muted small">${TYPES.find((t) => t.id === c.type)?.name}</span>
    </div>
    <h3 style="font-size:1.1rem">${esc(c.title)}</h3>
    ${c.desc ? `<p class="muted small" style="margin-top:6px">${esc(c.desc)}</p>` : ""}
  </div>`;
}
function gate(msg) {
  return `<div class="wrap section"><div class="card center" style="max-width:460px;margin:auto">
    <div style="font-size:2.4rem">🔐</div><h3 style="margin:8px 0">${esc(msg)}</h3>
    <a class="btn primary" href="#/login" style="margin-top:10px">লগইন করুন</a></div></div>`;
}

async function loadChapters(bookId) {
  const snap = await getDocs(query(collection(db, "chapters"), where("bookId", "==", bookId)));
  state.chapters = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  return state.chapters;
}
const chAccess = (c, b) => bookAccess(b) || !!c.free;
function chapterRow(c, b) {
  const ok = chAccess(c, b);
  return `<div class="chapter ${ok ? "" : "locked"}" data-act="openChapter" data-id="${c.id}" data-book="${b.id}">
    <span class="ch-no">${c.no ?? ""}</span><span class="ch-title">${esc(c.title)}</span>
    <span class="badge ${ok ? "free" : "lock"}">${c.free ? "ফ্রি" : ok ? "আনলকড" : "🔒 লক"}</span></div>`;
}
async function bookView(id) {
  if (!state.user) return gate("বই দেখতে লগইন করুন");
  const [books, chs, pays] = await Promise.all([loadBooks(), loadChapters(id), getDocs(query(collection(db, "payments"), where("uid", "==", state.user.uid)))]);
  const b = books.find((x) => x.id === id);
  if (!b) return `<div class="wrap section"><div class="empty">বই পাওয়া যায়নি</div></div>`;
  const pending = pays.docs.some((d) => { const p = d.data(); return p.kind === "book" && p.bookId === id && p.status === "pending"; });
  const has = bookAccess(b), paid = b.price > 0;
  const buy = !paid ? `<span class="badge free">ফ্রি বই</span>`
    : state.isAdmin ? `<span class="badge lock">৳${bn(b.price)} · ${bn(b.days)} দিন</span>`
    : has ? `<span class="badge free">আনলকড · ${fmtDate(bookExp(b))} পর্যন্ত</span>`
    : pending ? `<span class="badge pending">পেমেন্ট যাচাই চলছে</span>`
    : `<button class="btn primary" data-act="buyBook" data-id="${b.id}">৳${bn(b.price)} দিয়ে ${bn(b.days)} দিনের জন্য কিনুন</button>`;
  return `<div class="wrap section">
    <a href="#/subject/${esc(b.subject)}" class="muted small">← ${esc(subjName(b.subject))}</a>
    <div class="card book-head" style="margin-top:10px">
      ${b.cover ? `<img class="book-cover" src="${esc(b.cover)}" alt="" referrerpolicy="no-referrer">` : `<div class="book-cover ph"><span>${esc((b.title || "ব")[0])}</span></div>`}
      <div style="flex:1;min-width:200px"><h2>${esc(b.title)}</h2>
        ${b.author ? `<div class="muted">${esc(b.author)}</div>` : ""}
        ${b.desc ? `<p class="muted small" style="margin-top:8px">${esc(b.desc)}</p>` : ""}
        ${paid && !has ? `<p class="muted small" style="margin-top:8px">প্রথম চ্যাপ্টার ফ্রি। বাকিগুলো পড়তে বইটি কিনুন।</p>` : ""}
        <div style="margin-top:14px">${buy}</div></div>
    </div>
    <h3 style="margin:24px 0 12px">চ্যাপ্টারসমূহ</h3>
    ${chs.length ? chs.map((c) => chapterRow(c, b)).join("") : `<div class="empty">এই বইয়ে এখনো চ্যাপ্টার যোগ করা হয়নি</div>`}
  </div>`;
}

async function pricingView() {
  const s = state.settings;
  if (!s.subscriptionEnabled) {
    return `<div class="wrap section"><div class="card center" style="max-width:560px;margin:50px auto">
      <div style="font-size:2.4rem">🎁</div>
      <h2 style="margin:8px 0">এখন সব কনটেন্ট ফ্রি!</h2>
      <p class="muted">বর্তমানে কোনো সাবস্ক্রিপশন লাগছে না। লগইন করে সব PDF নোট ও বই পড়ুন।</p>
      <a class="btn primary" href="${state.user ? "#/subject/bangla" : "#/login"}" style="margin-top:16px">পড়া শুরু করুন</a>
    </div></div>`;
  }
  const active = subActive();
  return `<div class="wrap section">
    <h2 class="center">আপনার প্ল্যান বেছে নিন</h2>
    <p class="sub center">পেমেন্ট করে TrxID জমা দিন — অ্যাডমিন যাচাই করে অ্যাকাউন্ট চালু করবেন</p>
    ${active ? `<div class="card center" style="margin-bottom:18px"><span class="badge approved">সক্রিয়</span> আপনার সাবস্ক্রিপশন চালু আছে — মেয়াদ: ${fmtDate(state.sub.expiresAt)}</div>` : ""}
    <div class="grid">${s.plans.map((p) => `
      <div class="card hover center">
        <h3>${esc(p.name)}</h3>
        <div class="price" style="margin:10px 0">৳${bn(p.price)}<small> / ${bn(p.days)} দিন</small></div>
        <button class="btn primary block" data-act="buyPlan" data-id="${esc(p.id)}">এই প্ল্যান নিন</button>
      </div>`).join("")}
    </div></div>`;
}

async function accountView() {
  if (!state.user) return gate("অ্যাকাউন্ট দেখতে লগইন করুন");
  const u = state.user;
  const snap = await getDocs(query(collection(db, "payments"), where("uid", "==", u.uid)));
  const pays = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  const mine = Object.entries(state.purchases).filter(([, v]) => v.expiresAt?.toMillis() > Date.now());
  const myBooksHtml = mine.length ? `<h2 style="margin:28px 0 12px">আমার বই</h2><div class="table-wrap"><table><thead><tr><th>বই</th><th>মেয়াদ</th></tr></thead><tbody>${mine.map(([bid, v]) => `<tr><td><a href="#/book/${esc(bid)}" style="color:var(--gold)">${esc(v.title)}</a></td><td>${fmtDate(v.expiresAt)} পর্যন্ত</td></tr>`).join("")}</tbody></table></div>` : "";
  return `<div class="wrap section">
    <div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      ${u.photoURL ? `<img class="avatar" style="width:60px;height:60px" src="${esc(u.photoURL)}" alt="">` : `<div class="logo" style="width:60px;height:60px">${esc((u.displayName || u.email)[0].toUpperCase())}</div>`}
      <div style="flex:1"><h3>${esc(u.displayName || "ব্যবহারকারী")}</h3><div class="muted">${esc(u.email)}</div></div>
      <div>${state.settings.subscriptionEnabled
        ? (subActive() ? `<span class="badge approved">সক্রিয় · ${fmtDate(state.sub.expiresAt)} পর্যন্ত</span>` : `<span class="badge lock">সাবস্ক্রিপশন নেই</span>`)
        : `<span class="badge free">সব ফ্রি</span>`}</div>
    </div>
    ${myBooksHtml}
    <h2 style="margin:28px 0 12px">আমার পেমেন্ট</h2>
    ${pays.length ? `<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>প্ল্যান</th><th>মাধ্যম</th><th>TrxID</th><th>টাকা</th><th>স্ট্যাটাস</th></tr></thead><tbody>
      ${pays.map((p) => `<tr><td>${fmtDate(p.createdAt)}</td><td>${esc(p.planName)}</td><td>${esc(p.method)}</td><td>${esc(p.trxId)}</td><td>৳${bn(p.amount)}</td>
        <td><span class="badge ${p.status}">${{ pending: "অপেক্ষমাণ", approved: "অনুমোদিত", rejected: "বাতিল" }[p.status]}</span></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">কোনো পেমেন্ট নেই</div>`}
  </div>`;
}

/* ---------------- Admin ---------------- */
async function adminView() {
  if (!state.isAdmin) return gate("শুধু অ্যাডমিনের জন্য — Google দিয়ে অ্যাডমিন Gmail-এ লগইন করুন");
  const tab = state.adminTab;
  const tabs = [["overview", "ওভারভিউ"], ["payments", "পেমেন্ট"], ["content", "কনটেন্ট"], ["books", "বই"], ["settings", "সাবস্ক্রিপশন ও সেটিংস"], ["users", "ইউজার"]];
  let inner = "";
  if (tab === "overview") inner = await adminOverview();
  if (tab === "payments") inner = await adminPayments();
  if (tab === "content") inner = await adminContent();
  if (tab === "books") inner = await adminBooks();
  if (tab === "settings") inner = adminSettings();
  if (tab === "users") inner = await adminUsers();
  return `<div class="wrap section"><h2>অ্যাডমিন ড্যাশবোর্ড</h2>
    <div class="tabs" style="margin-top:12px">${tabs.map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-act="adminTab" data-tab="${id}">${n}</button>`).join("")}</div>
    ${inner}</div>`;
}
async function adminOverview() {
  const [users, pays, content, books] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "payments")), loadContent(true), loadBooks(true)]);
  const pend = pays.docs.filter((d) => d.data().status === "pending").length;
  const rev = pays.docs.filter((d) => d.data().status === "approved").reduce((a, d) => a + (d.data().amount || 0), 0);
  const cnt = (t) => content.filter((c) => c.type === t).length;
  return `<div class="stats" style="margin-top:0">
    <div class="stat"><b>${bn(users.size)}</b><span>মোট ইউজার</span></div>
    <div class="stat"><b>${bn(pend)}</b><span>অপেক্ষমাণ পেমেন্ট</span></div>
    <div class="stat"><b>৳${bn(rev)}</b><span>মোট আয়</span></div>
    <div class="stat"><b>${bn(cnt("pdf"))}</b><span>PDF</span></div>
    <div class="stat"><b>${bn(books.length)}</b><span>বই</span></div>
  </div>
  <div class="card" style="margin-top:14px"><b>সাবস্ক্রিপশন:</b> ${state.settings.subscriptionEnabled ? '<span class="badge approved">চালু</span>' : '<span class="badge free">বন্ধ (সব ফ্রি)</span>'}
  <span class="muted small"> — "সাবস্ক্রিপশন ও সেটিংস" ট্যাব থেকে পরিবর্তন করুন।</span></div>`;
}
async function adminPayments() {
  const snap = await getDocs(collection(db, "payments"));
  const pays = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  if (!pays.length) return `<div class="empty">এখনো কোনো পেমেন্ট রিকোয়েস্ট আসেনি</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>ইউজার</th><th>প্ল্যান</th><th>মাধ্যম / নম্বর</th><th>TrxID</th><th>টাকা</th><th>স্ট্যাটাস</th><th></th></tr></thead><tbody>
    ${pays.map((p) => `<tr><td>${fmtDate(p.createdAt)}</td><td>${esc(p.name)}<div class="muted small">${esc(p.email)}</div></td><td>${esc(p.planName)}</td>
      <td>${esc(p.method)}<div class="muted small">${esc(p.senderNumber)}</div></td><td><b>${esc(p.trxId)}</b></td><td>৳${bn(p.amount)}</td>
      <td><span class="badge ${p.status}">${{ pending: "অপেক্ষমাণ", approved: "অনুমোদিত", rejected: "বাতিল" }[p.status]}</span></td>
      <td style="white-space:nowrap">${p.status === "pending" ? `<button class="btn ok sm" data-act="approve" data-id="${p.id}">অনুমোদন</button> <button class="btn bad sm" data-act="reject" data-id="${p.id}">বাতিল</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
}
async function adminContent() {
  const all = await loadContent(true);
  const t = state.adminType;
  const list = all.filter((c) => c.type === t);
  const tn = TYPES.find((x) => x.id === t);
  const hint = "Google Drive PDF লিংক (Anyone with link → Viewer)";
  return `<div class="tabs">${TYPES.map((x) => `<button class="${t === x.id ? "on" : ""}" data-act="adminType" data-type="${x.id}">${x.name}</button>`).join("")}</div>
  <div class="card" style="margin-bottom:18px"><h3>নতুন ${tn.add} যোগ করুন</h3>
    <form id="contentForm" data-type="${t}">
      <div class="row">
        <div><label>বিষয়</label><select id="cSubject">${SUBJECTS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
        <div><label>শিরোনাম</label><input id="cTitle" required placeholder="যেমন: অধ্যায় 1 — ভূমিকা (PDF)"></div>
      </div>
      <label>লিংক <span class="muted small">(${hint})</span></label><input id="cUrl" type="url" required placeholder="https://...">
      <label>সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label><input id="cDesc">
      <div class="row" style="align-items:end"><div class="switch" style="padding-top:12px"><input type="checkbox" id="cFree"><span>ফ্রি কনটেন্ট (সাবস্ক্রিপশন ছাড়াই দেখা যাবে)</span></div>
      <div><button class="btn primary block">যোগ করুন</button></div></div>
    </form></div>
  ${list.length ? `<div class="table-wrap"><table><thead><tr><th>বিষয়</th><th>শিরোনাম</th><th>ফ্রি</th><th></th></tr></thead><tbody>
    ${list.map((c) => `<tr><td>${esc(subjName(c.subject))}</td><td>${esc(c.title)}</td><td>${c.free ? "✔" : "—"}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-act="toggleFree" data-id="${c.id}">${c.free ? "প্রিমিয়াম করুন" : "ফ্রি করুন"}</button> <button class="btn bad sm" data-act="delContent" data-id="${c.id}">মুছুন</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">কোনো ${tn.name} নেই</div>`}`;
}
async function adminBooks() {
  const all = await loadBooks(true);
  if (state.adminBook) {
    const bk = all.find((x) => x.id === state.adminBook);
    if (bk) return await adminChapters(bk);
    state.adminBook = null;
  }
  return `<div class="card" style="margin-bottom:18px"><h3>নতুন বই যোগ করুন</h3>
    <p class="muted small" style="margin:4px 0 8px">আগে বইটি তৈরি করুন (দাম আর মেয়াদ সহ), তারপর তালিকা থেকে "চ্যাপ্টার" বাটনে চেপে চ্যাপ্টার যোগ করুন। প্রথম চ্যাপ্টার ফ্রি রাখলে বাকিগুলো কিনলে তবেই খুলবে। দাম ৳0 দিলে পুরো বই ফ্রি হবে।</p>
    <form id="bookForm">
      <div class="row"><div><label>বিষয়</label><select id="bSubject">${SUBJECTS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
        <div><label>বইয়ের নাম</label><input id="bTitle" required></div></div>
      <div class="row"><div><label>লেখক (ঐচ্ছিক)</label><input id="bAuthor"></div>
        <div><label>কভার ছবির লিংক (ঐচ্ছিক)</label><input id="bCover" type="url" placeholder="https://..."></div></div>
      <label>সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)</label><input id="bDesc">
      <div class="row" style="align-items:end"><div><label>পুরো বইয়ের দাম (৳)</label><input id="bPrice" type="number" min="0" required value="100"></div>
        <div><label>পড়ার মেয়াদ (দিন)</label><input id="bDays" type="number" min="1" max="3650" required value="365"></div>
        <div><button class="btn primary block">বই তৈরি করুন</button></div></div>
    </form></div>
  ${all.length ? `<div class="table-wrap"><table><thead><tr><th>বিষয়</th><th>বই</th><th>দাম</th><th>মেয়াদ</th><th></th></tr></thead><tbody>
    ${all.map((b) => `<tr><td>${esc(subjName(b.subject))}</td><td>${esc(b.title)}</td><td>${b.price > 0 ? "৳" + bn(b.price) : "ফ্রি"}</td><td>${bn(b.days)} দিন</td>
      <td style="white-space:nowrap"><button class="btn ok sm" data-act="manageBook" data-id="${b.id}">চ্যাপ্টার</button> <button class="btn sm" data-act="editBook" data-id="${b.id}">দাম/মেয়াদ</button> <button class="btn bad sm" data-act="delBook" data-id="${b.id}">মুছুন</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">কোনো বই নেই</div>`}`;
}
async function adminChapters(b) {
  const chs = await loadChapters(b.id);
  const next = chs.length ? Math.max(...chs.map((c) => c.no || 0)) + 1 : 1;
  return `<button class="btn sm" data-act="backBooks" style="margin-bottom:14px">← বইয়ের তালিকা</button>
  <div class="card" style="margin-bottom:18px"><h3>${esc(b.title)} — নতুন চ্যাপ্টার</h3>
    <p class="muted small" style="margin:4px 0 8px">চ্যাপ্টারের PDF Google Drive-এ আপলোড করে (Anyone with the link → Viewer) লিংক দিন।</p>
    <form id="chapterForm" data-book="${b.id}">
      <div class="row"><div style="flex:0 0 110px;min-width:110px"><label>ক্রম নং</label><input id="chNo" type="number" min="1" required value="${next}"></div>
        <div><label>চ্যাপ্টারের নাম</label><input id="chTitle" required placeholder="যেমন: ব্যাংকের ধারণা"></div></div>
      <label>ফাইল লিংক (Drive PDF)</label><input id="chUrl" type="url" required placeholder="https://drive.google.com/...">
      <div class="row" style="align-items:end"><div class="switch" style="padding-top:12px"><input type="checkbox" id="chFree" ${next === 1 ? "checked" : ""}><span>ফ্রি চ্যাপ্টার (কেনা ছাড়াই পড়া যাবে)</span></div>
        <div><button class="btn primary block">যোগ করুন</button></div></div>
    </form></div>
  ${chs.length ? `<div class="table-wrap"><table><thead><tr><th>ক্রম</th><th>চ্যাপ্টার</th><th>ফ্রি</th><th></th></tr></thead><tbody>
    ${chs.map((c) => `<tr><td>${c.no ?? ""}</td><td>${esc(c.title)}</td><td>${c.free ? "✔" : "—"}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-act="chToggleFree" data-id="${c.id}">${c.free ? "লক করুন" : "ফ্রি করুন"}</button> <button class="btn sm" data-act="chNo" data-id="${c.id}">ক্রম</button> <button class="btn bad sm" data-act="chDel" data-id="${c.id}">মুছুন</button></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">এই বইয়ে এখনো চ্যাপ্টার নেই</div>`}`;
}
function adminSettings() {
  const s = state.settings;
  return `<div class="card"><h3>সাবস্ক্রিপশন সিস্টেম</h3>
    <p class="muted small" style="margin:4px 0 12px">বন্ধ থাকলে সব কনটেন্ট ফ্রি। চালু করলে "ফ্রি" চিহ্নিত কনটেন্ট ছাড়া বাকি সব শুধু সাবস্ক্রাইবাররা দেখবে।</p>
    <div class="switch"><input type="checkbox" id="sEnabled" ${s.subscriptionEnabled ? "checked" : ""}><span><b>সাবস্ক্রিপশন চালু</b></span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>পেমেন্ট নম্বর</h3>
    <div class="row"><div><label>বিকাশ</label><input id="sBkash" value="${esc(s.bkash)}"></div><div><label>নগদ</label><input id="sNagad" value="${esc(s.nagad)}"></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>প্ল্যান</h3>
    <div id="plans">${s.plans.map(planRow).join("")}</div>
    <button class="btn sm" data-act="addPlan" style="margin-top:12px">+ প্ল্যান যোগ</button>
  </div>
  <button class="btn primary" data-act="saveSettings" style="margin-top:16px">সেভ করুন</button>`;
}
const planRow = (p) => `<div class="row plan-row" style="margin-top:8px;align-items:end">
  <div><label>নাম</label><input class="pName" value="${esc(p.name)}"></div>
  <div><label>দাম (৳)</label><input class="pPrice" type="number" min="0" value="${p.price}"></div>
  <div><label>মেয়াদ (দিন)</label><input class="pDays" type="number" min="1" value="${p.days}"></div>
  <div style="flex:0"><button class="btn bad sm" data-act="delPlan">✕</button></div></div>`;

async function adminUsers() {
  const [us, ss] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "subs"))]);
  const subs = Object.fromEntries(ss.docs.map((d) => [d.id, d.data()]));
  const users = us.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!users.length) return `<div class="empty">কোনো ইউজার নেই</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>নাম</th><th>ইমেইল</th><th>সাবস্ক্রিপশন</th><th></th></tr></thead><tbody>
    ${users.map((u) => { const sb = subs[u.id]; const on = sb?.expiresAt?.toMillis() > Date.now();
      return `<tr><td>${esc(u.name || "—")}</td><td>${esc(u.email)}</td>
      <td>${on ? `<span class="badge approved">${fmtDate(sb.expiresAt)} পর্যন্ত</span>` : `<span class="muted">নেই</span>`}</td>
      <td style="white-space:nowrap"><button class="btn ok sm" data-act="grant" data-id="${u.id}">দিন বাড়ান</button> ${on ? `<button class="btn bad sm" data-act="revoke" data-id="${u.id}">বাতিল</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>`;
}

/* ============================================================
   Actions
   ============================================================ */
async function grantDays(uid, days, planName = "ম্যানুয়াল") {
  const cur = (await getDoc(doc(db, "subs", uid))).data();
  const base = cur?.expiresAt && cur.expiresAt.toMillis() > Date.now() ? cur.expiresAt.toMillis() : Date.now();
  await setDoc(doc(db, "subs", uid), { active: true, planName, expiresAt: Timestamp.fromMillis(base + days * 86400000), updatedAt: serverTimestamp() });
}

async function grantBook(uid, bookId, days, title) {
  const ref = doc(db, "purchases", `${uid}_${bookId}`);
  const cur = (await getDoc(ref)).data();
  const base = cur?.expiresAt && cur.expiresAt.toMillis() > Date.now() ? cur.expiresAt.toMillis() : Date.now();
  await setDoc(ref, { uid, bookId, bookTitle: title, expiresAt: Timestamp.fromMillis(base + days * 86400000), updatedAt: serverTimestamp() });
}

const actions = {
  closeModalBg(e) { if (e.target.classList.contains("modal-bg")) closeModal(); },
  closeModal,
  async logout() { await signOut(auth); location.hash = "#/"; },
  async google() {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); location.hash = "#/"; }
    catch (e) { toast(errMsg(e), "err"); }
  },
  toggleMode(e) {
    e.preventDefault();
    const btn = $("#authBtn"); const signup = btn.dataset.mode === "in";
    btn.dataset.mode = signup ? "up" : "in";
    btn.textContent = signup ? "অ্যাকাউন্ট খুলুন" : "লগইন";
    $("#nameWrap").style.display = signup ? "block" : "none";
    $("#modeLink").textContent = signup ? "আগে থেকেই অ্যাকাউন্ট আছে? লগইন" : "নতুন অ্যাকাউন্ট খুলুন";
  },
  async resetPass(e) {
    e.preventDefault();
    const email = $("#aEmail").value.trim();
    if (!email) return toast("আগে ইমেইল লিখুন", "err");
    try { await sendPasswordResetEmail(auth, email); toast("রিসেট লিংক ইমেইলে পাঠানো হয়েছে", "ok"); } catch (er) { toast(errMsg(er), "err"); }
  },
  subjTab(e, el) { state.subjTab[el.dataset.subj] = el.dataset.type; render(); },
  async openContent(e, el) {
    const item = state.content.find((c) => c.id === el.dataset.id);
    if (!item) return;
    if (!canAccess(item)) {
      return openModal(`<div class="center"><div style="font-size:2.4rem">🔒</div><h3 style="margin:8px 0">প্রিমিয়াম কনটেন্ট</h3>
        <p class="muted">এটি দেখতে সাবস্ক্রিপশন প্রয়োজন।</p>
        <a class="btn primary" href="#/pricing" data-act="closeModal" style="margin-top:14px">প্ল্যান দেখুন</a></div>`, true);
    }
    try {
      const l = await getDoc(doc(db, "links", item.id));
      const url = l.data()?.url;
      const embed = toEmbed(url, item.type);
      openModal(`<div class="modal-head"><h3>${esc(item.title)}</h3><button class="x" data-act="closeModal">✕</button></div>
        ${embed ? `<div class="frame ${item.type === "pdf" ? "tall" : ""}"><iframe src="${esc(embed)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe></div>`
                : `<video controls style="width:100%;border-radius:14px" src="${esc(url)}"></video>`}
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">নতুন ট্যাবে খুলুন ↗</a></div>
        ${item.desc ? `<p class="muted" style="margin-top:12px">${esc(item.desc)}</p>` : ""}`);
    } catch (er) {
      openModal(`<div class="center"><div style="font-size:2.4rem">🔒</div><h3>এই কনটেন্ট দেখার অনুমতি নেই</h3><p class="muted">সাবস্ক্রিপশন নিলে দেখতে পারবেন।</p><a class="btn primary" href="#/pricing" data-act="closeModal" style="margin-top:12px">প্ল্যান দেখুন</a></div>`, true);
    }
  },
  buyPlan(e, el) {
    if (!state.user) { location.hash = "#/login"; return; }
    const p = state.settings.plans.find((x) => x.id === el.dataset.id);
    openModal(`<div class="modal-head"><h3>${esc(p.name)} প্ল্যান — ৳${bn(p.price)}</h3><button class="x" data-act="closeModal">✕</button></div>
      <p class="muted small">নিচের যেকোনো নম্বরে <b>Send Money</b> করুন, তারপর ফর্মটি পূরণ করুন।</p>
      <div class="paybox">বিকাশ (Personal): <b>${esc(state.settings.bkash)}</b><br>নগদ (Personal): <b>${esc(state.settings.nagad)}</b></div>
      <form id="payForm" data-plan="${esc(p.id)}">
        <label>পেমেন্ট মাধ্যম</label><select id="pMethod"><option>বিকাশ</option><option>নগদ</option></select>
        <label>যে নম্বর থেকে পাঠিয়েছেন</label><input id="pSender" required pattern="01[0-9]{9}" placeholder="01XXXXXXXXX">
        <label>Transaction ID (TrxID)</label><input id="pTrx" required minlength="6" placeholder="যেমন: 9A7B6C5D4E">
        <button class="btn primary block" style="margin-top:16px">জমা দিন</button>
      </form>`);
  },
  async approve(e, el) {
    const ref = doc(db, "payments", el.dataset.id);
    const p = (await getDoc(ref)).data();
    if (p.kind === "book") {
      const bk = (await getDoc(doc(db, "books", p.bookId))).data();
      await grantBook(p.uid, p.bookId, bk?.days || p.days || 30, p.bookTitle || bk?.title || "বই");
    } else {
      const plan = state.settings.plans.find((x) => x.id === p.planId);
      const days = plan?.days || p.days || 30;
      await grantDays(p.uid, days, p.planName);
    }
    await setDoc(ref, { status: "approved", reviewedAt: serverTimestamp() }, { merge: true });
    toast("অনুমোদন করা হয়েছে", "ok"); render();
  },
  async reject(e, el) {
    await setDoc(doc(db, "payments", el.dataset.id), { status: "rejected", reviewedAt: serverTimestamp() }, { merge: true });
    toast("বাতিল করা হয়েছে"); render();
  },
  goBook(e, el) { location.hash = "#/book/" + el.dataset.id; },
  manageBook(e, el) { state.adminBook = el.dataset.id; render(); },
  backBooks() { state.adminBook = null; render(); },
  async openChapter(e, el) {
    const b = state.books.find((x) => x.id === el.dataset.book), c = state.chapters.find((x) => x.id === el.dataset.id);
    if (!b || !c) return;
    if (!chAccess(c, b)) {
      return openModal(`<div class="center"><div style="font-size:2.4rem">🔒</div><h3 style="margin:8px 0">এই চ্যাপ্টার লক করা</h3>
        <p class="muted">৳${bn(b.price)} দিয়ে বইটি কিনলে ${bn(b.days)} দিনের জন্য সব চ্যাপ্টার পড়তে পারবেন।</p>
        <button class="btn primary" data-act="buyBook" data-id="${b.id}" style="margin-top:14px">কিনুন</button></div>`, true);
    }
    try {
      const url = (await getDoc(doc(db, "chapterLinks", c.id))).data()?.url;
      const embed = url && toEmbed(url, "pdf");
      openModal(`<div class="modal-head"><h3>${c.no ?? ""}. ${esc(c.title)}</h3><button class="x" data-act="closeModal">✕</button></div>
        ${embed ? `<div class="frame tall"><iframe src="${esc(embed)}" allowfullscreen referrerpolicy="no-referrer"></iframe></div>` : `<div class="empty">চ্যাপ্টারের লিংক পাওয়া যায়নি</div>`}
        ${url ? `<div style="margin-top:12px"><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">নতুন ট্যাবে খুলুন ↗</a></div>` : ""}`);
    } catch { openModal(`<div class="center"><div style="font-size:2.4rem">🔒</div><h3>এই চ্যাপ্টার পড়ার অনুমতি নেই</h3><p class="muted">বইটি কিনলে পড়তে পারবেন।</p></div>`, true); }
  },
  async chToggleFree(e, el) {
    const c = state.chapters.find((x) => x.id === el.dataset.id);
    await setDoc(doc(db, "chapters", c.id), { free: !c.free }, { merge: true }); render();
  },
  async chNo(e, el) {
    const c = state.chapters.find((x) => x.id === el.dataset.id);
    const n = parseInt(prompt("নতুন ক্রম নং", c.no), 10);
    if (!n || n < 1) return;
    await setDoc(doc(db, "chapters", c.id), { no: n }, { merge: true }); render();
  },
  async chDel(e, el) {
    if (!confirm("চ্যাপ্টারটি মুছে ফেলবেন?")) return;
    await deleteDoc(doc(db, "chapters", el.dataset.id)); await deleteDoc(doc(db, "chapterLinks", el.dataset.id));
    toast("মুছে ফেলা হয়েছে"); render();
  },
  pendingBook() { toast("আপনার পেমেন্ট যাচাই চলছে, অ্যাডমিন অনুমোদন দিলে পড়তে পারবেন"); },
  buyBook(e, el) {
    const b = state.books.find((x) => x.id === el.dataset.id);
    if (!b) return;
    openModal(`<div class="modal-head"><h3>${esc(b.title)} — ৳${bn(b.price)}</h3><button class="x" data-act="closeModal">✕</button></div>
      <p class="muted small">কেনার পর <b>${bn(b.days)} দিন</b> বইয়ের সব চ্যাপ্টার পড়তে পারবেন। নিচের যেকোনো নম্বরে <b>Send Money</b> করুন, তারপর ফর্মটি পূরণ করুন।</p>
      <div class="paybox">বিকাশ (Personal): <b>${esc(state.settings.bkash)}</b><br>নগদ (Personal): <b>${esc(state.settings.nagad)}</b></div>
      <form id="payForm" data-book="${esc(b.id)}">
        <label>পেমেন্ট মাধ্যম</label><select id="pMethod"><option>বিকাশ</option><option>নগদ</option></select>
        <label>যে নম্বর থেকে পাঠিয়েছেন</label><input id="pSender" required pattern="01[0-9]{9}" placeholder="01XXXXXXXXX">
        <label>Transaction ID (TrxID)</label><input id="pTrx" required minlength="6" placeholder="যেমন: 9A7B6C5D4E">
        <button class="btn primary block" style="margin-top:16px">জমা দিন</button>
      </form>`);
  },
  async openBook(e, el) {
    const b = state.books.find((x) => x.id === el.dataset.id);
    if (!b) return;
    try {
      const url = (await getDoc(doc(db, "bookLinks", b.id))).data()?.url;
      const embed = url && toEmbed(url, "pdf");
      const exp = bookExp(b);
      openModal(`<div class="modal-head"><h3>${esc(b.title)}</h3><button class="x" data-act="closeModal">✕</button></div>
        ${embed ? `<div class="frame tall"><iframe src="${esc(embed)}" allowfullscreen referrerpolicy="no-referrer"></iframe></div>` : `<div class="empty">বইয়ের লিংক পাওয়া যায়নি</div>`}
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">${url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">নতুন ট্যাবে খুলুন ↗</a>` : ""}
        ${b.price > 0 && exp && !state.isAdmin ? `<span class="muted small">মেয়াদ: ${fmtDate(exp)} পর্যন্ত</span>` : ""}</div>`);
    } catch { openModal(`<div class="center"><div style="font-size:2.4rem">🔒</div><h3>এই বই পড়ার অনুমতি নেই</h3><p class="muted">বইটি কিনলে পড়তে পারবেন।</p></div>`, true); }
  },
  async editBook(e, el) {
    const b = state.books.find((x) => x.id === el.dataset.id);
    const price = prompt("নতুন দাম (৳) — ফ্রি করতে 0 লিখুন", b.price);
    if (price === null) return;
    const days = prompt("পড়ার মেয়াদ (দিন)", b.days);
    if (days === null) return;
    await setDoc(doc(db, "books", b.id), { price: Math.max(0, +price || 0), days: Math.max(1, parseInt(days, 10) || 365) }, { merge: true });
    toast("আপডেট হয়েছে", "ok"); render();
  },
  async delBook(e, el) {
    if (!confirm("বইটি মুছে ফেলবেন?")) return;
    const cs = await getDocs(query(collection(db, "chapters"), where("bookId", "==", el.dataset.id)));
    for (const c of cs.docs) { await deleteDoc(doc(db, "chapterLinks", c.id)); await deleteDoc(c.ref); }
    await deleteDoc(doc(db, "books", el.dataset.id)); await deleteDoc(doc(db, "bookLinks", el.dataset.id));
    toast("মুছে ফেলা হয়েছে"); render();
  },
  adminTab(e, el) { state.adminTab = el.dataset.tab; state.adminBook = null; render(); },
  adminType(e, el) { state.adminType = el.dataset.type; render(); },
  async delContent(e, el) {
    if (!confirm("মুছে ফেলবেন?")) return;
    await deleteDoc(doc(db, "content", el.dataset.id)); await deleteDoc(doc(db, "links", el.dataset.id));
    toast("মুছে ফেলা হয়েছে"); render();
  },
  async toggleFree(e, el) {
    const c = state.content.find((x) => x.id === el.dataset.id);
    await setDoc(doc(db, "content", c.id), { free: !c.free }, { merge: true }); render();
  },
  addPlan() {
    $("#plans").insertAdjacentHTML("beforeend", planRow({ name: "", price: 0, days: 30 }));
  },
  delPlan(e, el) { el.closest(".plan-row").remove(); },
  async saveSettings() {
    const plans = [...document.querySelectorAll(".plan-row")].map((r, i) => ({
      id: "p" + (i + 1) + "_" + Date.now().toString(36),
      name: $(".pName", r).value.trim(), price: +$(".pPrice", r).value || 0, days: +$(".pDays", r).value || 30,
    })).filter((p) => p.name);
    const data = { subscriptionEnabled: $("#sEnabled").checked, bkash: $("#sBkash").value.trim(), nagad: $("#sNagad").value.trim(), plans };
    await setDoc(doc(db, "settings", "app"), data);
    state.settings = { ...DEFAULT_SETTINGS, ...data };
    toast("সেটিংস সেভ হয়েছে", "ok"); render();
  },
  async grant(e, el) {
    const d = parseInt(prompt("কত দিন যোগ করবেন?", "30"), 10);
    if (!d || d < 1) return;
    await grantDays(el.dataset.id, d); toast("সাবস্ক্রিপশন আপডেট হয়েছে", "ok"); render();
  },
  async revoke(e, el) {
    if (!confirm("সাবস্ক্রিপশন বাতিল করবেন?")) return;
    await deleteDoc(doc(db, "subs", el.dataset.id)); toast("বাতিল করা হয়েছে"); render();
  },
};

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  try { await fn(e, el); } catch (er) { console.error(er); toast(errMsg(er), "err"); }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "authForm") {
      const mode = $("#authBtn").dataset.mode, email = $("#aEmail").value.trim(), pass = $("#aPass").value;
      if (mode === "up") {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const name = $("#aName").value.trim();
        if (name) await updateProfile(cred.user, { displayName: name });
        try { await sendEmailVerification(cred.user); } catch {}
      } else await signInWithEmailAndPassword(auth, email, pass);
      location.hash = "#/";
    }
    if (f.id === "contentForm") {
      const data = { subject: $("#cSubject").value, type: f.dataset.type, title: $("#cTitle").value.trim(), desc: $("#cDesc").value.trim(), free: $("#cFree").checked, createdAt: serverTimestamp(), order: Date.now() };
      const ref = await addDoc(collection(db, "content"), data);
      await setDoc(doc(db, "links", ref.id), { url: $("#cUrl").value.trim() });
      toast("যোগ করা হয়েছে", "ok"); render();
    }
    if (f.id === "chapterForm") {
      const ref = await addDoc(collection(db, "chapters"), { bookId: f.dataset.book, no: parseInt($("#chNo").value, 10) || 1, title: $("#chTitle").value.trim(), free: $("#chFree").checked, createdAt: serverTimestamp() });
      await setDoc(doc(db, "chapterLinks", ref.id), { url: $("#chUrl").value.trim() });
      toast("চ্যাপ্টার যোগ হয়েছে", "ok"); render(); return;
    }
    if (f.id === "bookForm") {
      const data = { subject: $("#bSubject").value, title: $("#bTitle").value.trim(), author: $("#bAuthor").value.trim(), desc: $("#bDesc").value.trim(), cover: $("#bCover").value.trim(),
        price: Math.max(0, +$("#bPrice").value || 0), days: Math.max(1, parseInt($("#bDays").value, 10) || 365), createdAt: serverTimestamp(), order: Date.now() };
      await addDoc(collection(db, "books"), data);
      toast("বই তৈরি হয়েছে — এবার \"চ্যাপ্টার\" বাটনে চেপে চ্যাপ্টার যোগ করুন", "ok"); render(); return;
    }
    if (f.id === "payForm" && f.dataset.book) {
      const b = state.books.find((x) => x.id === f.dataset.book);
      await addDoc(collection(db, "payments"), {
        uid: state.user.uid, email: state.user.email, name: state.user.displayName || "",
        kind: "book", bookId: b.id, bookTitle: b.title, planId: "book", planName: "বই: " + b.title, amount: b.price, days: b.days,
        method: $("#pMethod").value, senderNumber: $("#pSender").value.trim(), trxId: $("#pTrx").value.trim(),
        status: "pending", createdAt: serverTimestamp(),
      });
      closeModal(); toast("জমা হয়েছে! অ্যাডমিন যাচাই করলে বইটি পড়তে পারবেন", "ok"); render(); return;
    }
    if (f.id === "payForm") {
      const plan = state.settings.plans.find((x) => x.id === f.dataset.plan);
      await addDoc(collection(db, "payments"), {
        uid: state.user.uid, email: state.user.email, name: state.user.displayName || "",
        planId: plan.id, planName: plan.name, amount: plan.price, days: plan.days,
        method: $("#pMethod").value, senderNumber: $("#pSender").value.trim(), trxId: $("#pTrx").value.trim(),
        status: "pending", createdAt: serverTimestamp(),
      });
      closeModal(); toast("জমা হয়েছে! অ্যাডমিন যাচাই করলে আপনার অ্যাকাউন্ট চালু হবে", "ok"); location.hash = "#/account";
    }
  } catch (er) { console.error(er); toast(errMsg(er), "err"); }
});

/* ============================================================
   Login background animation (live candlestick chart + floating symbols)
   ============================================================ */
const fx = (() => {
  const cv = document.createElement("canvas");
  cv.id = "bgfx"; cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CW = 12, STEP = 20, SYMS = ["৳", "%", "$", "+", "৳"];
  let W = 0, H = 0, raf = 0, running = false, off = 0, lo = 0, hi = 1, candles = [], syms = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  const nextCandle = (prev) => {
    const o = prev ? prev.c : 100, c = o + (Math.random() - 0.44) * 4;
    return { o, c, h: Math.max(o, c) + Math.random() * 2, l: Math.min(o, c) - Math.random() * 2 };
  };
  const newSym = (init) => ({ x: rnd(0, W), y: init ? rnd(0, H) : H + 20, s: rnd(14, 26), v: rnd(0.15, 0.45), a: rnd(0.06, 0.16), c: SYMS[(Math.random() * SYMS.length) | 0] });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    candles = [];
    for (let i = 0, n = Math.ceil(W / STEP) + 3; i < n; i++) candles.push(nextCandle(candles[i - 1]));
    lo = Math.min(...candles.map((c) => c.l)); hi = Math.max(...candles.map((c) => c.h));
    syms = Array.from({ length: Math.max(8, Math.round(W / 45)) }, () => newSym(true));
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = "center";
    for (const s of syms) {
      ctx.font = `${s.s}px 'Hind Siliguri', sans-serif`;
      ctx.fillStyle = `rgba(229,189,99,${s.a})`;
      ctx.fillText(s.c, s.x, s.y);
      if (!reduce) s.y -= s.v;
      if (s.y < -30) Object.assign(s, newSym(false));
    }
    let mn = Infinity, mx = -Infinity;
    for (const c of candles) { if (c.l < mn) mn = c.l; if (c.h > mx) mx = c.h; }
    lo += (mn - lo) * 0.05; hi += (mx - hi) * 0.05;
    const top = H * 0.42, bot = H * 0.92, y = (p) => bot - ((p - lo) / (hi - lo || 1)) * (bot - top);

    ctx.lineWidth = 1;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i], x = i * STEP - off + CW / 2, up = c.c >= c.o;
      ctx.strokeStyle = up ? "rgba(63,208,143,.32)" : "rgba(255,122,138,.28)";
      ctx.fillStyle = up ? "rgba(63,208,143,.20)" : "rgba(255,122,138,.18)";
      ctx.beginPath(); ctx.moveTo(x, y(c.h)); ctx.lineTo(x, y(c.l)); ctx.stroke();
      const yt = y(Math.max(c.o, c.c)), hh = Math.max(2, y(Math.min(c.o, c.c)) - yt);
      ctx.fillRect(x - CW / 2, yt, CW, hh); ctx.strokeRect(x - CW / 2, yt, CW, hh);
    }

    const avg = (i) => { let s = 0; for (let k = 0; k < 5; k++) s += candles[i - k].c; return s / 5; };
    ctx.beginPath();
    for (let i = 4; i < candles.length; i++) {
      const x = i * STEP - off + CW / 2;
      i === 4 ? ctx.moveTo(x, y(avg(i))) : ctx.lineTo(x, y(avg(i)));
    }
    ctx.strokeStyle = "rgba(229,189,99,.7)"; ctx.lineWidth = 2; ctx.stroke();

    const di = Math.min(candles.length - 1, Math.floor((W * 0.8 + off) / STEP));
    if (di >= 4) {
      const dx = di * STEP - off + CW / 2, dy = y(avg(di)), pulse = 1 + Math.sin((t || 0) / 400) * 0.5;
      ctx.fillStyle = "rgba(229,189,99,.18)"; ctx.beginPath(); ctx.arc(dx, dy, 9 * pulse, 0, 6.283); ctx.fill();
      ctx.fillStyle = "rgba(241,214,143,.95)"; ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, 6.283); ctx.fill();
    }

    if (!reduce) {
      off += 0.35;
      if (off >= STEP) { off -= STEP; candles.shift(); candles.push(nextCandle(candles[candles.length - 1])); }
    }
    if (running && !reduce) raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; resize(); frame(0); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  addEventListener("resize", () => { if (running) { resize(); if (reduce) frame(0); } });
  return { sync(on) { document.body.classList.toggle("on-login", on); on ? start() : stop(); } };
})();
const syncFx = () => fx.sync(route()[0] === "login");

/* ============================================================
   Boot
   ============================================================ */
await loadSettings();
onAuthStateChanged(auth, async (u) => {
  state.user = u;
  state.isAdmin = !!u && u.emailVerified && ADMIN_EMAILS.map((x) => x.toLowerCase()).includes((u.email || "").toLowerCase());
  state.sub = null; state.content = null; state.books = null; state.purchases = {};
  if (u) {
    try { await setDoc(doc(db, "users", u.uid), { name: u.displayName || "", email: u.email, photo: u.photoURL || "", lastLogin: serverTimestamp() }, { merge: true }); } catch (e) { console.warn(e); }
    state.sub = await loadSub();
    state.purchases = await loadPurchases();
  }
  render();
});
