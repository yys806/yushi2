# Supabase Full Backend Setup

This project uses Supabase as the full backend (auth, database, and edge functions).

## 1) Apply database schema

In Supabase SQL Editor, run `supabase/schema.sql`.

## 2) Authenticate Supabase CLI

Use either login flow or access token.

### Option A: browser login

```bash
npx supabase login
```

### Option B: access token (CI/headless)

PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN="YOUR_SUPABASE_ACCESS_TOKEN"
```

CMD:

```cmd
set SUPABASE_ACCESS_TOKEN=YOUR_SUPABASE_ACCESS_TOKEN
```

Verify auth:

```bash
npx supabase projects list
```

## 3) Link project

```bash
npm run supabase:link
```

## 4) Set edge function secrets

```bash
npx supabase secrets set SILICONFLOW_API_KEY=YOUR_SILICONFLOW_API_KEY
npx supabase secrets set SILICONFLOW_TEXT_MODEL=Pro/MiniMaxAI/MiniMax-M2.5
npx supabase secrets set SILICONFLOW_IMAGE_MODEL=Qwen/Qwen-Image
```

## 5) Deploy edge functions

```bash
npm run supabase:deploy:functions
```

This deploys:

- `generate-work`
- `create-order`
- `signup-user` (JWT verification disabled to allow pre-login registration)
- `admin-dashboard`
- `review-application`
- `publish-notice`
- `admin-delete-user`
- `admin-delete-notice`

Note: all functions are deployed with `--no-verify-jwt` at gateway level, but each function performs auth checks internally via `Authorization` header and `supabase.auth.getUser()`. This avoids gateway-side `Invalid JWT` false negatives while keeping business actions protected.

## 6) Netlify environment variables

Set in Netlify site settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 7) Smoke test

1. Register a normal account (directly signs in, no email confirmation dependency, starts with 5 free quota).
2. Register/login `3492675568@qq.com` (should be admin with unlimited quota).
3. Generate once and verify history/favorites are account-isolated.
4. Submit quota application from user page (`10/100/1000` options).
5. Open `/admin` with admin account, approve/reject applications, publish notice.
6. Verify user side receives notice and approval status updates.
