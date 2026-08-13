# StockKeep — Requirements Traceability Matrix

This matrix maps every requirement defined in `SRS.pdf` to the test case(s) that exercise it in `Testing_Report.pdf`, and to the source file(s) that implement it. It is the single source of truth referenced by both documents; if this file, `SRS.pdf`, and `Testing_Report.pdf` ever disagree, this file (being the most granular) should be treated as authoritative and the two PDFs corrected to match it.

| Requirement ID | Description (abridged) | Implementing file(s) | Test ID(s) | Result |
|---|---|---|---|---|
| FR-01 | Passcode authentication | `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` | TC-API-03, TC-API-04 | PASS |
| FR-02 | Session cookie issuance | `src/lib/auth.ts` | TC-API-04, TC-API-26 | PASS |
| FR-03 | Route protection (middleware) | `src/middleware.ts` | TC-API-01, TC-API-02, TC-API-23 | PASS |
| FR-04 | Logout | `src/app/api/auth/logout/route.ts` | TC-API-22 | PASS |
| FR-05 | Dashboard/analytics | `src/app/api/analytics/route.ts` | TC-API-18 | PASS |
| FR-06 | Add item (auto SKU) | `src/app/api/items/route.ts` | TC-API-07 | PASS |
| FR-07 | Item validation | `src/lib/validations.ts`, `src/app/api/items/route.ts` | TC-API-06 | **FAIL — DEF-01** |
| FR-08 | Search/filter inventory | `src/app/api/items/route.ts` | TC-API-05, TC-API-08 | PASS |
| FR-09 | Item detail (supplier/movements/sales) | `src/app/api/items/[id]/route.ts` | TC-API-05 | PASS |
| FR-10 | Edit/delete item | `src/app/api/items/[id]/route.ts` | — | Not verified — execution required by student |
| FR-11 | Stock adjustment (IN/OUT) | `src/lib/validations.ts`, `src/app/api/items/[id]/adjust/route.ts` | TC-API-09, TC-API-10, TC-API-11, TC-API-12 | PASS / **FAIL (DEF-01)** |
| FR-12 | Zero-floor stock rule | `src/app/api/items/[id]/adjust/route.ts` | TC-API-09 | PASS |
| FR-13 | Atomic stock transaction | `src/app/api/items/[id]/adjust/route.ts` (Prisma `$transaction`) | TC-API-10, TC-API-11 | PASS |
| FR-14 | Low-stock email (best-effort) | `src/app/api/items/[id]/adjust/route.ts`, `src/lib/notify.ts` | — | Not verified — execution required by student (requires a valid Resend key) |
| FR-15 | Record sale / oversell rejection | `src/app/api/sales/route.ts` | TC-API-13, TC-API-14 | PASS |
| FR-16 | Supplier CRUD | `src/app/api/suppliers/route.ts`, `src/app/api/suppliers/[id]/route.ts` | TC-API-15, TC-API-16 | PASS |
| FR-17 | Inventory/dead-stock report | `src/app/api/reports/summary/route.ts` | TC-API-17 | PASS |
| FR-18 | Settings read/update | `src/app/api/settings/route.ts` | TC-API-19 | PASS |
| FR-19 | AI chat + fallback | `src/app/api/ai/chat/route.ts` | TC-API-20 | PASS |
| FR-20 | AI description + fallback | `src/app/api/ai/describe/route.ts` | — | Not verified — execution required by student |
| FR-21 | AI forecast + fallback | `src/app/api/ai/forecast/[itemId]/route.ts` | TC-API-21 | PASS |
| FR-22 | AI insights + fallback | `src/app/api/ai/insights/route.ts` | — | Not verified — execution required by student |
| FR-23 | Auto-seed sample data | `src/lib/seed.ts`, `src/app/api/seed/route.ts` | TC-API-24 | PASS (functionally) — see DEF-02 |
| NFR-01 | Auth required on protected routes | `src/middleware.ts` | TC-API-02, TC-API-24 | PASS / **FAIL (DEF-02 exception)** |
| NFR-02 | Passcode hashing at rest | — (not implemented) | — | **Not met** — TD-01 |
| NFR-03 | AI graceful degradation | `src/app/api/ai/*` | TC-API-20, TC-API-21 | PASS |
| NFR-04 | Atomic writes | `items/[id]/adjust`, `sales` routes | TC-API-10, TC-API-11, TC-API-13 | PASS |
| NFR-05 | Non-negative stock | `items/[id]/adjust/route.ts` | TC-API-09 | PASS |
| NFR-06 | TypeScript strict mode | `tsconfig.json` | Code review | PASS |
| NFR-07 | Vercel deployability | `package.json`, `next.config.ts` | Code review | PASS (with caveat — TD-08) |
| NFR-08 | Responsive UI | `src/app/page.tsx` (Tailwind) | — | Not verified — execution required by student |
| NFR-09 | Performance | — | Informal only (Testing_Report.pdf Section 11) | Not benchmarked |
| NFR-10 | Scalable persistence | `prisma/schema.prisma` (SQLite) | Code review | **At risk** — TD-08 |
| NFR-11 | Automated test coverage | — (none exists) | — | **Not met** — TD-07 |
| AUTH-01 | Passcode required for session | `src/app/api/auth/login/route.ts` | TC-API-03, TC-API-04 | PASS |
| AUTH-02 | Cookie attributes correct | `src/lib/auth.ts` | TC-API-26 | PASS |
| AUTH-03 | Unauthenticated requests rejected | `src/middleware.ts` | TC-API-01, TC-API-02, TC-API-23 | PASS |
| AUTH-04 | Settings passcode controls login | — (gap) | — | **Not met** — TD-01 |
| AUTH-05 | Role-based authorisation | — (not implemented) | — | **Not met** — out of scope this version |
| SEC-01 | Parameterised queries only | All `src/app/api/**` via Prisma | Code review (grep for `$queryRawUnsafe`) | PASS |
| SEC-02 | Secrets via environment variables | `.env.local` (git-ignored) | Code review | PASS |
| SEC-03 | Resend key not exposed in plaintext | `src/app/api/settings/route.ts` | TC-API-19 | **FAIL — DEF-05 / TD-06** |
| SEC-04 | `/api/seed` requires authentication | `src/middleware.ts` | TC-API-24 | **FAIL — DEF-02 / TD-02** |
| SEC-05 | Login rate limiting | — (not implemented) | TC-API-25 | **FAIL — DEF-03 / TD-03** |
| SEC-06 | CSRF protection | — (not implemented) | Code review | **Not met** — TD-04 |
| SEC-07 | Security response headers | `next.config.ts` | TC-API-26 | **FAIL — TD-05** |

**Legend:** PASS = confirmed by live execution. FAIL = confirmed by live execution to not meet the requirement (defect ID given where applicable). Not met = confirmed absent by code review. Not verified = neither executed nor determinable from source; requires the student to test manually before submission.
