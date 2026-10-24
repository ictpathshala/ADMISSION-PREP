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
  { id: "video", name: "ভিডিও", add: "ভিডিও" },
  { id: "slide", name: "স্লাইড", add: "স্লাইড" },
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
  content: null, // cache of all content docs
  adminTab: "overview", subjTab: {}, adminType: "video",
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
    <p>ভিডিও ক্লাস, স্লাইড আর PDF নোট — বাংলা, ইংলিশ, হিসাববিজ্ঞান, ব্যবস্থাপনা, ফিনান্স সহ সব বিষয়ে গোছানো কনটেন্ট।</p>
    <div class="cta">
      <a class="btn primary" href="${state.user ? "#/subject/bangla" : "#/login"}">${state.user ? "পড়া শুরু করুন" : "ফ্রিতে শুরু করুন"}</a>
      <a class="btn" href="#/pricing">${subOn ? "প্ল্যান দেখুন" : "বিস্তারিত"}</a>
    </div>
    <div class="stats">
      <div class="stat"><b>${bn(SUBJECTS.length)}টি</b><span>বিষয়</span></div>
      <div class="stat"><b>ভিডিও</b><span>রেকর্ডেড ক্লাস</span></div>
      <div class="stat"><b>স্লাইড</b><span>সহজ উপস্থাপনা</span></div>
      <div class="stat"><b>PDF</b><span>নোট ও প্রশ্নব্যাংক</span></div>
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
  const all = await loadContent();
  const tab = state.subjTab[id] || "video";
  const items = all.filter((c) => c.subject === id && c.type === tab);
  return `<div class="wrap section">
    <a href="#/" class="muted small">← সব বিষয়</a>
    <h2 style="margin-top:8px">${esc(s.name)} <span class="muted" style="font-size:1rem">${esc(s.en)}</span></h2>
    <div class="tabs">${TYPES.map((t) => `<button class="${tab === t.id ? "on" : ""}" data-act="subjTab" data-subj="${id}" data-type="${t.id}">${t.name}</button>`).join("")}</div>
    ${items.length ? `<div class="grid">${items.map(contentCard).join("")}</div>`
      : `<div class="empty">এই বিভাগে এখনো কিছু যোগ করা হয়নি</div>`}
  </div>`;
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

async function pricingView() {
  const s = state.settings;
  if (!s.subscriptionEnabled) {
    return `<div class="wrap section"><div class="card center" style="max-width:560px;margin:50px auto">
      <div style="font-size:2.4rem">🎁</div>
      <h2 style="margin:8px 0">এখন সব কনটেন্ট ফ্রি!</h2>
      <p class="muted">বর্তমানে কোনো সাবস্ক্রিপশন লাগছে না। লগইন করে সব ভিডিও, স্লাইড ও PDF দেখুন।</p>
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
  return `<div class="wrap section">
    <div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      ${u.photoURL ? `<img class="avatar" style="width:60px;height:60px" src="${esc(u.photoURL)}" alt="">` : `<div class="logo" style="width:60px;height:60px">${esc((u.displayName || u.email)[0].toUpperCase())}</div>`}
      <div style="flex:1"><h3>${esc(u.displayName || "ব্যবহারকারী")}</h3><div class="muted">${esc(u.email)}</div></div>
      <div>${state.settings.subscriptionEnabled
        ? (subActive() ? `<span class="badge approved">সক্রিয় · ${fmtDate(state.sub.expiresAt)} পর্যন্ত</span>` : `<span class="badge lock">সাবস্ক্রিপশন নেই</span>`)
        : `<span class="badge free">সব ফ্রি</span>`}</div>
    </div>
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
  const tabs = [["overview", "ওভারভিউ"], ["payments", "পেমেন্ট"], ["content", "কনটেন্ট"], ["settings", "সাবস্ক্রিপশন ও সেটিংস"], ["users", "ইউজার"]];
  let inner = "";
  if (tab === "overview") inner = await adminOverview();
  if (tab === "payments") inner = await adminPayments();
  if (tab === "content") inner = await adminContent();
  if (tab === "settings") inner = adminSettings();
  if (tab === "users") inner = await adminUsers();
  return `<div class="wrap section"><h2>অ্যাডমিন ড্যাশবোর্ড</h2>
    <div class="tabs" style="margin-top:12px">${tabs.map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-act="adminTab" data-tab="${id}">${n}</button>`).join("")}</div>
    ${inner}</div>`;
}
async function adminOverview() {
  const [users, pays, content] = await Promise.all([getDocs(collection(db, "users")), getDocs(collection(db, "payments")), loadContent(true)]);
  const pend = pays.docs.filter((d) => d.data().status === "pending").length;
  const rev = pays.docs.filter((d) => d.data().status === "approved").reduce((a, d) => a + (d.data().amount || 0), 0);
  const cnt = (t) => content.filter((c) => c.type === t).length;
  return `<div class="stats" style="margin-top:0">
    <div class="stat"><b>${bn(users.size)}</b><span>মোট ইউজার</span></div>
    <div class="stat"><b>${bn(pend)}</b><span>অপেক্ষমাণ পেমেন্ট</span></div>
    <div class="stat"><b>৳${bn(rev)}</b><span>মোট আয়</span></div>
    <div class="stat"><b>${bn(cnt("video"))}</b><span>ভিডিও</span></div>
    <div class="stat"><b>${bn(cnt("slide"))}</b><span>স্লাইড</span></div>
    <div class="stat"><b>${bn(cnt("pdf"))}</b><span>PDF</span></div>
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
  const hint = { video: "YouTube (Unlisted) লিংক বা Google Drive ভিডিও লিংক", slide: "Google Slides বা Drive লিংক (Anyone with link → Viewer)", pdf: "Google Drive PDF লিংক (Anyone with link → Viewer)" }[t];
  return `<div class="tabs">${TYPES.map((x) => `<button class="${t === x.id ? "on" : ""}" data-act="adminType" data-type="${x.id}">${x.name}</button>`).join("")}</div>
  <div class="card" style="margin-bottom:18px"><h3>নতুন ${tn.add} যোগ করুন</h3>
    <form id="contentForm" data-type="${t}">
      <div class="row">
        <div><label>বিষয়</label><select id="cSubject">${SUBJECTS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
        <div><label>শিরোনাম</label><input id="cTitle" required placeholder="যেমন: অধ্যায় 1 — ভূমিকা"></div>
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
    const plan = state.settings.plans.find((x) => x.id === p.planId);
    const days = plan?.days || p.days || 30;
    await grantDays(p.uid, days, p.planName);
    await setDoc(ref, { status: "approved", reviewedAt: serverTimestamp() }, { merge: true });
    toast("অনুমোদন করা হয়েছে", "ok"); render();
  },
  async reject(e, el) {
    await setDoc(doc(db, "payments", el.dataset.id), { status: "rejected", reviewedAt: serverTimestamp() }, { merge: true });
    toast("বাতিল করা হয়েছে"); render();
  },
  adminTab(e, el) { state.adminTab = el.dataset.tab; render(); },
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
  state.sub = null; state.content = null;
  if (u) {
    try { await setDoc(doc(db, "users", u.uid), { name: u.displayName || "", email: u.email, photo: u.photoURL || "", lastLogin: serverTimestamp() }, { merge: true }); } catch (e) { console.warn(e); }
    state.sub = await loadSub();
  }
  render();
});
