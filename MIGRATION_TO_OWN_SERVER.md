# Full Migration to Your Own Server

This project can be fully migrated to your own server with minimal frontend code change by self-hosting the Supabase stack.

This repo now includes:

- `.env.selfhost.example` for frontend cutover vars
- `scripts/selfhost-smoke.mjs` for pre-cutover health checks
- `server/src/index.mjs` as API route scaffold (mapped from current edge functions)

## Why this path

- Current frontend already uses `supabase-js` deeply (`src/App.jsx`, `src/supabaseClient.js`).
- Current backend logic already exists as Supabase Edge Functions under `supabase/functions/*`.
- Fastest full migration is moving runtime from Supabase Cloud to your server, then switching `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Current feature inventory (already in repo)

- Auth + session: `supabase.auth.*` in `src/App.jsx`
- Database tables/RLS: `supabase/schema.sql`
- Edge functions (17): `supabase/functions/*`
  - `generate-work`, `rate-work`, `signup-user`, `admin-dashboard`, `review-application`
  - `publish-notice`, `update-notice`, `claim-reward`, `update-grade-probabilities`
  - `publish-museum-item`, `update-museum-item`, `adjust-user-quota`
  - `admin-delete-user`, `admin-delete-notice`, `admin-delete-museum-item`
  - `create-order`, `claim-s-grade-reward`

## Cutover architecture

1. Self-host Supabase stack on your VPS (DB/Auth/REST/Realtime/Storage/Functions).
2. Restore schema and data from cloud project.
3. Deploy the same Edge Functions to self-host target.
4. Run smoke test from this repo.
5. Switch frontend env vars and redeploy.

## Step-by-step

### 1) Prepare server

- Linux server with 4C/8G+ recommended
- Docker + Docker Compose installed
- Domain and TLS ready (e.g. `api.yourdomain.com`)

### 2) Deploy self-host Supabase

- Follow official self-hosted Supabase deployment to bring up services.
- Keep these values safe: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, DB password.

### 3) Import schema and data

- Apply schema from this repo first: `supabase/schema.sql`.
- Export data from current cloud project and import into self-host Postgres.
- Re-check critical tables: `user_profiles`, `works`, `favorites`, `quota_applications`, `notices`, `museum_items`.

### 4) Deploy functions to self-host

- Point Supabase CLI to your self-host API endpoint.
- Set required secrets (same keys currently used in cloud).
- Deploy functions from this repo (`supabase/functions/*`).

### 5) Run smoke test (already added)

Use the script in this repo:

```bash
set TARGET_SUPABASE_URL=https://YOUR_SELFHOST_DOMAIN
set TARGET_SUPABASE_ANON_KEY=YOUR_SELFHOST_ANON_KEY
set SMOKE_TEST_EMAIL=YOUR_TEST_USER_EMAIL
set SMOKE_TEST_PASSWORD=YOUR_TEST_USER_PASSWORD
npm run selfhost:smoke
```

Expected output contains:

- `[selfhost-smoke] OK`
- valid user identity
- successful `admin-dashboard` function response

### 6) Switch frontend to self-host and redeploy

Use `.env.selfhost.example` as template, then deploy frontend with:

- `VITE_SUPABASE_URL` = your self-host URL
- `VITE_SUPABASE_ANON_KEY` = your self-host anon key

## Rollback strategy

- Keep cloud env vars in backup.
- If cutover fails, restore old env vars and redeploy frontend (fast rollback).

## Post-cutover checks

- Register/login works
- Generate work + AI rating works
- Favorites/history are isolated per account
- Admin `/admin` login and actions work
- Museum publish/edit/delete works

## Local scaffold commands

```bash
npm run server:dev
```

- Health: `GET /healthz`
- Route inventory: `GET /api/_inventory`
