# Starhub RMF

Web app for managing robots, doors and elevators across building floors.

**Current features**
- **Map** (`/`): floor selector, drag/zoom floor plans, cursor position in meters.
- **Setup** (`/setup`): add floors, upload floor plans, and calibrate scale and origin.
- **Users** (`/users`, admins only): add and delete accounts, and reset passwords.

Robot, door and elevator integration comes later.

## Architecture

```
Browser (React + Vite SPA)
   │  fetch /api/*  (HttpOnly session cookie)
   ▼
Netlify Functions  (netlify/functions)  ── service-role key ──▶  Supabase Postgres + Storage
```

- The browser **never** talks to Supabase with a key. All data goes through `/api/*` functions, which check the session and role.
- Accounts live in the `app_users` table, with passwords hashed using **bcrypt**. Supabase Auth and email are not used.
- Row-level security is enabled with no policies, so the public anon key can't read any table. The `floor-plans` storage bucket is private, and images are shown through 1-hour signed URLs.
- Floor plan coordinates: each floor stores `scale_m_per_px` and an origin in pixels. World coordinates are in meters, with +Y pointing up (ROS / Open-RMF convention). See `src/lib/coords.ts`.

## First-time setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and click **Run**.

### 2. Local settings (`.env.local`)
`.env.local` in the project folder holds your settings and is never committed. If it's missing, copy `.env.example`. Fill in:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → **Data API** → Project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → **API Keys** → **Secret key** (`sb_secret_…`), or the legacy `service_role` key. **Not** the publishable/anon key. |
| `SESSION_SECRET` | Any random string of 32+ characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

### 3. Create the first admin account
```bash
npm install
npm run create-user -- --username admin --role admin
```
The script prints a randomly generated password. Sign in with it, then change it from the user menu (top right).

Other uses:
```bash
npm run create-user -- --username bob                    # new "user" account, random password
npm run create-user -- --username bob --password 'S3cret!!'
npm run create-user -- --username admin --reset          # forgot the admin password? set a new one
```

### 4. Run locally
```bash
npm run dev          # http://localhost:8888  (Vite + Netlify Functions together)
```

## Deploying (GitHub → Netlify)
1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project → GitHub** and pick the repo. The build settings come from `netlify.toml`.
3. Under **Site configuration → Environment variables**, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` (the same values as `.env.local`).
4. Deploy. Every push to the main branch redeploys.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | App and API locally on :8888 |
| `npm run build` | Type-check and production build |
| `npm test` | Unit tests (coordinates, passwords, sessions) |
| `npm run create-user` | Create or reset an account from the command line |

## Security notes
- Sessions are HS256 JWTs in an `HttpOnly; SameSite=Strict` cookie, valid for 12 hours. Every request re-checks the account in the database, so a deleted account is signed out immediately.
- After 5 failed sign-ins, an account is locked for 15 minutes. An admin password reset unlocks it.
- The server refuses to delete your own account or the last admin.
- Changing `SESSION_SECRET` signs everyone out.
