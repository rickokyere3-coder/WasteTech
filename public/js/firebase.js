/* WasteTech login and database, on Firebase.
   - Login: Firebase Authentication (username + password; see USERNAME_DOMAIN in firebase-config.js).
   - Data: Cloud Firestore. Who can read and write what is set in firestore.rules.
   - The app (js/app.js) talks to the database through window.backend.use('db'|'user').
     This file answers those calls once someone has logged in. */
import { firebaseConfig, USERNAME_DOMAIN } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const APP = "WasteTech";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = s => { const d = new Date(s); return isNaN(d) ? "never" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const USER_RE = /^[A-Za-z0-9._-]{3,20}$/;
const toEmail = u => u.trim().toLowerCase() + "@" + USERNAME_DOMAIN;
const nameOf = user => (user && user.email ? user.email.split("@")[0] : "");

/* ---------- Login screen ---------- */
const appEl = document.querySelector(".app");
const gate = document.createElement("div");
gate.className = "auth"; gate.id = "authGate";
gate.setAttribute("role", "dialog"); gate.setAttribute("aria-modal", "true"); gate.setAttribute("aria-labelledby", "authTitle");
document.body.appendChild(gate);
const mark = document.querySelector(".logo-mark");
const brand = `<div class="auth-brand">${mark ? mark.outerHTML : ""}<b>${APP}</b></div>`;
const eye = id => `<button type="button" data-eye="${id}" aria-label="Show password">Show</button>`;
const keepBox = `<label class="check"><input type="checkbox" id="authRemember" checked>Keep me logged in on this device</label>`;

const chip = document.createElement("button");
chip.type = "button"; chip.className = "acct"; chip.id = "acctBtn"; chip.hidden = true; chip.setAttribute("aria-label", "Your account");
chip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg><span id="acctName"></span>';
const pill = $("#pill"); pill.parentNode.insertBefore(chip, pill.nextSibling);
chip.addEventListener("click", () => show("account"));

let auth = null, fs = null, me = null, isAdmin = false, bridged = false;
function lock() { appEl.inert = true; appEl.setAttribute("aria-hidden", "true"); gate.hidden = false; chip.hidden = true; }
function unlock() { appEl.inert = false; appEl.removeAttribute("aria-hidden"); gate.hidden = true; chip.hidden = false; $("#acctName").textContent = nameOf(me); }

function show(view, note) {
  lock();
  let h = "";
  if (view === "loading") h = `<h2 id="authTitle">Opening ${APP}…</h2><div class="spin" aria-hidden="true"></div>`;
  else if (view === "setup") h = `<h2 id="authTitle">Firebase is not set up yet</h2><p>Paste your Firebase project's settings into <b>public/js/firebase-config.js</b>, then deploy again. The README explains each step.</p>`;
  else if (view === "error") h = `<h2 id="authTitle">Could not connect</h2><p>Check your internet connection, then reload this page.</p>`;
  else if (view === "login") h = `<h2 id="authTitle">Log in to ${APP}</h2>
    <form id="authForm" data-mode="login" novalidate>
      <div class="f"><label for="authUser">Username</label><input type="text" id="authUser" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20"></div>
      <div class="f"><label for="authPass">Password</label><div class="pw"><input type="password" id="authPass" autocomplete="current-password" maxlength="128">${eye("authPass")}</div></div>
      ${keepBox}
      <button class="cta" type="submit">Log in</button>
      <p class="formmsg" id="authMsg" role="status"></p>
    </form>
    <button type="button" class="ghost" data-go="create">Create an account</button>
    <button type="button" class="linkbtn" data-go="forgot">Forgot password?</button>
    <div id="authHelp" class="help" hidden>Contact the ${APP} team. They can remove your old account so you can sign up again with the same username.</div>`;
  else if (view === "create") h = `<h2 id="authTitle">Create your ${APP} account</h2><p>Choose a username and password. You will use them each time you open ${APP}.</p>
    <form id="authForm" data-mode="create" novalidate>
      <div class="f"><label for="authUser">Username</label><input type="text" id="authUser" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="e.g. kwame_a"><small>3 to 20 letters, numbers, dots, dashes or underscores.</small></div>
      <div class="f"><label for="authPass">Password</label><div class="pw"><input type="password" id="authPass" autocomplete="new-password" maxlength="128">${eye("authPass")}</div><small>At least 8 characters.</small></div>
      <div class="f"><label for="authPass2">Confirm password</label><div class="pw"><input type="password" id="authPass2" autocomplete="new-password" maxlength="128">${eye("authPass2")}</div></div>
      ${keepBox}
      <button class="cta" type="submit">Create account</button>
      <p class="formmsg" id="authMsg" role="status"></p>
    </form>
    <button type="button" class="ghost" data-go="login">I already have an account</button>`;
  else if (view === "account") h = `<h2 id="authTitle">Your account</h2><p>Logged in as</p><div class="who">@${esc(nameOf(me))}</div>
    <div class="stack"><button type="button" class="cta" data-go="back">Back to ${APP}</button>
    <button type="button" class="ghost" data-go="change">Change password</button>
    <button type="button" class="ghost danger" data-go="logout">Log out</button></div>`;
  else if (view === "change") h = `<h2 id="authTitle">Change password</h2>
    <form id="authForm" data-mode="change" novalidate>
      <div class="f"><label for="authCur">Current password</label><div class="pw"><input type="password" id="authCur" autocomplete="current-password" maxlength="128">${eye("authCur")}</div></div>
      <div class="f"><label for="authPass">New password</label><div class="pw"><input type="password" id="authPass" autocomplete="new-password" maxlength="128">${eye("authPass")}</div><small>At least 8 characters.</small></div>
      <div class="f"><label for="authPass2">Confirm new password</label><div class="pw"><input type="password" id="authPass2" autocomplete="new-password" maxlength="128">${eye("authPass2")}</div></div>
      <button class="cta" type="submit">Save new password</button>
      <p class="formmsg" id="authMsg" role="status"></p>
    </form><button type="button" class="ghost" data-go="back">Cancel</button>`;
  gate.innerHTML = `<div class="auth-card">${brand}${h}</div>`;
  if (note) msg(note[0], note[1]);
  const first = gate.querySelector("input[type=text],input[type=password]"); if (first) setTimeout(() => first.focus(), 30);
}
function msg(t, k) { const m = $("#authMsg"); if (m) { m.textContent = t; m.className = "formmsg " + (k || ""); } }
function busy(on, label) { const b = gate.querySelector("#authForm .cta"); if (b) { b.disabled = on; if (label) b.textContent = label; } }
function authError(e) {
  const c = (e && e.code) || "";
  if (c === "auth/email-already-in-use") return "That username is already taken. Choose another one.";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-email") return "Wrong username or password.";
  if (c === "auth/weak-password") return "That password is too weak. Use at least 8 characters.";
  if (c === "auth/too-many-requests") return "Too many tries. Wait a few minutes, then try again.";
  if (c === "auth/network-request-failed") return "No connection. Check your internet and try again.";
  if (c === "auth/operation-not-allowed") return "Username and password login is switched off. Turn on Email/Password in Firebase Authentication.";
  return "Something went wrong. Try again.";
}
function checkNewPw(pw, pw2, name) {
  if (pw.length < 8) return "Use a password with at least 8 characters.";
  if (name && pw.toLowerCase() === name.toLowerCase()) return "Your password cannot be the same as your username.";
  if (pw !== pw2) return "The two passwords do not match.";
  return "";
}

gate.addEventListener("click", async e => {
  const eyeBtn = e.target.closest("[data-eye]");
  if (eyeBtn) { const i = document.getElementById(eyeBtn.dataset.eye); const vis = i.type === "password"; i.type = vis ? "text" : "password"; eyeBtn.textContent = vis ? "Hide" : "Show"; eyeBtn.setAttribute("aria-label", vis ? "Hide password" : "Show password"); return; }
  const b = e.target.closest("[data-go]"); if (!b) return;
  const go = b.dataset.go;
  if (go === "forgot") { const h = $("#authHelp"); h.hidden = !h.hidden; }
  else if (go === "create" || go === "login" || go === "change") show(go);
  else if (go === "back") unlock();
  else if (go === "logout") { await signOut(auth); location.reload(); }
});

gate.addEventListener("submit", async e => {
  e.preventDefault();
  const mode = e.target.dataset.mode;
  const name = (($("#authUser") || {}).value || "").trim(), pw = ($("#authPass") || {}).value || "", pw2 = ($("#authPass2") || {}).value || "";
  const keep = !!($("#authRemember") && $("#authRemember").checked);
  try {
    if (mode === "create") {
      if (!USER_RE.test(name)) return msg("Choose a username of 3 to 20 letters, numbers, dots, dashes or underscores.", "err");
      const bad = checkNewPw(pw, pw2, name); if (bad) return msg(bad, "err");
      busy(true, "Creating account…");
      await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
      await createUserWithEmailAndPassword(auth, toEmail(name), pw);
    } else if (mode === "login") {
      if (!name || !pw) return msg("Enter your username and password.", "err");
      busy(true, "Checking…");
      await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, toEmail(name), pw);
    } else if (mode === "change") {
      const cur = ($("#authCur") || {}).value || "";
      const bad = checkNewPw(pw, pw2, nameOf(me)); if (bad) return msg(bad, "err");
      busy(true, "Saving…");
      await reauthenticateWithCredential(me, EmailAuthProvider.credential(me.email, cur));
      await updatePassword(me, pw);
      show("account");
      const w = gate.querySelector(".who"); if (w) w.insertAdjacentHTML("afterend", '<p class="formmsg ok" role="status">Password changed.</p>');
    }
  } catch (err) {
    busy(false, mode === "create" ? "Create account" : mode === "login" ? "Log in" : "Save new password");
    if (mode === "change" && /invalid-credential|wrong-password/.test((err && err.code) || "")) return msg("Your current password is not right.", "err");
    msg(authError(err), "err");
  }
});

/* ---------- Database bridge used by js/app.js ---------- */
const CODE = { "permission-denied": "invalid_argument", "resource-exhausted": "quota_exceeded", "unavailable": "unavailable" };
const wrapErr = e => { const x = new Error(e && e.message); x.code = CODE[e && e.code] || (e && e.code) || "unavailable"; return x; };
const wrapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: { hasPendingWrites: s.metadata.hasPendingWrites } });
const guard = p => p.catch(e => { throw wrapErr(e); });
const dbApi = {
  doc(path) {
    const ref = doc(fs, path);
    return {
      id: ref.id,
      get: () => guard(getDoc(ref)).then(wrapDoc),
      set: data => guard(setDoc(ref, data)),
      update: data => guard(updateDoc(ref, data)),
      delete: () => guard(deleteDoc(ref)),
      onSnapshot: (cb, err) => onSnapshot(ref, s => cb(wrapDoc(s)), e => err && err(wrapErr(e)))
    };
  },
  collection(path) {
    const ref = collection(fs, path);
    return { onSnapshot: (cb, err) => onSnapshot(ref, s => cb({ docs: s.docs.map(wrapDoc) }), e => err && err(wrapErr(e))) };
  }
};
const userApi = { id: async () => me && me.uid, canEdit: async () => isAdmin, isOwner: async () => isAdmin };

/* ---------- Admin: list of accounts ---------- */
function adminAccounts() {
  const host = document.querySelector("#adminView .view-inner"); if (!host || $("#acctAdmin")) return;
  const s = document.createElement("section"); s.className = "card"; s.id = "acctAdmin";
  s.innerHTML = `<div class="adm-head"><h2>App accounts</h2><span id="acctCount"></span></div>
    <p class="lede">Everyone who has created a ${APP} username. If someone forgets their password, delete their account in the Firebase console (Authentication → Users), then they can sign up again with the same username.</p>
    <div id="acctList"><p class="muted">Loading accounts…</p></div>`;
  host.appendChild(s);
  onSnapshot(collection(fs, "users"), snap => {
    const rows = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.lastLoginAt || "").localeCompare(String(a.lastLoginAt || "")));
    $("#acctCount").textContent = rows.length + (rows.length === 1 ? " account" : " accounts");
    $("#acctList").innerHTML = rows.length ? rows.map(a => `<article class="app-row"><div class="app-main"><b class="mono">@${esc(a.username || "unknown")}</b>${a.id === me.uid ? '<span class="status approved">You</span>' : ""}
      <div class="muted">Created ${esc(fmt(a.createdAt))} · last login ${esc(fmt(a.lastLoginAt))}</div></div></article>`).join("")
      : '<p class="muted">No accounts yet.</p>';
  }, () => { $("#acctList").innerHTML = '<p class="muted">Could not load accounts.</p>'; });
}

/* ---------- Start ---------- */
let wasIn = false;
async function start() {
  show("loading");
  if (!firebaseConfig.apiKey || /PASTE/.test(firebaseConfig.apiKey)) return show("setup");
  try {
    const fb = initializeApp(firebaseConfig);
    auth = getAuth(fb); fs = getFirestore(fb);
  } catch (e) { return show("error"); }
  onAuthStateChanged(auth, async user => {
    if (!user) { if (wasIn) location.reload(); else show("login"); return; }
    wasIn = true; me = user;
    try { isAdmin = (await getDoc(doc(fs, "admins", user.uid))).exists(); } catch (e) { isAdmin = false; }
    setDoc(doc(fs, "users", user.uid), {
      username: nameOf(user),
      createdAt: new Date(user.metadata.creationTime || Date.now()).toISOString(),
      lastLoginAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
    unlock();
    if (!bridged) { bridged = true; window.__backendReady({ db: dbApi, user: userApi }); }
    if (isAdmin) adminAccounts();
  });
}
start();
