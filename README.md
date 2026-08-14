# StockKeep — AI Shop Inventory & Stock Tracking System

**Student:** Prince Ephraim Quarshie | **ID:** 22424601
**Course:** CSCD602 | **Institution:** University of Ghana, Department of Computer Science
**Supervisor:** Prof. Solomon Mensah

> Live deployment: https://ai-stock-keep-tracker.vercel.app/
> Repository: https://github.com/quarshie133/AI-StockKeep-Tracker

---

## Overview

StockKeep is a full-stack AI-powered shop inventory and stock tracking system built with **Next.js 16 (App Router)**, **Prisma ORM + SQLite**, and **Google Gemini AI**. It features a two-tier role system (User / Admin), real-time analytics, AI-driven insights, and a complete audit trail.

---

## Features

### User System
- Passcode-based authentication with scrypt hashing and rate limiting
- Session cookies (`stockkeep_auth`) with 7-day expiry
- Inventory management — add, edit, delete, search, filter items
- Stock adjustments (IN / OUT) with zero-floor rule enforcement
- Sales recording with oversell rejection and atomic DB transactions
- Supplier CRUD
- Real-time analytics dashboard with KPI cards and revenue charts
- AI features: item description generator, demand forecasting, inventory insights, chat assistant
- Low-stock email notifications (via Resend API)
- CSV export of inventory
- Reports: dead-stock, category breakdown, top products

### Admin System (added 2026-08-14)
- Separate admin login at `/admin/login` with its own passcode (configured via `ADMIN_PASSCODE`; see `Deployment_and_Source_Links.txt` for this deployment's value — never hardcoded here)
- Admin cookie (`stockkeep_admin`) issued alongside regular auth cookie
- **Admin Dashboard** at `/admin` with 4 tabs:
  - **Overview** — 8 system KPI cards + Live Activity Feed (auto-refreshes every 15 s) + Lock Mode toggle
  - **Audit Log** — full paginated history of all write operations, filterable by action type
  - **Sessions** — login history showing role, success/fail status, IP address, timestamp
  - **Admin Settings** — change admin passcode, toggle User Lock Mode
- **User Lock Mode** — admin toggle that puts the system in read-only mode for regular users (all write APIs return 403; users see a red banner)
- Admin link in user sidebar (visible only when logged in as admin)
- Every write operation is logged to `AuditLog` (action, role, entity ID, details)
- Every login attempt is logged to `LoginEvent` (role, success, IP)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + custom CSS utilities |
| Database ORM | Prisma 5 |
| Database | SQLite (dev) / ephemeral /tmp workaround (Vercel — see TD-08) |
| AI | Google Gemini (`gemini-flash-latest`) |
| Auth | Cookie-based sessions + scrypt passcode hashing |
| Email | Resend API (optional) |

---

## Database Schema (current)

```
Item            — inventory items with supplier FK
StockMovement   — stock IN/OUT history per item
Sale            — sale records per item
Supplier        — supplier directory
Settings        — store config (passcode, adminPasscode, userReadOnly, email)
AuditLog        — full action audit trail (added 2026-08-14)
LoginEvent      — login history (added 2026-08-14)
```

---

## API Routes

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | User login (verifies passcode, sets auth cookie) |
| POST | `/api/auth/admin-login` | Admin login (verifies admin passcode, sets both cookies) |
| POST | `/api/auth/logout` | Clears both cookies |
| GET  | `/api/auth/me` | Returns `{ role, readOnly }` for client |

### Core Data
| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/items` | List inventory / create item |
| GET/PUT/DELETE | `/api/items/[id]` | Item detail / update / delete |
| POST | `/api/items/[id]/adjust` | Stock adjustment |
| GET/POST | `/api/sales` | Sales list / record sale |
| GET/POST | `/api/suppliers` | Suppliers list / create |
| PUT/DELETE | `/api/suppliers/[id]` | Update / delete supplier |
| GET | `/api/analytics` | Full analytics data |
| GET | `/api/reports/summary` | Inventory reports |
| GET/PUT | `/api/settings` | Store settings |

### Admin (require `stockkeep_admin` cookie)
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/overview` | System KPIs |
| GET | `/api/admin/activity` | Paginated audit log |
| GET | `/api/admin/sessions` | Login event history |
| PUT | `/api/admin/lock` | Toggle user read-only mode |
| GET/PUT | `/api/admin/settings` | Admin passcode management |

### AI
| Method | Route | Description |
|---|---|---|
| POST | `/api/ai/describe` | Generate item description |
| GET | `/api/ai/insights` | AI inventory insights |
| GET | `/api/ai/forecast/[itemId]` | Demand forecast |
| POST | `/api/ai/chat` | AI assistant chat |

---

## Getting Started (Local)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Edit .env.local — add your GEMINI_API_KEY

# 3. Push the database schema
npx prisma db push

# 4. Start the dev server
npm run dev
```

Open http://localhost:3000 — the app auto-seeds sample data on first load.

**Default passcodes** are set via the `APP_PASSCODE` and `ADMIN_PASSCODE` environment variables (see `.env.local.example`); if unset, the code falls back to built-in defaults for local development only. **Do not rely on the fallback defaults in any shared or deployed environment** — set both environment variables explicitly, and change the admin passcode via `/admin` → Admin Settings on first login. For this project's current live deployment, the actual working credentials are documented in `StudentID_StockKeep/Deployment_and_Source_Links.txt` — that file, not this README, is the source of truth for real credentials, precisely so credentials don't sit permanently in public source history.

---

## Login URLs

| Role | URL |
|---|---|
| User | `/login` |
| Admin | `/admin/login` |

---

## Project Documentation (StudentID_StockKeep/)

| File | Contents |
|---|---|
| `Project_Documentation.pdf` | Full system design, architecture, feature walkthrough |
| `SRS.pdf` | Software Requirements Specification |
| `Technical_Debt_Plan.pdf` | Known issues and remediation roadmap |
| `Testing_Report.pdf` | 26-case API test suite results and defect log |
| `User_Manual.pdf` | End-user guide |
| `FINAL_SUBMISSION_READINESS_REPORT.pdf` | Pre-submission checklist |
| `Deployment_and_Source_Links.txt` | Live URL, test credentials, verification log |
| `Supporting_Files/` | Diagrams, test logs, traceability matrix |

---

## Deployment Notes

The live Vercel deployment uses a `/tmp` workaround for the SQLite database (see `Technical_Debt_Plan.pdf`, TD-08). Data may reset on cold start. This is a known, documented limitation.

