/* =========================================================================
   Bharath Bank of India — client-side data layer
   Runs identically in the browser (Netlify) and inside Electron (desktop).
   Data is persisted in localStorage. This is a DEMO — no real money, and the
   password hashing here is intentionally lightweight (client-side only).
   ========================================================================= */
(function (global) {
  "use strict";

  const BANK = {
    NAME: "Bharath Bank of India",
    SHORT: "BBI",
    IFSC: "BBIN0001729",
    BRANCH: "Bharath Nagar Main Branch, Hyderabad",
  };

  const USERS_KEY = "bbi_users";
  const TXNS_KEY = "bbi_txns";
  const SESSION_KEY = "bbi_session";

  // ---- storage helpers ---------------------------------------------------
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function users() { return load(USERS_KEY); }
  function txns() { return load(TXNS_KEY); }

  // ---- money -------------------------------------------------------------
  function rupeesToPaise(value) {
    const n = Math.round(parseFloat(value) * 100);
    if (!isFinite(n) || n <= 0) throw new Error("Amount must be greater than zero.");
    return n;
  }

  function fmtINR(paise) {
    paise = Math.round(paise);
    const sign = paise < 0 ? "-" : "";
    paise = Math.abs(paise);
    const whole = Math.floor(paise / 100).toString();
    const frac = String(paise % 100).padStart(2, "0");
    let grouped;
    if (whole.length > 3) {
      const last3 = whole.slice(-3);
      let rest = whole.slice(0, -3);
      const parts = [];
      while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
      if (rest) parts.unshift(rest);
      grouped = parts.join(",") + "," + last3;
    } else {
      grouped = whole;
    }
    return sign + "₹" + grouped + "." + frac;
  }

  // ---- misc helpers ------------------------------------------------------
  function nowStr() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function rand(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function genAccountNumber() {
    const existing = new Set(users().map((u) => u.accountNumber));
    let num;
    do { num = "1729" + rand(8); } while (existing.has(num));
    return num;
  }

  function genRef() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    const ymd = String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
    return "BBI" + ymd + rand(6);
  }

  // Lightweight, NON-cryptographic hash — demo only.
  function hash(pw) {
    let h = 5381;
    for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) | 0;
    return "h" + (h >>> 0).toString(16);
  }

  // ---- auth --------------------------------------------------------------
  function register({ fullName, email, phone, password, accountType, openingBalance }) {
    fullName = (fullName || "").trim();
    email = (email || "").trim().toLowerCase();
    phone = (phone || "").trim();
    if (!fullName || !email || !phone || !password) throw new Error("All fields are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const all = users();
    if (all.some((u) => u.email === email)) throw new Error("An account with that email already exists.");

    let openingPaise = 0;
    const ob = parseFloat(openingBalance);
    if (openingBalance !== "" && openingBalance != null) {
      if (isNaN(ob) || ob < 0) throw new Error("Opening balance must be a valid non-negative amount.");
      openingPaise = Math.round(ob * 100);
    }

    const user = {
      id: (all.reduce((m, u) => Math.max(m, u.id), 0) || 0) + 1,
      fullName, email, phone,
      passwordHash: hash(password),
      accountNumber: genAccountNumber(),
      accountType: accountType || "Savings",
      ifsc: BANK.IFSC,
      balancePaise: openingPaise,
      status: "ACTIVE",
      createdAt: nowStr(),
    };
    all.push(user);
    save(USERS_KEY, all);

    if (openingPaise > 0) {
      addTxn(user.accountNumber, "CREDIT", openingPaise, openingPaise,
             "DEPOSIT", "Opening deposit", "Self", genRef());
    }
    localStorage.setItem(SESSION_KEY, email);
    return user;
  }

  function login(email, password) {
    email = (email || "").trim().toLowerCase();
    const user = users().find((u) => u.email === email);
    if (!user || user.passwordHash !== hash(password)) throw new Error("Invalid email or password.");
    localStorage.setItem(SESSION_KEY, email);
    return user;
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }

  function currentUser() {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    return users().find((u) => u.email === email) || null;
  }

  function saveUser(updated) {
    const all = users();
    const i = all.findIndex((u) => u.id === updated.id);
    if (i >= 0) { all[i] = updated; save(USERS_KEY, all); }
  }

  // ---- ledger ------------------------------------------------------------
  function addTxn(accountNumber, type, amountPaise, balancePaise, category, description, counterparty, ref) {
    const all = txns();
    all.push({
      id: (all.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1,
      accountNumber, txnType: type, amountPaise, balancePaise,
      category, description, counterparty, ref, createdAt: nowStr(),
    });
    save(TXNS_KEY, all);
  }

  function txnsFor(accountNumber, filter) {
    let list = txns().filter((t) => t.accountNumber === accountNumber);
    if (filter === "CREDIT" || filter === "DEBIT") list = list.filter((t) => t.txnType === filter);
    return list.sort((a, b) => b.id - a.id);
  }

  function deposit(amountRupees, description) {
    const user = requireUser();
    const amt = rupeesToPaise(amountRupees);
    user.balancePaise += amt;
    saveUser(user);
    addTxn(user.accountNumber, "CREDIT", amt, user.balancePaise, "DEPOSIT",
           description || "Cash deposit", "Self", genRef());
    return amt;
  }

  function withdraw(amountRupees, description) {
    const user = requireUser();
    const amt = rupeesToPaise(amountRupees);
    if (amt > user.balancePaise) throw new Error("Insufficient balance for this withdrawal.");
    user.balancePaise -= amt;
    saveUser(user);
    addTxn(user.accountNumber, "DEBIT", amt, user.balancePaise, "WITHDRAWAL",
           description || "Cash withdrawal", "Self", genRef());
    return amt;
  }

  function transfer(toAccount, amountRupees, description) {
    const sender = requireUser();
    const amt = rupeesToPaise(amountRupees);
    toAccount = (toAccount || "").trim();

    const all = users();
    const payee = all.find((u) => u.accountNumber === toAccount);
    if (!payee) throw new Error("Payee account number not found in " + BANK.NAME + ".");
    if (payee.id === sender.id) throw new Error("You cannot transfer money to your own account.");
    if (amt > sender.balancePaise) throw new Error("Insufficient balance for this transfer.");

    const ref = genRef();
    const desc = description || "Fund transfer";

    sender.balancePaise -= amt;
    payee.balancePaise += amt;
    // persist both
    const si = all.findIndex((u) => u.id === sender.id);
    const pi = all.findIndex((u) => u.id === payee.id);
    all[si] = sender; all[pi] = payee;
    save(USERS_KEY, all);

    addTxn(sender.accountNumber, "DEBIT", amt, sender.balancePaise, "TRANSFER",
           `To ${payee.fullName} — ${desc}`, payee.accountNumber, ref);
    addTxn(payee.accountNumber, "CREDIT", amt, payee.balancePaise, "TRANSFER",
           `From ${sender.fullName} — ${desc}`, sender.accountNumber, ref);
    return { amount: amt, payee: payee.fullName, ref };
  }

  function requireUser() {
    const u = currentUser();
    if (!u) throw new Error("You are not logged in.");
    return u;
  }

  // ---- expose ------------------------------------------------------------
  global.Bank = {
    BANK, fmtINR,
    register, login, logout, currentUser,
    deposit, withdraw, transfer, txnsFor,
  };
})(window);
