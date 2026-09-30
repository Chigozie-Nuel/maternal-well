# Maternawell Nigeria

Offline-first postnatal depression screening and referral for Primary Health Centres (PHCs), built to the SRS in
`Ndubuaku_Chigozie_Emmanuel_Assignment1_W4_08-01-2026 (1).pdf`.

A health worker screens a mother with the 10-item EPDS, one question per screen. The app scores against the Nigerian
cutoff of 9, flags any Item-10 (self-harm) response for same-day supervisor acknowledgement, recommends a referral
pathway, and tracks follow-up. Everything works without internet and syncs when a connection returns. Mothers can
also screen themselves anonymously and be routed to a facility's referral queue.

> This is a screening tool, not a diagnostic tool. Published emergency numbers are included, but facilities must confirm availability locally. Validated Yoruba EPDS wording is not included (see *Known gaps*).

## Set up from a fresh computer

1. Install [Git](https://git-scm.com/downloads) and [Node.js 22.5 or newer](https://nodejs.org/en/download). During Node installation, leave **npm** selected. A browser such as Chrome or Edge is also needed.
2. Open PowerShell (Windows) or a terminal (macOS/Linux). Check the tools:

   ```text
   git --version
   node --version
   npm --version
   ```

   If a command is not found, finish its installer and open a new terminal. `node --version` must be at least `v22.5.0`.
3. Clone the public repository, then enter its root directory:

   ```text
   git clone https://github.com/Chigozie-Nuel/maternal-well.git
   cd maternal-well
   ```

4. Install the exact frontend dependencies from `maternawell-app/package-lock.json`:

   ```text
   npm run setup
   ```

   The API uses built-in Node modules, so there is no second server install command.
5. Build the frontend and start the app plus API:

   ```text
   npm start
   ```

   Keep this terminal open. Open **http://127.0.0.1:4000/login** in your browser. `http://localhost:4000/login` also works. Check **http://127.0.0.1:4000/api/health** for `"status":"ok"`.
6. Open **Prototype demo accounts** on the sign-in page. Select `HW-01` to fill its credentials, then sign in. Sign out and use `SUP-01` for the supervisor dashboard or `ADMIN-01` for the audit view. For the public mother flow, open **http://127.0.0.1:4000/self-referral**. Enter fictional details only.
7. Stop the app with **Ctrl+C**. Local SQLite records and the development encryption key are created under `server/data/` and are ignored by Git. Keep the key with the database; losing it makes those records unreadable.

To run the API and hot-reloading frontend in development, stop `npm start` first and run `npm run dev:all`. Open **http://localhost:3000**; the Vite dev server proxies API requests to port 4000. To run the full automated suite from the root, run `npm test`.

If port 4000 is already in use, stop the other process or set `PORT` before starting. In PowerShell: `$env:PORT=4100; npm start`. In macOS/Linux: `PORT=4100 npm start`. Use the matching port in the browser. If dependency installation fails, confirm the Node version and rerun `npm run setup`; this uses `npm ci` and does not require a root `node_modules` folder.

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
VITE_API_BASE=https://your-sync-server.example npm run build
npx cap sync android
cd android && ./gradlew assembleDebug                           # APK: app/build/outputs/apk/debug/app-debug.apk
```

The Android sign-in screen also accepts a facility HTTPS sync server URL at runtime, so the APK can be configured without rebuilding. The local Capacitor `http://localhost` origin is retained to preserve existing on-device IndexedDB data across upgrades; Android blocks cleartext network traffic. An HTTPS server with a certificate trusted by the device is required for online use.

## Public prototype deployment

The root [`render.yaml`](render.yaml) is a Render Blueprint for a **paid Starter web service with a persistent disk**. SQLite records cannot survive restarts on Render's free web service. The Blueprint sets the build/start commands, HTTPS-proxy mode, health check, Node version, and an explicit public-demo mode. Its public accounts use the demo passwords above. **Only fictional screening data belongs on this deployment.** Do not use it to provide clinical care.

1. Publish this repository as **Public** on GitHub. Check the repository link in a signed-out browser window before submitting it.
2. Create or sign in to a Render account. In the dashboard choose **New → Blueprint**, connect the GitHub repository, select its default branch, and use `render.yaml` from the repository root. Review the paid plan and disk cost before creating the service.
3. When Render requests `MATERNAWELL_DATA_KEY`, generate a **new 32-byte hexadecimal key** locally and paste its 64 characters into the secret field. Keep it private and backed up. PowerShell: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. macOS/Linux: the same Node command. Never commit the key or put it in a document.
4. Create the Blueprint service. Wait for its deploy to be **Live**. Render provides a unique HTTPS `onrender.com` URL. Visit `<your URL>/api/health` and check for `"status":"ok"`.
5. Open `<your URL>/login`. Sign in using `HW-01`, `SUP-01`, and `ADMIN-01` in separate sessions to verify the actor flows. Open `<your URL>/self-referral` in a private window for the anonymous flow. Use fictional data. Refresh and sign in again to confirm records persist on the disk.
6. Open the public URL and the GitHub URL in a signed-out/private browser window. Put the exact verified URLs in the submission document. Do not guess the Render subdomain.

Outside this explicit prototype mode, production does **not** seed demo accounts. A real clinical deployment requires approved account provisioning and password management, verified referral contacts, validated Yoruba EPDS wording, clinical field testing, and a background escalation delivery path. `MATERNAWELL_ALLOWED_ORIGINS` adds allowed CORS origins for Android; its Capacitor origin is allowed by default. Production requires `NODE_ENV=production`, a fixed `MATERNAWELL_DATA_KEY`, and a trusted HTTPS reverse proxy with `TRUST_HTTPS_PROXY=true`.

See [`SUBMISSION.md`](SUBMISSION.md) for the 5–10 minute demo outline and final link checks.

## Known gaps (need input from the project owner)

1. **Crisis contacts:** `maternawell-app/src/config/crisisContacts.js` contains 112 and Lagos Lifeline from official public sources. These numbers have not been live-tested at a facility; confirm local availability and a backup route before clinical use.
2. **Yoruba EPDS:** the UI has draft Yoruba labels. The clinical questions stay in English until the validated
   Adewuya et al. (2006) wording is supplied. Machine translation was deliberately not used.
3. **Escalation delivery:** urgent cases appear in the supervisor dashboard on the next sync, with optional device notifications while that dashboard is open. Offline workers must hand off directly. Background push/SMS to another device is not configured; a live gateway needs an account, credentials, and clinical delivery testing.
4. **Account management:** accounts are seeded. There is no in-app user administration or password reset.
5. **Field validation** on real low-end Android devices over 2G, and a full 8–12 hour shift test, have not been done.

See `maternawell-app/IMPLEMENTATION_SUMMARY.md` for requirement-by-requirement traceability.
