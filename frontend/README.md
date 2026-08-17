# Lekha — Frontend

A React (Vite) frontend for the Lekha banking API. Sign in, browse companies,
open accounts, send transfers, search with plain English, and see
AI-generated insights — all talking to your locally-running Go backend.

## Design

Lekha means "record" — the UI leans into that literally instead of building
a generic dashboard: dark ink-and-parchment palette, tabular monospace
figures for money (how real statements set numbers), transfers rendered as
literal ledger rows, and transfer status shown as a small rotated stamp —
like an actual bank stamp — rather than a generic colored pill.

## Setup

**1. Install dependencies:**
```bash
npm install
```

**2. Make sure the backend is running first**, with CORS enabled (already
added to `main.go` — pull the latest backend zip if you haven't yet) and
listening on `http://localhost:8080`.

**3. Start the frontend dev server:**
```bash
npm run dev
```
Opens at `http://localhost:5173`.

**4. Sign up or sign in** with the same account you've been testing with via
curl/Postman — it's the same database, same users.

## Project layout

```
src/
├── main.jsx      # React entry point
├── App.jsx       # every screen: auth, dashboard, company detail
├── api.js        # thin wrapper around every backend call
└── index.css     # the whole design system
```

There's no router — the app is small enough that a simple `useState` switch
between "dashboard" and "selected company" covers every screen without the
extra complexity of React Router.

## What each screen does

- **Auth** — sign up or sign in; the JWT is stored in `localStorage` so a
  page refresh doesn't log you out.
- **Dashboard** — lists your companies, lets you create a new one.
- **Company detail** — four panels:
  - **Insights** — click "Generate insights" to compute real numbers
    (Go/SQL) and get an AI-written paragraph explaining them.
  - **Search** — type a plain sentence ("completed transfers over 100"),
    see exactly what the AI interpreted it as, and the matching results.
  - **Accounts** — open a new account, see balances and active/inactive
    status.
  - **Transfers** — send money between two of the company's accounts, see
    the full transfer history as ledger rows.

## Build for production

```bash
npm run build
```
Outputs static files to `dist/` — verified this builds clean with zero
errors before handing it to you.
