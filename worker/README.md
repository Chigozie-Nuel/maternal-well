# Cloudflare prototype API

This Worker mirrors the local Node API's public endpoints and uses D1 for shared demo data. It is deployed with root `wrangler.jsonc`. The database schema is in `migrations/0001_initial.sql`; the AES-GCM key is a Worker secret named `MATERNAWELL_DATA_KEY`. `PUBLIC_DEMO=true` enables only the published fictional demo accounts, and `ALLOWED_ORIGIN` allows the GitHub Pages frontend to call the API.

Deploy from the repository root:

```text
npm install
npx wrangler login
npx wrangler d1 create maternawell-prototype --binding DB
# Put the returned database ID into wrangler.jsonc.
npx wrangler d1 migrations apply maternawell-prototype --remote
npx wrangler secret put MATERNAWELL_DATA_KEY
npx wrangler deploy
```

Supply a random 64-character hexadecimal value at the secret prompt and keep a private backup. For a local Worker, put `MATERNAWELL_DATA_KEY=<hex value>` in `.dev.vars`, apply the migrations with `--local`, and run `npx wrangler dev`. The integration smoke test uses `API_BASE=<Worker URL> node worker/smoke.mjs` and writes one explicitly fictional case. The local Node API and its test suite remain available under `server/`.
