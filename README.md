# PW-MARCO

Next.js study platform for PW batches with an admin panel, guest/login modes and Neon Postgres storage.

## Features
- Batches list loaded from an admin-editable JSON link (default: GitHub `batches.json`)
- Default PW-MARCO banner for batches without an image
- Enroll -> Study (today's classes) -> My Batches flow
- Admin panel at `/admin` (controls, users, guests, tokens, batches)

## Deploy on Heroku
1. Push this repo to GitHub and connect it to a Heroku app (or `heroku git:remote`).
2. Set config vars from `.env.example` (`DATABASE_URL`, `ADMIN_*`, `JWT_SECRET`, ...).
3. Deploy — `heroku-postbuild` runs `next build`, the `release` phase runs DB migrations, `web` starts the server.

## Local development
```bash
npm install
cp .env.example .env   # fill in values
npm run dev
```

## Changing the batches list
Admin > Controls > **Batches source URL**: paste a new JSON link, click **Test link**, then **Save**. The Batches page updates immediately.
