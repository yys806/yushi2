# Backend Skeleton (Express + TypeScript)

## Quick Start

1. Copy config template:

```bash
cp config/config.template.json config/config.local.json
```

2. Fill only your SiliconFlow API key in `config/config.local.json`:

```json
{
  "siliconflow": {
    "apiKey": "YOUR_REAL_API_KEY"
  }
}
```

`baseUrl`, `textModel`, `imageModel` already have defaults for this project.

3. Install and run:

```bash
npm install
npm run start:dev
```

Server default:
- `http://127.0.0.1:8080`

## Implemented Skeleton APIs

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

> This is a project skeleton for fast startup. Data is currently in-memory in `src/server.ts`.
> Next step: switch user/work/favorite persistence to PostgreSQL via Prisma.
