# Maternawell sync API

Zero-dependency Node service (Node 22.5+, `node:sqlite`, `node:crypto`). It serves the built app and the API on port 4000.

```bash
npm start   # http://127.0.0.1:4000
npm test    # node:test suite
```

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | – | Staff login → short-lived access and rotating refresh credentials |
| `POST /api/auth/refresh` | – | Exchange a refresh credential once for a new pair (7-day maximum lifetime per credential) |
| `POST /api/auth/logout` | staff | End session |
| `POST /api/sync/push` | staff | Batch ≤ 50 operations: `CREATE`, `FOLLOW_UP`, `SAFETY_CONFIRM`, `ACKNOWLEDGE`, `DELETE`, audit `CREATE`. Idempotent by operation id; gzip accepted |
| `GET /api/sync/pull?since=` | staff | Facility changes since a revision cursor (supervisors get restricted records) |
| `POST /api/self-referral` | – | Anonymous self-referral into a facility queue (rate limited) |
| `GET /api/facilities` | – | PHC directory |
| `GET /api/admin/audit` | admin | Audit trail and escalation notifications |

Data is stored in `server/data/maternawell.sqlite`, with each row AES-256-GCM encrypted. The key is in
`MATERNAWELL_DATA_KEY` or, in development, a generated `*.key` file next to the database.
Development seeds three PHCs with a health worker, a supervisor and an admin each (see the root README).
Production seeds no accounts unless `MATERNAWELL_PUBLIC_DEMO=true` is explicitly set for the public prototype; the demo uses the published sample credentials and must contain fictional data only. The Render Blueprint sets this mode and stores SQLite on a paid persistent disk. For a non-demo production service, provision approved staff accounts before use.
Escalations are queued for the facility dashboard; a supervisor viewing it online receives the case on sync and can enable local device notifications. There is no background SMS or push gateway. Urgent offline cases require direct staff handoff.
