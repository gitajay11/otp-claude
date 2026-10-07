# NEXUS//AUTH — Passwordless Email-OTP Authentication

A production-quality sign-up and log-in system using **5-digit email one-time codes**, with a dark, neon, "terminal" visual theme.

- **Frontend:** React 19 (Vite) · Tailwind CSS v4 · Framer Motion
- **Backend:** Node.js · Express 5 · Nodemailer (SMTP)
- **Storage:** SQLite via Node's built-in `node:sqlite` (no native build step)
- **Auth:** JWT in an `httpOnly` cookie

---

## Features

**Sign up:** first name, last name, email, a searchable country-code picker (flag · name · dial code, default 🇮🇳 +91) and a mobile number checked against that country's *mobile* number lengths. Every field is validated live, and an invalid submit shakes the form. A styled HTML email delivers the code. If the email is already registered, you get an inline error with a "Log in instead" link.

**Log in:** passwordless, with the email field only. Unknown emails get a "Sign up instead" prompt, and the email carries over to the other page.

**OTP step** (shared by both flows):
- 5 single-digit boxes. Focus moves forward as you type and back on Backspace. Arrow, Home and End keys work.
- Pasting a whole code fills from the first box, and stray characters like spaces or dashes are ignored. Browser autofill of one-time codes also works (`autocomplete="one-time-code"`).
- The code submits automatically after the 5th digit.
- While verifying, a neon ring orbits the input group.
- On success, the ring collapses into a stroke-drawn green ✓, the boxes glow green, and you're redirected.
- On failure, a red ✕ is drawn, the boxes shake and glow red, then clear and refocus the first box. You're told how many attempts remain.
- Shows a code-expiry countdown, "Resend OTP in 0:30" followed by a resend button, and an "Edit email" link.

**UI:**
- Animated particle network that reacts to the pointer, on a panning grid.
- Glassmorphism cards with neon borders, a typing-effect heading, and floating labels.
- Focus glow with an animated underline, button glow and sheen with press-scale and an inline spinner, and toast notifications.
- A 3D card flip between Sign Up and Log In.
- Responsive from 320 px up.
- Respects `prefers-reduced-motion`: Framer transforms are disabled, CSS animations stop, and the background draws a single static frame.

**Accessibility:**
- Real `<label>`s, plus `aria-invalid` and `aria-describedby` on fields.
- The country picker follows the ARIA combobox/listbox pattern.
- The OTP boxes form a labelled group, each digit has its own label, and status is announced through live regions.
- A skip link is provided, and focus states are visible.

---

## Project structure

```
├── package.json            # npm workspaces + root scripts
├── shared/                 # validation rules used by BOTH client & server
│   └── phone.js            #   per-country mobile-number length rules
├── server/
│   ├── .env.example
│   └── src/
│       ├── index.js        # Express app (also serves client/dist in production)
│       ├── config.js       # env loading & validation
│       ├── db.js           # SQLite schema + user queries
│       ├── routes/auth.js  # API endpoints
│       ├── services/
│       │   ├── otpService.js   # generate / hash / rate-limit / verify
│       │   └── mailer.js       # Nodemailer transport
│       ├── templates/otpEmail.js  # themed HTML email
│       ├── middleware/index.js    # validation, auth, rate limit, CSRF, errors
│       └── validation/schemas.js  # zod request schemas
└── client/
    └── src/
        ├── components/     # Input, CountryCodeSelect, OtpInput, OtpVerification,
        │                   # Button, Toast, AuthCard, Background, TypingHeading, Spinner
        ├── pages/          # SignUp, LogIn, Dashboard
        ├── context/        # AuthContext (session state)
        ├── hooks/          # useCountdown
        └── lib/            # api client, validation, countries, motion presets
```

---

## Setup

### Prerequisites
- **Node.js ≥ 22.13** (uses the built-in `node:sqlite`; tested on Node 24)
- An SMTP account (Gmail, Outlook, Mailtrap, Brevo, SES, …)

### 1. Install

```bash
npm install
```

This installs all three workspaces (`shared`, `server`, `client`).

### 2. Configure

```bash
cp server/.env.example server/.env
```

Fill in `server/.env`:

| Variable | Description |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | SMTP server. Port 465 uses implicit TLS; 587 uses STARTTLS. |
| `SMTP_USER`, `SMTP_PASS` | SMTP credentials |
| `MAIL_FROM` | Sender, e.g. `"Nexus Security <you@gmail.com>"` |
| `JWT_SECRET` | ≥ 32 random chars (required in production). Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `production` enables `Secure` cookies and requires `JWT_SECRET` |
| `TRUST_PROXY` | Set (e.g. `1`) behind a reverse proxy so rate limits see real IPs |
| `DB_PATH` | SQLite file (default `server/data/nexus.db`) |

> **Gmail:** enable 2-Step Verification, create an *App Password* (Google Account → Security → App passwords), and use it as `SMTP_PASS` with `smtp.gmail.com:465`.
>
> **Just testing?** A [Mailtrap](https://mailtrap.io) sandbox inbox captures every email without delivering it.

On startup the server verifies the SMTP connection and logs the result.

### 3. Run (development)

```bash
npm run dev
```

- Client: http://localhost:5173 (Vite, hot reload; proxies `/api` to the server)
- API: http://localhost:4000

### 4. Run (production)

```bash
npm run build
npm start
```

Express serves the built client and the API from one origin at http://localhost:4000. Set `NODE_ENV=production` and a real `JWT_SECRET` in `server/.env`, and serve over HTTPS (the session cookie is `Secure` in production).

---

## API

All endpoints are under `/api/auth`. Mutating requests must send `Content-Type: application/json`. Errors use the shape `{ "error": { "code", "message", ...extra } }`.

| Method & path | Body | Success | Notable errors |
|---|---|---|---|
| `POST /signup/send-otp` | `{ firstName, lastName, email, country, phone }` | `200 { email, expiresInSec, resendAfterSec }` | `400 VALIDATION_ERROR` (+`fields`), `409 EMAIL_EXISTS`, `429 OTP_COOLDOWN` / `OTP_HOURLY_LIMIT` (+`retryAfterSec`) |
| `POST /signup/verify-otp` | `{ email, otp }` | `201 { user }` + session cookie | `401 OTP_INVALID` (+`attemptsRemaining`), `429 OTP_LOCKED`, `410 OTP_EXPIRED`, `400 OTP_NOT_FOUND` |
| `POST /login/send-otp` | `{ email }` | `200 { email, expiresInSec, resendAfterSec }` | `404 EMAIL_NOT_FOUND`, `429 …` |
| `POST /login/verify-otp` | `{ email, otp }` | `200 { user }` + session cookie | as above |
| `GET /me` | — | `200 { user }` | `401 UNAUTHENTICATED` |
| `POST /logout` | `{}` | `200` | — |

`country` is an ISO 3166-1 alpha-2 code (e.g. `IN`) and `phone` is digits only. The server derives the dial code itself.

---

## Security

| Requirement | Implementation |
|---|---|
| OTP generation | `crypto.randomInt` (CSPRNG), zero-padded to 5 digits |
| Hashed at rest | Only the **bcrypt** hash is stored (`otps.otp_hash`). The plain code exists in memory just long enough to send. |
| 5-minute expiry | `expires_at` is checked on verify. Expired rows are pruned every 10 min. |
| Max 5 wrong attempts | The attempt counter is incremented **atomically before** the bcrypt comparison, so parallel requests can't exceed the limit. On the 5th miss the code is burned and a new one is required. |
| Single use | Consumed atomically (`UPDATE … WHERE consumed_at IS NULL`). Issuing a new code invalidates older ones. |
| Rate limiting | Per email: 1 send per 30 s and 5 per rolling hour, stored in SQLite so it survives restarts. Per IP (`express-rate-limit`): 20 sends and 60 verifies per 15 min. |
| Input validation | **zod** schemas on every endpoint trim, normalise (lower-case email) and strip unknown keys. Names allow Unicode letters only. Mobile numbers are checked against the country's mobile lengths using the same `shared/phone.js` as the client. |
| No OTP leakage | API responses never include the code. Request logging (`morgan`) records method, URL and status only, never bodies. Mail errors are logged by message only. The email subject and preview text don't contain the code. |
| Session | HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) with a 7-day expiry. The user is re-loaded on every `/me`. |
| CSRF | `SameSite` cookies, plus mandatory `application/json` on mutating API calls (HTML forms can't send that cross-site without a CORS preflight). |
| Headers | `helmet` (CSP, HSTS, no-sniff, …). `x-powered-by` is disabled. The JSON body limit is 10 kB. |

**Trade-off to know about:** as the spec requires, the API tells callers whether an email is registered ("already registered" / "not found"). That allows account enumeration; the per-IP rate limits slow it down. If enumeration matters for your threat model, return a generic "if this email exists, we've sent a code" response instead.

---

## Troubleshooting

- **`[mail] SMTP verification failed`**: check host, port and credentials. Gmail requires an App Password, not your normal password. Port 465 needs `secure`, which is automatic on 465.
- **"Email service is not configured" (503)**: `SMTP_HOST` or `MAIL_FROM` is missing in `server/.env`.
- **Logged out after every server restart**: set `JWT_SECRET`. Without it, a random per-process secret is used in development.
- **Flags show as letters ("IN") on Windows**: Windows has no flag emoji, so the app loads a small flags-only font from jsDelivr. Make sure that CDN isn't blocked.
