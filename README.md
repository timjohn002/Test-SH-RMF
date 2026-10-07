# Starhub RMF

Web app for managing robots, doors and elevators across building floors.

**Current features**
- **Map** (`/`): floor selector, drag/zoom floor plans, cursor position in meters.
- **Setup** (`/setup`): add floors, upload floor plans, and calibrate scale and origin.
- **Robots** (`/robots`): live status of every vendor robot (online, battery, work state, current task).
- **Vendors** (`/vendors`, admins only): configure robot vendor integrations. **Keenon** is supported.
- **Users** (`/users`, admins only): add and delete accounts, and reset passwords.

Door and elevator integration, and robot commands, come later.

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

## Robot vendors
Each vendor integration is code. There's one adapter folder per vendor, registered in a list:

| Piece | Where |
|---|---|
| Adapter interface | `netlify/vendors/types.ts` |
| Server registry | `netlify/vendors/index.ts` |
| Keenon adapter (API client, callbacks, signature) | `netlify/vendors/keenon/` |
| Config page per vendor | `src/vendors/index.ts` → `src/vendors/keenon/KeenonConfig.tsx` |
| Tables | `supabase/migrations/0002_vendors.sql` (`vendor_configs`, `vendor_stores`, `robots`, `vendor_events`) |

To add a vendor, write an adapter that implements `VendorAdapter`, add it to both registries, and give it a config page.

### Keenon setup
1. Run `supabase/migrations/0002_vendors.sql` once.
2. **Keenon only accepts API calls from whitelisted IPs.** Netlify has no fixed outbound IP, so run the app locally on the whitelisted network (`npm run dev`).
3. Go to **Vendors → Keenon** and choose the region:

   | Region | Base URL |
   |---|---|
   | Global | `www.robotkeenon.com` |
   | China | `console.peanut.keenonrobot.com` |
   | EU | `es.robotkeenon.com` |
   | Japan | `cloud.robotkeenon.com` |
   | Custom | any URL you enter |

4. Enter the client ID and secret, then click **Save & test connection**.
5. Pick stores and click **Sync now**.
6. Give Keenon the **callback URL** shown on the page. It uses `PUBLIC_SITE_URL`, so it points to the live site even when the app runs locally. Callbacks are logged on the page for 30 days.
7. Optional: once Keenon support has enabled callback signing, turn on **Require signature**.

Environment variables:

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Public base URL used in callback URLs |
| `KEENON_SCHEDULED_SYNC=true` | Hourly robot re-sync. Only enable it once the server has a whitelisted outbound IP. |

### Testing without real robots
```bash
npm run keenon:mock      # fake Keenon Cloud on http://localhost:4010 (client "mock-client" / "mock-secret")
npm run keenon:callbacks -- --url <callback URL> [--secret <client secret>]   # replays the API doc's callback examples
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | App and API locally on :8888 |
| `npm run build` | Type-check and production build |
| `npm test` | Unit tests (coordinates, passwords, sessions, Keenon client and callbacks) |
| `npm run create-user` | Create or reset an account from the command line |
| `npm run keenon:mock` | Fake Keenon Cloud for local testing |
| `npm run keenon:callbacks` | Send example Keenon callbacks to a webhook URL |

## Security notes
- Sessions are HS256 JWTs in an `HttpOnly; SameSite=Strict` cookie, valid for 12 hours. Every request re-checks the account in the database, so a deleted account is signed out immediately.
- After 5 failed sign-ins, an account is locked for 15 minutes. An admin password reset unlocks it.
- The server refuses to delete your own account or the last admin.
- Changing `SESSION_SECRET` signs everyone out.
