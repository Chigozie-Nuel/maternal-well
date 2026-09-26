# Maternawell Nigeria

Offline-first postnatal depression screening and referral for Primary Health Centres (PHCs), built to the SRS in
`Ndubuaku_Chigozie_Emmanuel_Assignment1_W4_08-01-2026 (1).pdf`.

A health worker screens a mother with the 10-item EPDS, one question per screen. The app scores against the Nigerian
cutoff of 9, flags any Item-10 (self-harm) response for same-day supervisor acknowledgement, recommends a referral
pathway, and tracks follow-up. Everything works without internet and syncs when a connection returns. Mothers can
also screen themselves anonymously and be routed to a facility's referral queue.

> This is a screening tool, not a diagnostic tool. Crisis phone numbers and the validated Yoruba EPDS wording are
> **not** included yet (see *Known gaps*).

## Quick start

Requires **Node.js 22.5+** (the server uses the built-in `node:sqlite`; no other server dependencies).

```bash
npm run setup      # install app dependencies
npm start          # build the app and serve app + API on http://localhost:4000
```

For development with hot reload (API on :4000, app on :3000):

```bash
npm run dev:all
```

Run every test (14 API tests + 36 app tests):

```bash
npm test
```

### Demo accounts (seeded in development only)

| Staff ID | Password | Role | Facility |
|---|---|---|---|
| HW-01 | `Worker01!2026` | Health worker | Ikeja PHC |
| SUP-01 | `Supervisor01!2026` | Facility supervisor | Ikeja PHC |
| ADMIN-01 | `Admin01!2026` | System administrator | Ikeja PHC |
| HW-02 / SUP-02 / ADMIN-02 | `Worker02!2026` … | same roles | Surulere PHC |
| HW-03 / SUP-03 / ADMIN-03 | `Worker03!2026` … | same roles | Epe PHC |

The mother self-check is at `/self-referral` (linked from the sign-in page) and needs no account.

## How it works

```
maternawell-app/            React 18 + Vite PWA (also packaged for Android with Capacitor)
  src/domain/               EPDS scoring, risk tiers, referral plans, same-day deadline (shared with the server)
  src/db/                   Encrypted IndexedDB store, outbox sync engine, anonymous self-referral queue
  src/context/              Auth (online + offline sign-in, idle lock), screenings/referrals, language
  src/pages/                Screens for each role
  android/                  Capacitor Android project (minSdk 26 = Android 8.0)
server/                     Node sync + referral API (node:sqlite, AES-256-GCM encrypted rows)
```

- **Offline:** the service worker caches the app. Every change is encrypted and saved on the device, then queued in an outbox.
  The outbox syncs automatically on reconnect, every 30 s and on demand. It sends gzip batches of up to 50 changes, retries
  with exponential backoff, and the server applies each change idempotently.
- **Security:** device records are AES-GCM encrypted with a key derived from the staff password (PBKDF2, 210k iterations).
  The key only lives in memory, and the app locks after a reload or 10 idle minutes. Server rows are AES-256-GCM encrypted.
  Every action is audited with the staff ID and time.
- **Roles:** health workers screen and follow up. Supervisors acknowledge Item-10 flags and see facility-wide case status,
  but item-level answers only for escalated cases. Administrators read the audit trail.

## Android

```bash
cd maternawell-app
VITE_API_BASE=https://your-sync-server.example npm run build   # emulator testing: http://10.0.2.2:4000
npx cap sync android
cd android && ./gradlew assembleDebug                           # APK: app/build/outputs/apk/debug/app-debug.apk
```

`capacitor.config.json` allows cleartext HTTP so an emulator can reach a local server. Remove `cleartext` and use an
HTTPS `VITE_API_BASE` for deployment.

## Production notes

- Set `NODE_ENV=production`, `MATERNAWELL_DATA_KEY` (64 hex chars) and `TRUST_HTTPS_PROXY=true`, and run behind an HTTPS
  reverse proxy. Demo accounts are not seeded in production; provision real accounts.
- `MATERNAWELL_ALLOWED_ORIGINS` adds allowed CORS origins (the Android app's origin is allowed by default).

## Known gaps (need input from the project owner)

1. **Crisis numbers:** `maternawell-app/src/config/crisisContacts.js` holds placeholders marked `verified: false`,
   and the UI shows "number pending verification". Add verified numbers before any real use.
2. **Yoruba EPDS:** the UI has draft Yoruba labels. The clinical questions stay in English until the validated
   Adewuya et al. (2006) wording is supplied. Machine translation was deliberately not used.
3. **SMS/push notifications** are simulated: escalations are recorded in the `notifications` table and the admin view,
   not sent. A real gateway needs an account and credentials.
4. **Account management:** accounts are seeded. There is no in-app user administration or password reset.
5. **Field validation** on real low-end Android devices over 2G, and a full 8–12 hour shift test, have not been done.

See `maternawell-app/IMPLEMENTATION_SUMMARY.md` for requirement-by-requirement traceability.
