# Customer IntellAssist

A complete customer complaint and service-resolution platform that runs entirely in your browser.

Customer IntellAssist takes a raw customer complaint or enquiry and automatically classifies it
(category, priority, sentiment, urgency), routes it to the right department, calculates and tracks
an SLA deadline, flags missing information and possible duplicate/related cases, recommends
knowledge-base articles, and helps an agent draft a response — all with **zero external services,
zero API keys, and zero backend to configure**. Every piece of data lives in your browser's
IndexedDB and survives refreshes, browser restarts, and offline use after the first load.

---

## 1. Architecture

- **React 19 + Vite**, Tailwind CSS, React Router. Route-level code-splitting keeps the app fast.
- **Dexie.js (IndexedDB)** — the entire persistence layer. There is no server, no database
  configuration, and nothing to deploy besides the static frontend itself.
- **Local intelligence engine** (`src/lib/intelligence.js`) — deterministic, rule-based case
  classification (category, sentiment, priority, missing-info, duplicate detection), built into the
  app and running entirely on-device. Every suggestion carries a confidence score and visible
  reasoning, and can be overridden by an agent. If it ever throws, case creation still succeeds
  with safe fallback values instead of failing — see `src/test/repo.test.js`.
- **Service layer** (`src/lib/repo.js`) — every page calls through here, never Dexie directly. This
  keeps business logic centralized, testable, and swappable later if a real backend is ever wanted.

```
src/
├── pages/                  one file per route (Dashboard, Cases, CaseDetail, …)
├── pages/WorkspaceSetup.jsx first-run flow — no login, no signup
├── components/              layout (Shell/Sidebar/Header/AmbientBackground/ErrorBoundary),
│                             ui primitives, case-specific widgets
├── lib/
│   ├── repo.js               service layer — every page calls through here, not Dexie directly
│   ├── intelligence.js       local rule-based classification engine
│   ├── sla.js                 SLA deadline/state calculations
│   ├── seed.js                 sample-data loader (explicit, user-triggered, clearly tagged)
│   └── constants.js, format.js, responseTemplates.js, emptyArray.js
├── db/db.js                 Dexie schema — the single source of truth for persisted data
├── context/AppContext.jsx    workspace profile, theme, sidebar, SLA clock (all via Dexie)
└── test/                      vitest unit + integration tests (fake-indexeddb)
```

## 2. No login — Workspace Setup instead

There is no authentication, because there is no server to authenticate against — this is a
single-user, local-first application by design. On first launch, **Workspace Setup** asks for your
name, a workspace name, and a role (Administrator / Manager / Agent / Viewer), then lets you choose
to start with a realistic sample dataset or a completely empty workspace. Your profile is saved to
IndexedDB and the app opens straight to your workspace on every future visit — **Settings →
Workspace profile** lets you edit it anytime.

Roles here are **workspace-level access control**, not a security boundary — there's no backend to
enforce them against, so they're not described or intended as authentication/authorization
protection. They shape what the UI lets you do (e.g. a Viewer can't edit cases), which is useful
for demoing role-based workflows or for one person switching hats.

## 3. Local intelligence engine

`analyzeCase()` runs entirely client-side, with no external AI API call anywhere in this app:
- **Category** — keyword-dictionary scoring across 7 categories, confidence from match density.
- **Sentiment** — lexicon match against urgency/anger/frustration/positive word sets.
- **Priority** — weighted score from category risk + sentiment + explicit urgency language.
- **Missing information** — regex/heuristic checks for order numbers, amounts, dates, device info.
- **Duplicate/related cases** — Jaccard-style token-overlap similarity, boosted for same-customer
  and same-category matches, scoped to a recent time window.

This is presented in the UI as the app's **built-in intelligence/automation engine** — not as an
external AI product — and every classification is shown with its reasoning so an agent can review
and override it before or after a case is created.

## 4. Features

Dashboard (metrics calculated live from IndexedDB, never hard-coded) · full case lifecycle with
validated status transitions · SLA engine (configurable per-priority targets, Healthy/At Risk/
Breached, breach events logged + notified) · smart routing + load-balanced auto-assignment ·
duplicate/related-case detection with one-click linking · missing-information detection · response
assistant (5 tones, template-based, always requires a manual "mark as sent") · Knowledge Base with
category-matched recommendations · Customer 360 · Complaints view with quick filters · My Queue ·
Team workload · AI Insights · Trends charts · Reports with CSV export (cases, customers, audit log,
summary) · **CSV bulk import for cases** — upload a spreadsheet of complaints and every row runs
through the same automated classification, routing, SLA, and assignment pipeline as a manually
created case, with upfront validation, a preview showing exactly which rows will import versus
which need correction, and a per-row result summary afterward · full JSON backup/restore with
structural validation (a malformed file is rejected and never touches existing data) · Audit Log ·
Notifications · global search across cases, customers, and knowledge articles · light/dark theme
(light default) with a subtle animated ambient background (`prefers-reduced-motion` respected) ·
collapsible sidebar · fully responsive from 360px mobile to
1440px+ desktop · loading/empty/error states throughout · form validation · a global error boundary
so a broken screen never turns into a blank crash · realistic, clearly-tagged sample data you load
by choice (never injected automatically) that can be cleared independently of your real data at any
time.

## 5. Setup

```bash
npm install
npm run dev       # http://localhost:5173 — no environment variables needed
```

## 6. Build & preview

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## 7. Tests

```bash
npm test     # vitest — 53 tests
npm run lint  # oxlint — 0 warnings, 0 errors
```

Tests cover: the intelligence engine (category/sentiment/priority classification, missing-info
detection, duplicate detection), the SLA engine (deadline calculation, Healthy/At Risk/Breached
transitions), and the full repository layer against a real IndexedDB implementation
(`fake-indexeddb`) — case creation end to end, status-transition validation, SLA sweep, dashboard
metrics reacting to live data, backup/restore round-tripping (including rejecting a malformed
backup without touching existing data), and sample-data loading/clearing (including that it never
overwrites a workspace that already has data, and that clearing sample data never touches anything
you created yourself).

## 8. How persistence works

Everything — the workspace profile, customers, cases, case messages/notes, assignments,
departments-worth of team data, notifications, audit events, knowledge articles, theme, and sidebar
state — is stored in one IndexedDB database (`customer_intellassist`) via Dexie. There is nothing to
configure: the database is created automatically on first use, in the visiting browser, and persists
across refreshes, tab closes, and browser restarts. It does **not** sync across devices or browsers
— that would require a server, which this build deliberately does not have (see §2).

## 9. Sample data

Sample data (38 customers, 72 cases, 8 team members, 7 knowledge articles) is available two ways:
during Workspace Setup ("Start with sample workspace"), or later from **Settings → Data management
→ Load sample data** — which only appears while the workspace is genuinely empty, so it can never
silently overwrite real data. Every sample record is tagged internally so **Clear sample data**
can remove exactly those records without touching anything you've created yourself.

## 10. Backup / restore

**Settings → Data management → Export full backup (JSON)** downloads everything. **Restore from
backup** validates the file's structure before touching anything — a malformed or unrelated JSON
file is rejected with a clear message, and your existing data is left untouched; a valid backup
requires an explicit confirmation before it replaces your current workspace. Quick CSV exports for
cases, customers, and the audit log are also available from Settings and from Reports.

## 10a. CSV import (bulk case creation)

**Settings → Data management → Import cases from CSV** accepts a CSV with four columns:
`customerName, customerEmail, subject, description`. A **Download CSV template** button provides a
correctly-formatted starting file. On upload, every row is validated before anything is imported —
missing fields, malformed emails, and descriptions too short to meaningfully analyze are flagged
with the specific spreadsheet row number and reason, without blocking the valid rows. You then
confirm the import explicitly; nothing is written until you do. Each valid row is processed through
the exact same automated pipeline as manually creating a case — classification, priority, sentiment,
department routing, SLA calculation, and agent assignment — so importing a spreadsheet of historical
or bulk complaints is genuine automated triage, not just raw data insertion. Customers are matched
by email and reused across rows rather than duplicated. A result summary reports how many cases were
created and lists any rows that failed, with the reason for each.

## 11. Responsive behavior

Tested at 1440px, 1280px, 1024px, 768px, 430px, 390px, and 360px. Below the `md` breakpoint the
sidebar becomes a drawer, tables scroll horizontally or collapse to stacked cards where it matters,
modals stay within the viewport, and dashboard cards reflow to 1–2 columns.

## 12. Deployment (Netlify)

```bash
npm install
npm run build
```
1. Push this repo to GitHub.
2. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** →
   select the repo. Build command and publish directory are already set via `netlify.toml`.
3. Deploy. No environment variables, no API keys, and no database configuration are needed —
   Netlify's free tier covers the whole thing.

SPA routing on refresh is handled by the included `public/_redirects` and `netlify.toml`. A
`vercel.json` is also included if you'd rather deploy to Vercel instead.

## 13. Team

Solo build — Shine, ML Engineering Intern, InventaCore AI Internship Program 2026.
