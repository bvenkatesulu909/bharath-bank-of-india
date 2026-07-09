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

  // ======================================================================
  //  Financial mathematics — mirrors finance.py (all money in paise)
  // ======================================================================
  function fdMaturityPaise(principalPaise, ratePct, tenureMonths) {
    const quarters = tenureMonths / 3.0;                 // r/4% per quarter
    return Math.round(principalPaise * Math.pow(1 + ratePct / 400, quarters));
  }
  function rdMonthlyRate(ratePct) {                        // monthly effective rate
    return Math.pow(1 + ratePct / 400, 1 / 3) - 1;
  }
  function rdMaturityPaise(installmentPaise, ratePct, tenureMonths) {
    const n = Math.trunc(tenureMonths);
    const i = rdMonthlyRate(ratePct);
    if (i === 0) return installmentPaise * n;
    const factor = (1 + i) * (Math.pow(1 + i, n) - 1) / i;
    return Math.round(installmentPaise * factor);
  }
  function loanEmiPaise(principalPaise, ratePct, tenureMonths) {
    const n = Math.trunc(tenureMonths);
    const i = ratePct / 1200.0;                            // monthly rate
    if (n <= 0) throw new Error("Tenure must be at least one month.");
    if (i === 0) return Math.round(principalPaise / n);
    const x = Math.pow(1 + i, n);
    return Math.round(principalPaise * i * x / (x - 1));
  }
  function emiSplit(outstandingPaise, ratePct, emiPaise) {
    const i = ratePct / 1200.0;
    const interest = Math.round(outstandingPaise * i);
    let principal = emiPaise - interest;
    let pay;
    if (principal >= outstandingPaise) {                   // final (or over-) payment
      principal = outstandingPaise;
      pay = interest + principal;
    } else {
      pay = emiPaise;
    }
    return { interest, principal, pay, newOutstanding: outstandingPaise - principal };
  }
  function amortizationSchedule(principalPaise, ratePct, tenureMonths, emiPaise) {
    if (emiPaise == null) emiPaise = loanEmiPaise(principalPaise, ratePct, tenureMonths);
    let outstanding = Math.trunc(principalPaise);
    const rows = [];
    for (let k = 1; k <= Math.trunc(tenureMonths); k++) {
      const s = emiSplit(outstanding, ratePct, emiPaise);
      outstanding = s.newOutstanding;
      rows.push({
        emiNo: k, emiPaise: s.pay, interestPaise: s.interest,
        principalPaise: s.principal, outstandingPaise: outstanding,
      });
      if (outstanding <= 0) break;
    }
    return rows;
  }
  function loanTotals(principalPaise, ratePct, tenureMonths) {
    const emi = loanEmiPaise(principalPaise, ratePct, tenureMonths);
    const schedule = amortizationSchedule(principalPaise, ratePct, tenureMonths, emi);
    const totalPayable = schedule.reduce((m, r) => m + r.emiPaise, 0);
    return { emi, totalPayable, totalInterest: totalPayable - Math.trunc(principalPaise) };
  }
  function addMonths(dateStr, months) {
    const d = (dateStr instanceof Date) ? dateStr
            : new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    const monthIndex = d.getMonth() + Math.trunc(months);
    const year = d.getFullYear() + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;           // 0-based target month
    const leap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
    const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const day = Math.min(d.getDate(), dim[month]);
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function todayStr() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ======================================================================
  //  Reference catalogues — mirror the Flask seed data
  // ======================================================================
  const SCHEMES = [
    { code: "FD-REG", name: "Bharath Fixed Deposit", category: "FD", rate: 7.00,
      minMonths: 6, maxMonths: 120, minAmountPaise: 100000, openable: true,
      description: "Lock in a lump sum and earn a guaranteed return with quarterly compounding.",
      highlight: "Most popular" },
    { code: "FD-SENIOR", name: "Senior Citizen Fixed Deposit", category: "FD", rate: 7.50,
      minMonths: 6, maxMonths: 120, minAmountPaise: 100000, openable: true,
      description: "An extra 0.50% p.a. for account holders aged 60 and above.",
      highlight: "+0.50% p.a." },
    { code: "FD-TAX", name: "Bharath Tax Saver FD (5 years)", category: "FD", rate: 7.25,
      minMonths: 60, maxMonths: 60, minAmountPaise: 100000, openable: true,
      description: "5-year lock-in fixed deposit eligible for tax deduction under Sec 80C.",
      highlight: "Tax benefit" },
    { code: "RD-REG", name: "Bharath Recurring Deposit", category: "RD", rate: 6.50,
      minMonths: 12, maxMonths: 60, minAmountPaise: 50000, openable: true,
      description: "Invest a fixed amount every month and build a corpus over time.",
      highlight: "Save monthly" },
    { code: "SAV-REG", name: "Bharath Savings Account", category: "SAVINGS", rate: 3.50,
      minMonths: null, maxMonths: null, minAmountPaise: 0, openable: false,
      description: "Everyday savings account with instant transfers and no minimum balance.",
      highlight: "Zero balance" },
    { code: "PPF", name: "Bharath Public Provident Fund", category: "GOVT", rate: 7.10,
      minMonths: 180, maxMonths: 180, minAmountPaise: 50000, openable: false,
      description: "15-year government-backed long-term savings with tax-free interest.",
      highlight: "Govt backed" },
    { code: "SCSS", name: "Senior Citizen Savings Scheme", category: "GOVT", rate: 8.20,
      minMonths: 60, maxMonths: 60, minAmountPaise: 100000, openable: false,
      description: "Government scheme offering high assured returns for senior citizens.",
      highlight: "8.20% p.a." },
  ];

  const LOAN_PRODUCTS = [
    { code: "LN-PERSONAL", name: "Personal Loan", rate: 11.50,
      minAmountPaise: 5000000, maxAmountPaise: 200000000, maxTenureMonths: 60,
      processingFeePct: 1.50,
      description: "Instant funds for any personal need — no collateral required." },
    { code: "LN-HOME", name: "Home Loan", rate: 8.50,
      minAmountPaise: 50000000, maxAmountPaise: 10000000000, maxTenureMonths: 360,
      processingFeePct: 0.50,
      description: "Own your dream home with long tenures and low interest rates." },
    { code: "LN-VEHICLE", name: "Vehicle Loan", rate: 9.50,
      minAmountPaise: 10000000, maxAmountPaise: 5000000000, maxTenureMonths: 84,
      processingFeePct: 1.00,
      description: "Finance a new or used car / two-wheeler at attractive rates." },
    { code: "LN-EDU", name: "Education Loan", rate: 9.00,
      minAmountPaise: 5000000, maxAmountPaise: 4000000000, maxTenureMonths: 120,
      processingFeePct: 0.50,
      description: "Fund higher studies in India or abroad with a flexible repayment plan." },
    { code: "LN-GOLD", name: "Gold Loan", rate: 8.00,
      minAmountPaise: 1000000, maxAmountPaise: 2500000000, maxTenureMonths: 36,
      processingFeePct: 0.75,
      description: "Quick loan against your gold with same-day disbursal." },
  ];

  // ======================================================================
  //  Storage for deposits / loans / loan-payments / KYC profiles
  // ======================================================================
  const DEPOSITS_KEY = "bbi_deposits";
  const LOANS_KEY = "bbi_loans";
  const LOAN_PAY_KEY = "bbi_loan_payments";
  const PROFILES_KEY = "bbi_profiles";

  function deposits() { return load(DEPOSITS_KEY); }
  function loans() { return load(LOANS_KEY); }
  function loanPayments() { return load(LOAN_PAY_KEY); }
  function profiles() { return load(PROFILES_KEY); }
  function nextId(arr) { return (arr.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1; }

  // Apply one ledger entry to the logged-in user and update their balance.
  function postTxn(user, type, amountPaise, category, description, counterparty, ref) {
    user.balancePaise = type === "CREDIT"
      ? user.balancePaise + amountPaise
      : user.balancePaise - amountPaise;
    saveUser(user);
    addTxn(user.accountNumber, type, amountPaise, user.balancePaise,
           category, description, counterparty || "", ref || genRef());
    return user.balancePaise;
  }

  // ---- KYC / customer profile -------------------------------------------
  function getProfile(userId) {
    if (userId == null) { const u = currentUser(); if (!u) return null; userId = u.id; }
    return profiles().find((p) => p.userId === userId) || null;
  }

  function saveKyc(fields) {
    const user = requireUser();
    let incomePaise = null;
    const raw = (fields.annualIncome != null ? String(fields.annualIncome) : "").trim();
    if (raw !== "") {
      const v = parseFloat(raw);
      if (isNaN(v) || v < 0) throw new Error("Annual income must be a valid amount.");
      incomePaise = Math.round(v * 100);
    }
    const aadhaarRaw = (fields.aadhaar || "").trim();
    const rec = {
      userId: user.id,
      dob: (fields.dob || "").trim(),
      gender: (fields.gender || "").trim(),
      address: (fields.address || "").trim(),
      city: (fields.city || "").trim(),
      state: (fields.state || "").trim(),
      pincode: (fields.pincode || "").trim(),
      pan: (fields.pan || "").trim().toUpperCase(),
      aadhaarLast4: aadhaarRaw ? aadhaarRaw.slice(-4) : "",   // only last 4 stored
      occupation: (fields.occupation || "").trim(),
      annualIncomePaise: incomePaise,
      nomineeName: (fields.nomineeName || "").trim(),
      nomineeRelation: (fields.nomineeRelation || "").trim(),
    };
    // KYC is VERIFIED once the core identity fields are present.
    const verified = !!(rec.dob && rec.address && rec.pan && rec.aadhaarLast4 && rec.annualIncomePaise);
    rec.kycStatus = verified ? "VERIFIED" : "PENDING";
    rec.updatedAt = nowStr();

    const all = profiles();
    const i = all.findIndex((p) => p.userId === user.id);
    if (i >= 0) all[i] = rec; else all.push(rec);
    save(PROFILES_KEY, all);
    return rec;
  }

  // ---- Deposits (FD / RD) -----------------------------------------------
  function resolveScheme(codeOrType) {
    let s = SCHEMES.find((x) => x.code === codeOrType);
    if (!s) {
      const t = String(codeOrType || "").toUpperCase();
      s = SCHEMES.find((x) => x.openable && x.category === t);   // 'FD' / 'RD' fallback
    }
    return s || null;
  }

  function depositsFor(userId, status) {
    if (userId == null) { userId = requireUser().id; }
    let list = deposits().filter((d) => d.userId === userId);
    if (status) list = list.filter((d) => d.status === status);
    return list.sort((a, b) => b.id - a.id);
  }

  function openDeposit(schemeCode, amountRupees, tenureMonths) {
    const user = requireUser();
    const scheme = resolveScheme(schemeCode);
    if (!scheme || !scheme.openable) throw new Error("Please choose a valid scheme.");
    const amount = rupeesToPaise(amountRupees);
    const tenure = parseInt(tenureMonths, 10);
    if (!isFinite(tenure) || tenure <= 0) throw new Error("Enter a valid whole number of months.");

    if ((scheme.minMonths && tenure < scheme.minMonths) ||
        (scheme.maxMonths && tenure > scheme.maxMonths))
      throw new Error(`Tenure for ${scheme.name} must be ${scheme.minMonths}–${scheme.maxMonths} months.`);
    if (scheme.minAmountPaise && amount < scheme.minAmountPaise)
      throw new Error(`Minimum for ${scheme.name} is ${fmtINR(scheme.minAmountPaise)}` +
                      `${scheme.category === "RD" ? " per month" : ""}.`);
    if (amount > user.balancePaise) throw new Error("Insufficient balance in your savings account.");

    const depType = scheme.category;               // FD or RD
    const rate = scheme.rate;
    let maturity, totalInvested, installmentsPaid;
    if (depType === "FD") {
      maturity = fdMaturityPaise(amount, rate, tenure);
      totalInvested = amount;
      installmentsPaid = 0;
    } else {                                        // RD — debit first installment now
      maturity = rdMaturityPaise(amount, rate, tenure);
      totalInvested = amount * tenure;
      installmentsPaid = 1;
    }
    const interest = maturity - totalInvested;
    const start = todayStr();
    const maturityDate = addMonths(start, tenure);
    const ref = genRef();

    postTxn(user, "DEBIT", amount, depType, `${scheme.name} (${depType}) opened`, "Deposit", ref);

    const all = deposits();
    const rec = {
      id: nextId(all), userId: user.id, depositType: depType,
      schemeCode: scheme.code, schemeName: scheme.name,
      principalPaise: amount, interestRate: rate, tenureMonths: tenure,
      maturityPaise: maturity, totalInvestedPaise: totalInvested, interestPaise: interest,
      installmentsPaid, startDate: start, maturityDate, status: "ACTIVE", refNo: ref,
    };
    all.push(rec);
    save(DEPOSITS_KEY, all);
    return rec;
  }

  function payInstallment(depId) {
    const user = requireUser();
    const all = deposits();
    const dep = all.find((d) => d.id === depId && d.userId === user.id);
    if (!dep || dep.depositType !== "RD" || dep.status !== "ACTIVE")
      throw new Error("Recurring deposit not found.");
    if (dep.installmentsPaid >= dep.tenureMonths)
      throw new Error("All installments for this RD have already been paid.");
    const inst = dep.principalPaise;
    if (inst > user.balancePaise) throw new Error("Insufficient balance for this installment.");
    postTxn(user, "DEBIT", inst, "RD", `${dep.schemeName} installment`, "Deposit", genRef());
    dep.installmentsPaid += 1;
    save(DEPOSITS_KEY, all);
    return dep;
  }

  function closeDeposit(depId) {
    const user = requireUser();
    const all = deposits();
    const dep = all.find((d) => d.id === depId && d.userId === user.id);
    if (!dep || dep.status !== "ACTIVE") throw new Error("Deposit not found or already closed.");
    const matured = todayStr() >= dep.maturityDate;
    const deposited = dep.depositType === "FD"
      ? dep.principalPaise : dep.installmentsPaid * dep.principalPaise;
    let credit, note, newStatus;
    if (matured) { credit = dep.maturityPaise; note = "matured"; newStatus = "MATURED"; }
    else { credit = deposited; note = "closed early (principal only, no interest)"; newStatus = "CLOSED"; }
    postTxn(user, "CREDIT", credit, dep.depositType, `${dep.schemeName} ${note}`, "Deposit", genRef());
    dep.status = newStatus;
    save(DEPOSITS_KEY, all);
    return { credit, note, status: newStatus };
  }

  // ---- Loans -------------------------------------------------------------
  function loansFor(userId, status) {
    if (userId == null) { userId = requireUser().id; }
    let list = loans().filter((l) => l.userId === userId);
    if (status) list = list.filter((l) => l.status === status);
    return list.sort((a, b) => b.id - a.id);
  }
  function loanById(loanId) {
    const u = requireUser();
    return loans().find((l) => l.id === loanId && l.userId === u.id) || null;
  }
  function loanPaymentsFor(loanId) {
    return loanPayments().filter((p) => p.loanId === loanId).sort((a, b) => a.emiNo - b.emiNo);
  }
  function genLoanAccount() {
    const existing = new Set(loans().map((l) => l.loanAccount));
    let n;
    do { n = "BBILN" + rand(8); } while (existing.has(n));
    return n;
  }

  function applyLoan(productCode, amountRupees, tenureMonths, purpose) {
    const user = requireUser();
    const product = LOAN_PRODUCTS.find((p) => p.code === productCode);
    if (!product) throw new Error("Please choose a valid loan product.");
    const amount = rupeesToPaise(amountRupees);
    const tenure = parseInt(tenureMonths, 10);
    if (!isFinite(tenure) || tenure <= 0) throw new Error("Enter a valid whole number of months.");
    purpose = (purpose || "").trim();

    const profile = getProfile(user.id);
    if (!profile || !profile.annualIncomePaise) {
      const e = new Error("Please complete your KYC (including annual income) before applying for a loan.");
      e.needKyc = true;
      throw e;
    }

    const rate = product.rate;
    const reasons = [];
    if (amount < product.minAmountPaise || amount > product.maxAmountPaise)
      reasons.push(`Amount must be between ${fmtINR(product.minAmountPaise)} and ${fmtINR(product.maxAmountPaise)}.`);
    if (tenure < 6 || tenure > product.maxTenureMonths)
      reasons.push(`Tenure must be between 6 and ${product.maxTenureMonths} months.`);

    let emi = 0, totalPayable = 0, totalInterest = 0;
    if (!reasons.length) {
      const t = loanTotals(amount, rate, tenure);
      emi = t.emi; totalPayable = t.totalPayable; totalInterest = t.totalInterest;
      const monthlyIncome = profile.annualIncomePaise / 12;
      if (emi > 0.55 * monthlyIncome)                      // FOIR limit
        reasons.push("The EMI would exceed 55% of your monthly income (FOIR limit). " +
                     "Try a smaller amount or a longer tenure.");
    }

    const approved = reasons.length === 0;
    const loanAccount = genLoanAccount();
    const ref = genRef();
    const now = nowStr();

    let status, reason, outstanding;
    if (approved) {
      status = "ACTIVE";
      reason = "Approved instantly based on income and eligibility.";
      outstanding = amount;
      postTxn(user, "CREDIT", amount, "LOAN",
              `${product.name} disbursed (${loanAccount})`, "Loan", ref);
      const fee = Math.round(amount * product.processingFeePct / 100);
      if (fee > 0)
        postTxn(user, "DEBIT", fee, "LOAN",
                `${product.name} processing fee (${loanAccount})`, "Loan", genRef());
    } else {
      status = "REJECTED"; reason = reasons.join(" "); outstanding = 0;
      if (emi === 0) {                                     // still compute an illustrative EMI
        const t = loanTotals(Math.max(amount, 1), rate, Math.max(tenure, 1));
        emi = t.emi; totalPayable = t.totalPayable; totalInterest = t.totalInterest;
      }
    }

    const all = loans();
    const rec = {
      id: nextId(all), userId: user.id, productCode: product.code, productName: product.name,
      loanAccount, principalPaise: amount, interestRate: rate, tenureMonths: tenure,
      emiPaise: emi, totalPayablePaise: totalPayable, totalInterestPaise: totalInterest,
      outstandingPaise: outstanding, emisPaid: 0, status, decisionReason: reason,
      purpose, appliedAt: now, decidedAt: now, refNo: ref,
    };
    all.push(rec);
    save(LOANS_KEY, all);
    return { approved, loan: rec, reason };
  }

  function payEmi(loanId) {
    const user = requireUser();
    const all = loans();
    const loan = all.find((l) => l.id === loanId && l.userId === user.id);
    if (!loan || loan.status !== "ACTIVE") throw new Error("Loan not found or not active.");
    const s = emiSplit(loan.outstandingPaise, loan.interestRate, loan.emiPaise);
    if (s.pay > user.balancePaise) throw new Error("Insufficient balance to pay this EMI.");
    const ref = genRef();
    postTxn(user, "DEBIT", s.pay, "LOAN",
            `${loan.productName} EMI (${loan.loanAccount})`, "Loan", ref);
    const emiNo = loan.emisPaid + 1;
    const pays = loanPayments();
    pays.push({
      id: nextId(pays), loanId: loan.id, emiNo, amountPaise: s.pay,
      principalPaise: s.principal, interestPaise: s.interest,
      outstandingPaise: s.newOutstanding, paidAt: nowStr(), refNo: ref,
    });
    save(LOAN_PAY_KEY, pays);
    loan.outstandingPaise = s.newOutstanding;
    loan.emisPaid = emiNo;
    loan.status = s.newOutstanding <= 0 ? "CLOSED" : "ACTIVE";
    save(LOANS_KEY, all);
    return { pay: s.pay, emiNo, outstanding: s.newOutstanding,
             closed: s.newOutstanding <= 0, tenure: loan.tenureMonths };
  }

  // ---- Portfolio roll-up -------------------------------------------------
  function portfolioSummary(userId) {
    if (userId == null) { userId = requireUser().id; }
    const activeDeps = deposits().filter((d) => d.userId === userId && d.status === "ACTIVE");
    let invested = 0, maturity = 0;
    activeDeps.forEach((d) => {
      invested += d.depositType === "RD" ? d.installmentsPaid * d.principalPaise : d.totalInvestedPaise;
      maturity += d.maturityPaise;
    });
    const activeLoans = loans().filter((l) => l.userId === userId && l.status === "ACTIVE");
    const outstanding = activeLoans.reduce((m, l) => m + l.outstandingPaise, 0);
    return {
      depositCount: activeDeps.length, depositInvested: invested, depositMaturity: maturity,
      loanCount: activeLoans.length, loanOutstanding: outstanding,
    };
  }

  // ---- expose ------------------------------------------------------------
  global.Bank = {
    BANK, fmtINR,
    register, login, logout, currentUser,
    deposit, withdraw, transfer, txnsFor,
    // reference catalogues
    SCHEMES, LOAN_PRODUCTS,
    // finance helpers (for live estimates)
    fdMaturityPaise, rdMaturityPaise, loanEmiPaise, emiSplit,
    amortizationSchedule, loanTotals, addMonths,
    // deposits
    openDeposit, depositsFor, payInstallment, closeDeposit,
    // loans
    applyLoan, loansFor, loanById, loanPaymentsFor, payEmi,
    // KYC + portfolio
    saveKyc, getProfile, portfolioSummary,
  };
})(window);
