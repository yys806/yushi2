# Backend (Express + Prisma + Supabase Postgres)

## What is already configured

- Express API routes are connected to Prisma (no in-memory storage now)
- Prisma models include: `User`, `Work`, `Favorite`, `Order`, `RechargePackage`
- Startup auto-seeds recharge packages (`9.9/100`, `19.9/300`, `39.9/1000`)
- SiliconFlow text/image generation config is supported

## You only need to fill these values

Create `backend/.env` from `backend/.env.example`, then replace placeholders:

```env
JWT_SECRET=YOUR_RANDOM_SECRET
DATABASE_URL=YOUR_SUPABASE_POOLER_URL
DIRECT_URL=YOUR_SUPABASE_DIRECT_URL
SILICONFLOW_API_KEY=YOUR_SILICONFLOW_API_KEY
```

For your current project ref (`yclkwilangwsmnnpqmwc`), templates are already prepared in `backend/.env.example`.

Notes:
- `DATABASE_URL`: Supabase pooler URL (`...pooler.supabase.com:6543...`)
- `DIRECT_URL`: Supabase direct URL (`db.<project-ref>.supabase.co:5432`)
- `PORT`, `SILICONFLOW_BASE_URL`, models already have defaults unless you want custom values.

## Optional config file

If you prefer config file override for SiliconFlow, copy:

```bash
cp config/config.template.json config/config.local.json
```

Then only fill:

```json
{
  "siliconflow": {
    "apiKey": "YOUR_REAL_API_KEY"
  }
}
```

## First-time setup commands

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init_supabase
npm run start:dev
```

Production deploy migration command:

```bash
npx prisma migrate deploy
```

Detailed step-by-step guide (Netlify + Supabase + backend hosting):

- `部署配置步骤.md`

## Health check

- `GET http://127.0.0.1:8080/health`
- Should return `{"ok":true,"db":true}`

## Implemented APIs

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /generate/work`
- `GET /works/history`
- `GET /works/:id`
- `POST /works/:id/favorite`
- `DELETE /works/:id/favorite`
- `GET /works/favorites`
- `GET /recharge/packages`
- `POST /recharge/order`
