# Implementation summary and SRS traceability

Status as of 26 September 2026. "Verified by" names an automated test, or the manual browser run done on this date
against the live server. Tests: `server/test/api.test.mjs` (14) and `maternawell-app/src/test/*` (36).

## Functional requirements

| SRS | Requirement | Implementation | Verified by |
|---|---|---|---|
| FR-1 | Digital EPDS, quick to administer | `src/utils/constants.js` (EPDS items), `src/pages/ScreeningQuestion.jsx` | flow.test: full screening through the UI |
| FR-2 | One question per screen | `ScreeningQuestion.jsx` (large options, back/next, progress) | flow.test; browser run |
| FS-3 | Automatic total score | `src/domain/epds.js` `scoreEpds` (rejects incomplete answers); server re-scores | epds.test boundaries; api.test "server re-scores" |
| FS-4 | Tiers with the Nigerian cutoff of 9 | `classifyRisk`: 0–8 low, 9–12 moderate, 13–30 high | epds.test 8/9/12/13; flow.test "moderate tier at the cutoff of 9" |
| FS-5 | Item 10 > 0 is a same-day case, whatever the total | `isEscalation`, `getReferralPlan`, `src/domain/escalation.js` | flow.test (total 1, Item-10 = 1 → urgent); escalation.test |
| FR-6 | Referral per tier | `getReferralPlan`: community/peer · PHC counselling · immediate psychiatric | epds.test; api.test |
| FR-7 | Recommendation shown immediately | `Results.jsx` renders the stored plan right after question 10 | flow.test; browser run |
| FR-8 | Save completed screenings offline | `src/db/db.js` encrypted IndexedDB, drafts saved after every answer | db.test; flow.test resume; browser run with server stopped |
| FR-9 | Auto-sync when online | `src/db/sync.js` outbox (on reconnect, every 30 s, after each write), encrypted rotating refresh credential | sync.test reconnect/pagination; browser run: offline case synced on reconnect |
| FR-10 | Follow-up pending / contacted / completed | `CaseDetail.jsx` follow-up form + history; server `FOLLOW_UP` (+ lost to follow-up) | api.test follow-up; browser run |
| FR-11 | Follow-up on the facility dashboard | `SupervisorDashboard.jsx` follow-up breakdown, active referrals, days open | browser run |
| FR-12 | Anonymous self-screening | `/self-referral`, `AnonymousSelfReferral.jsx`, no name collected | epds.test B2; browser run |
| FR-13 | Self-referrals use the same referral system | `src/db/selfReferral.js` → `/api/self-referral` → facility queue (queued offline) | api.test self-referral; browser run: HW-01 sees MW code |
| FR-14 | Unique login before data access | `AuthContext.jsx` server login, offline sign-in via key check, role routes | flow.test sign-in; api.test auth |
| FR-15 | Supervisor dashboard of active/pending cases | `SupervisorDashboard.jsx`, `CaseList.jsx` | browser run |

## Non-functional requirements

| SRS | Requirement | Implementation | Verified by |
|---|---|---|---|
| NFR-1 | Scoring < 1 s | Pure synchronous scoring | epds.test (< 50 ms) |
| NFR-2 | Sync over 2G | gzip batches ≤ 50, idempotent operations, backoff, 20 s timeout | api.test gzip; sync.test backoff |
| NFR-3 | 8–12 h shift without losing data | Drafts encrypted after every answer, resume after reload/lock, error boundary | flow.test resume; browser reload mid-screening |
| NFR-4 | Item-10 flag not dismissible without supervisor | Worker safety modal (no close), flag stays until supervisor acknowledges with notes, end-of-clinic-day deadline and OVERDUE, live dashboard polling while open and optional local notification | flow.test; api.test escalation; browser run |
| NFR-5 | Never presented as a diagnosis | Disclaimer on results, case detail, PDF, self-referral, question screen | flow.test |
| NFR-6 | NDPA explicit consent | Consent statement read aloud + two confirmations; self-referral consent; server rejects without consent | api.test consent |
| NFR-7 | Audit every action with health-worker ID | Server audit on every operation and login; client-only events synced; `AdminAudit.jsx` | api.test audit; browser run |
| NFR-8 | Encrypted at rest | Device: AES-GCM envelopes, PBKDF2 key held in memory. Server: AES-256-GCM rows | db.test "no plaintext"; crypto.test |

## Business rules (SRS 5.5)

| Rule | Implementation | Verified by |
|---|---|---|
| Only authenticated staff see named mothers | Protected routes; server auth on every data endpoint | api.test "requires authentication" |
| Supervisors: aggregate status, answers only when escalated | Server `restrictedRecord`; case detail shows a locked panel | api.test; browser run |
| Item-10 visible to supervisor the same clinic day | Supervisor queue with countdown/overdue; synced immediately | escalation.test; browser run |
| Anonymous records stay unlinked unless contact volunteered | Name/phone fields rejected; contact optional | api.test self-referral |

## User documentation (SRS 2.6)

| Item | Where |
|---|---|
| First-login walkthrough | `src/components/Onboarding.jsx` (replay from Help) |
| Quick-reference guide (printable) | Help → Quick reference |
| "?" contextual help on each screen | `src/components/ContextHelp.jsx` |
| Supervisor guide (3 pages, printable) | Help → Supervisor guide |
| Yoruba reference | Help → Yoruba UI reference (template; validated EPDS wording pending) |
| FAQ / troubleshooting (offline) | Help → FAQ |

## Interfaces and platform

- Android 8.0+: Capacitor project in `android/` (minSdk 26); debug APK built with `./gradlew assembleDebug`.
- Local database: IndexedDB (Dexie), used as the on-device SQL-style store. Server: SQLite (`node:sqlite`).
- HTTPS: production mode refuses to run without an HTTPS proxy (`TRUST_HTTPS_PROXY`).
- Language: English by default, draft Yoruba interface labels.

## Known gaps

Validated Yoruba EPDS text, background SMS/push delivery, account administration, confirmation of local emergency number availability, and field testing on real devices over 2G and a full shift. See the root README.
