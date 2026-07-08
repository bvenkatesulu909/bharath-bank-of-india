# Bharath Bank of India 🏦 — Web + Desktop

A demonstration internet-banking app with a **landing page** and a full **dashboard**.
The entire app runs client-side (HTML/CSS/JS, data in `localStorage`), so it deploys
to Netlify as a static site **and** runs as a native desktop app via Electron — same code.

> Demo only. Not a real bank, holds no real money.

## Features
- Landing page with login / open-account modals
- Dashboard: live balance card, quick actions, recent activity
- Deposit, Withdraw (insufficient-balance guard), Transfer (double-entry, shared ref no.)
- Filterable account statement with running balance
- Profile page
- Money stored as integer **paise** — no floating-point errors

## Run the website locally
```bash
npx serve public          # or: python -m http.server 5056 --directory public
```

## Deploy to Netlify
```bash
netlify deploy --prod --dir public
```

## Run as a desktop app
```bash
npm install          # installs electron
npm start            # opens the native desktop window
npm run dist         # (optional) builds a portable Windows .exe into dist/
```

## Structure
```
public/            # the web app (deployed to Netlify)
  index.html       # landing page + auth
  dashboard.html   # banking dashboard
  bank.js          # data layer (localStorage)
  style.css
desktop/main.js    # Electron wrapper (loads public/index.html)
netlify.toml       # publish = public
```
