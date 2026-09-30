# NorthStar — PDF & Image Tools

A glassmorphism web app for merging PDFs and compressing images, with real accounts,
a usage dashboard, and a Node/Express + MongoDB backend that never writes your
files to disk.

```
NORTHSTAR PDF COMPRASSOR
├── backend/      Express API, MongoDB, pdf-lib + Sharp
└── frontend/     React 19 + Vite + React Router
```

## Features

| Route            | What it does                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| `/`              | Landing page: hero, feature grid, how-it-works, FAQ                              |
| `/pdf-merger`    | **Account required.** Drag up to 20 PDFs, reorder them, merge, download           |
| `/image-compressor` | **Account required.** Compress JPG/PNG/WEBP with a quality + max-dimension target, preview, download individually or as a ZIP |
| `/signin`        | Email + password sign-in                                                           |
| `/signup`        | Create an account (live validation, password strength meter)                      |
| `/dashboard`     | Protected: merge/compression counts, bytes saved, recent activity                  |
| `/account`       | Protected: change display name, sign out, sign out everywhere                     |

### Accounts and sessions

- **Both tools require an account.** The `/pdf-merger` and `/image-compressor` routes
  redirect a signed-out visitor to `/signin`, and the API refuses the uploads with a
  `401` — the server is the enforcement point, the route guard is just the explanation.
- **Sessions end when you reload the page.** A refresh always asks you to sign in again.
  This is deliberate: `AuthProvider` never restores a session from the cookie on boot and
  clears it instead, and since a full page load is the only thing that re-mounts the
  provider, client-side navigation keeps you signed in while a refresh does not. The
  trade-off is that opening the site in a second tab signs you out of the first.


## Requirements

- Node.js 18+ (developed on Node 24)
- MongoDB 6+ running locally, or a connection string in `MONGO_URI`
- npm

## Setup

```bash
# 1. install
npm install
npm install --prefix backend
npm install --prefix frontend

# 2. configure
copy backend\.env.example backend\.env     # Windows
# cp backend/.env.example backend/.env    # macOS / Linux
# then edit backend/.env — at minimum set JWT_SECRET and MONGO_URI
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Environment variables

| Variable                        | Default                  | Notes                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| `PORT`                          | `5000`                   | API port                                          |
| `NODE_ENV`                      | `development`            | `production` turns on Secure cookies              |
| `MONGO_URI`                     | `mongodb://127.0.0.1:27017/northstar` | Database connection                     |
| `JWT_SECRET`                    | —                        | **Required.** 48+ random bytes                   |
| `JWT_EXPIRES_IN`                | `7d`                     | Session lifetime                                  |
| `COOKIE_NAME`                   | `northstar_session`      | Session cookie name                               |
| `ALLOWED_ORIGINS`               | `http://localhost:5173,http://localhost:5000` | Comma-separated CORS allowlist   |
| `PDF_MAX_FILES`                 | `20`                     |                                                   |
| `PDF_MAX_UPLOAD_MB`             | `50`                     | Per file                                          |
| `PDF_MAX_PAGES`                 | `1000`                   | Total pages per merge                             |
| `IMAGE_MAX_FILES`               | `20`                     |                                                   |
| `IMAGE_MAX_UPLOAD_MB`           | `15`                     | Per file                                          |
| `IMAGE_MAX_DIMENSION`           | `8000`                   | Longest-edge ceiling                              |

## Run

Two terminals — this keeps hot reload fast and the API logs readable.

```bash
npm run dev:backend     # http://localhost:5000
npm run dev:frontend    # http://localhost:5173
```

Then open <http://localhost:5173>. Vite proxies `/api` to port 5000, so the auth
cookie stays first-party in development exactly as it is in production.

### Production

```bash
npm run build --prefix frontend     # emits frontend/dist
npm start --prefix backend          # Express serves dist + /api on one origin
```

`NODE_ENV=production` makes the session cookie `Secure`, so serve it over HTTPS.

## Tests

With the API running:

```bash
npm test --prefix backend
```

28 end-to-end checks against the live server: signup validation, duplicate email,
guests being refused by the tool endpoints, cookie flags (`HttpOnly`, `SameSite=Lax`),
magic-byte rejection, PDF merge with reordering, `withoutEnlargement` resizing, ZIP
integrity, dashboard aggregation, token invalidation via logout-all, and CSP headers.
The run creates a throwaway account and deletes it afterwards.

Two browser checks drive real pages in headless Chrome, with the dev server up:

```bash
npm run test:gate --prefix backend   # account gate + refresh forces re-login
npm run test:faq  --prefix backend   # Home FAQ accordion opens and stays exclusive
```

Both talk to the DevTools protocol through Node's built-in `WebSocket`, so there is
nothing extra to install. `test:gate` covers the journey end to end: a signed-out
visitor is redirected to sign-in, signing in returns them to the tool they asked for,
a client-side hop stays signed in, and a reload signs them out again.

## API

### Auth
| Method | Path                     | Auth | Description                                  |
| ------ | ------------------------ | ---- | -------------------------------------------- |
| POST   | `/api/auth/signup`       | –    | Create account. Does **not** sign in. 201.   |
| POST   | `/api/auth/signin`       | –    | Sets the session cookie.                      |
| POST   | `/api/auth/logout`       | –    | Clears the cookie.                            |
| GET    | `/api/auth/me`           | ✔    | Current user.                                 |
| PATCH  | `/api/auth/me`           | ✔    | Update display name; re-issues the cookie.    |
| POST   | `/api/auth/logout-all`   | ✔    | Bumps `tokenVersion`, killing every session.  |
| GET    | `/api/dashboard`         | ✔    | Stats + last 8 activity rows.                 |

### Tools
| Method | Path                          | Auth | Description                                       |
| ------ | ----------------------------- | ---- | ------------------------------------------------- |
| POST   | `/api/pdf/merge`              | ✔    | `files[]` + optional `order`. Returns a PDF blob with `X-Page-Count`. |
| POST   | `/api/pdf/inspect`            | ✔    | Page counts for the upload cards.                  |
| POST   | `/api/image/compress`         | ✔    | `files[]` + `quality/format/maxWidth/maxHeight`. Returns base64 results. |
| POST   | `/api/image/compress-and-zip` | ✔    | Same input, streams a ZIP.                        |
| GET    | `/api/image/limits`           | –    | Server-side limits, so the UI cannot drift.       |
| GET    | `/api/health`                 | –    | Config + database status.                         |

`opt` means activity is recorded when signed in, but the request succeeds anonymously.

## Security notes

- **Passwords** are hashed with bcrypt (12 rounds) in a Mongoose pre-save hook.
  The plain value never reaches the database, and neither the hash nor the
  password is ever returned by the API.
- **Sessions** are a JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in
  production). No token is ever put in `localStorage`, so XSS cannot read it.
  A `tokenVersion` field lets you revoke every issued token at once. Sessions are
  not restored on page load, so a reload ends the session on both sides.
- **The tools are account-only** and the API enforces it: `/api/pdf/merge`,
  `/api/pdf/inspect`, `/api/image/compress` and `/api/image/compress-and-zip` all
  run behind `requireAuth`, so bypassing the client route guard gains nothing.
- **Uploads** are held in memory only. Every file is checked by extension, MIME
  type *and* magic bytes; images are decoded by Sharp inside a sandboxed libvips
  with a pixel-count limit to blunt decompression bombs.
- **Validation** is redone on the server. The client can send any value — quality,
  dimensions, reorder permutations — and it is clamped or rejected before use.
- **Headers**: `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, a locked-down
  `Permissions-Policy`, and a strict CSP (API responses get `default-src 'none'`;
  the app gets `default-src 'self'` plus `blob:` images for previews).
- **Rate limits** on auth, merge and compression endpoints.
- Errors return a clean message and status; stack traces never reach the client.

## Accessibility

Semantic landmarks, a skip link, labelled inputs with `aria-invalid` /
`aria-describedby` wiring, `role="alert"` for errors, focus-trapped modals with
Escape-to-close and focus restore, visible focus rings, keyboard-operable
dropzones, and `prefers-reduced-motion` support. The glass surfaces keep text
contrast above 4.5:1.

## Project layout

```
backend/
  config/         env validation, Mongo connection
  controllers/    auth + dashboard handlers
  lib/            tokens, validation helpers
  middleware/     auth guard, upload handling
  models/         User, Activity
  routes/         auth, dashboard, pdf, image
  scripts/        smoke-test.js, faq-check.js
  server.js       app wiring, security headers, static hosting

frontend/
  public/         logo-128.png, favicon-64.png
  src/
    components/   Navbar, Footer, Dropzone, RequireAuth, SignInPrompt, GlassModal,
                  Loader, toasts, icons
    context/      AuthContext (session), ToastContext (notices + confirm)
    lib/          api client, formatting helpers
    pages/        Home, PdfMerger, ImageCompressor, SignIn, SignUp, Dashboard, Account
    styles/       theme.css (tokens), background.css (nebula), components.css
```

The logo in `frontend/public` is derived from `frontend/image1.png`: its light outer
background was removed with an edge flood fill (a global white key would have punched
holes in the white glyph inside the badge), then trimmed and downsampled.
