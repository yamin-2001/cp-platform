# CPLab — Competitive Programming Training Platform

A platform that syncs with your Codeforces account and suggests problems you've never attempted, based on your rating.

## Tech Stack
- **Backend** — Node.js, Express 5, MongoDB, Mongoose 9, JWT (httpOnly cookies)
- **Frontend** — React 19, Vite, Tailwind CSS v4, DaisyUI 5
- **API** — Codeforces REST API

## Features
- Syncs your CF submission history (paginated, so long histories are not truncated)
- Suggests unsolved problems based on your rating
- Smart / Upsolve / Stretch / Random strategies
- Sets your own estimated level if you have no Codeforces account
- Practice sets with progress tracking
- HttpOnly cookie authentication
- Dual light/dark theme

### How problems are selected

Each strategy defines a rating window *and* a target inside it, measured from
your level (your Codeforces rating, or the estimate you set on the Profile
screen):

| Strategy | Window | Aims for |
|---|---|---|
| Smart | −100 … +300 | slightly above your level |
| Upsolve | −400 … −1 | the harder end of the lower band |
| Stretch | +200 … +700 | the gentler end of the higher band |
| Random | the whole bank | nothing — the rating is not used at all |

Codeforces publishes problems in 100-point rating steps, so a rating window
only holds a handful of distinct levels. The results are therefore grouped by
rating level and filled round-robin across the levels closest to the target,
rather than ranking on a single scalar — otherwise the whole page filled with
problems of one rating.

## Setup
1. Clone the repo
2. `npm install` in both backend and frontend
3. Add your MongoDB URI and JWT secret to `backend/.env`
4. Run `npm run dev` (backend) and `npm run dev` (frontend)

### Environment

`backend/.env`:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | — | MongoDB connection string |
| `MONGODB_DB_NAME` | no | `cp-platform` | Database name |
| `JWT_SECRET` | yes | — | Signing key; 32+ chars in production |
| `PORT` | no | `4000` | Server port |
| `CLIENT_URL` | no | `localhost:3000`, `localhost:5173` | Comma-separated CORS allowlist |
| `NODE_ENV` | no | — | `production` enables secure cookies |

The server refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing, and
reports exactly what is missing rather than failing later at the first request.

## API

All responses use the shape `{ success: boolean, message?: string, ... }` and
carry a real HTTP status code. `401` means the session is invalid — the
frontend redirects to the login screen on it.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | no | Liveness + database state |
| `POST` | `/api/auth/register` | no | Create an account (rate limited) |
| `POST` | `/api/auth/login` | no | Sign in (rate limited) |
| `POST` | `/api/auth/logout` | no | Clear the session cookie |
| `GET` | `/api/auth/me` | yes | Current user |
| `PUT` | `/api/auth/update-profile` | yes | Update name / CF handle / estimated rating |
| `GET` | `/api/cf/validate/:handle` | yes | Look up a CF handle |
| `POST` | `/api/cf/sync` | yes | Sync submissions and stats |
| `GET` | `/api/cf/status` | yes | Last sync summary |
| `GET` | `/api/problems/suggestions` | yes | Ranked problem suggestions |
| `GET` | `/api/problems/search` | yes | Search the problem bank |
| `GET` | `/api/problems/tags` | yes | All available tags |
| `GET` | `/api/problems/sync-bank` | yes | Re-import the CF problem set (throttled) |
| `GET` | `/api/practicesets` | yes | List practice sets |
| `POST` | `/api/practicesets` | yes | Create a practice set |
| `GET` | `/api/practicesets/:id` | yes | One practice set |
| `PUT` | `/api/practicesets/:id/problems/:entryId` | yes | Set a problem's status |
| `DELETE` | `/api/practicesets/:id` | yes | Delete a practice set |
| `GET` | `/api/practicesets/stats` | yes | Dashboard stats |

## Testing

The backend has an integration suite that runs against a real MongoDB:

```bash
cd backend
MONGODB_URI=mongodb://127.0.0.1:27018 JWT_SECRET=<32+ chars> npm test
```

It covers the behaviours that are easy to break and hard to notice: the
"never attempted" exclusion, status transitions and their counters, NoSQL
injection through the login body, and rate limiting.

The frontend has a browser-driven end-to-end check that drives the real UI in
headless Chrome against a running backend:

```bash
cd frontend
node scripts/e2e-check.mjs http://localhost:5173
```

It signs in, walks every route, creates a practice set, flips a problem's
status and resets it, and fails on any console error or unexpected failed
request. Screenshots are written to `frontend/e2e-shots/`.

Two more focused browser checks cover the behaviours the main script does
not reach:

```bash
cd frontend
node scripts/e2e-fixes-check.mjs   http://localhost:5173  # tag filters, Clear, sync status
node scripts/e2e-register-check.mjs http://localhost:5173  # sign-up form, password length, handle
```

A fourth covers the suggestion algorithm and the collapsed tag panel:

```bash
cd frontend
node scripts/e2e-strategy-check.mjs http://localhost:5173  # strategies, tag panel, estimated rating
```

All four scripts also run against the production build:

```bash
cd frontend
npm run build && npx vite preview --port 4173
node scripts/e2e-check.mjs http://localhost:4173
```

