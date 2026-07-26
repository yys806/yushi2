# Tencent Cloud + BT + Docker Configuration (No 8080/5678)

Your current server status (confirmed):

- `http://<你的服务器IP>/` returns `200` (Nginx available)
- `:8080` is occupied
- `:5678` is occupied
- `:8000` is not externally reachable

This guide avoids port conflicts and keeps Supabase internal ports private.

## 1. Host port plan

- Supabase Kong: `127.0.0.1:8001 -> container:8000`
- Supabase Studio: `127.0.0.1:3100 -> container:3000`
- Postgres: `127.0.0.1:55432 -> container:5432`

Do not expose these ports publicly. Use BT reverse proxy for external access.

## 2. Apply docker compose override

Place this file into your self-host Supabase compose directory:

- `deploy/tencent-bt/docker-compose.override.yml`

Then restart stack:

```bash
docker compose down
docker compose up -d
```

## 3. BT reverse proxy setup

Recommended with domain:

- `api.yourdomain.com` -> reverse proxy to `http://127.0.0.1:8001`
- `studio.yourdomain.com` -> reverse proxy to `http://127.0.0.1:3100` (optional, admin only)

BT steps:

1. Add website in BT for each domain.
2. Enable SSL (Let's Encrypt).
3. Set reverse proxy target to local port.
4. Keep websocket support enabled.

If you only have IP and no domain yet, you can test via IP, but production frontend (HTTPS) should use HTTPS API domain to avoid mixed-content failures.

## 4. Tencent Cloud security group

Open only:

- `80/tcp`
- `443/tcp`
- `22/tcp` (or your custom SSH port)

Do not open `8001`, `3100`, `55432`, `8080`, `5678` to public.

## 5. Frontend cutover vars

After reverse proxy is ready:

- `VITE_SUPABASE_URL=https://api.yourdomain.com`
- `VITE_SUPABASE_ANON_KEY=<your-selfhost-anon-key>`

Use `.env.selfhost.example` as template.

## 6. Smoke check

Run from this repo:

```bash
set TARGET_SUPABASE_URL=https://api.yourdomain.com
set TARGET_SUPABASE_ANON_KEY=<your-selfhost-anon-key>
set SMOKE_TEST_EMAIL=<test-email>
set SMOKE_TEST_PASSWORD=<test-password>
npm run selfhost:smoke
```

Expected:

- output contains `[selfhost-smoke] OK`
