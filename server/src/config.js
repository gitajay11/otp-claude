/**
 * Centralised configuration.
 *
 * Everything the server needs from the environment is read and validated
 * here, once, so the rest of the codebase can import a frozen `config`
 * object instead of poking at `process.env` directly.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

// Load server/.env (falling back to a repo-root .env). Existing process env wins.
dotenv.config({
  path: [path.join(SERVER_ROOT, '.env'), path.resolve(SERVER_ROOT, '..', '.env')],
  quiet: true,
});

const env = process.env;
const isProd = env.NODE_ENV === 'production';

/** JWT secret: mandatory in production, ephemeral (with a warning) in development. */
function resolveJwtSecret() {
  const secret = env.JWT_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (isProd) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }
  console.warn(
    '[config] JWT_SECRET is missing or shorter than 32 chars — using a random per-process secret. ' +
      'Sessions will be invalidated on every restart.',
  );
  return crypto.randomBytes(48).toString('hex');
}

const smtpPort = Number(env.SMTP_PORT) || 587;

export const config = Object.freeze({
  env: env.NODE_ENV || 'development',
  isProd,
  appName: env.APP_NAME?.trim() || 'Nexus',
  port: Number(env.PORT) || 4000,
  /** Value for Express' "trust proxy" setting (needed for correct client IPs behind a reverse proxy). */
  trustProxy: env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : false,
  dbPath: path.resolve(SERVER_ROOT, env.DB_PATH || 'data/nexus.db'),
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),

  jwt: Object.freeze({
    secret: resolveJwtSecret(),
    issuer: 'nexus-auth',
    expiresIn: '7d',
    cookieName: 'nexus_session',
    cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  }),

  smtp: Object.freeze({
    host: env.SMTP_HOST?.trim() || '',
    port: smtpPort,
    // Implicit TLS on 465; STARTTLS is negotiated automatically on 587/25.
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : smtpPort === 465,
    user: env.SMTP_USER?.trim() || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM?.trim() || '',
  }),

  otp: Object.freeze({
    length: 5,
    ttlMs: 5 * 60 * 1000, // codes expire after 5 minutes
    maxAttempts: 5, // wrong guesses allowed per code
    resendCooldownMs: 30 * 1000, // 1 send per 30 s per email
    hourlyLimit: 5, // 5 sends per rolling hour per email
    bcryptRounds: 10,
  }),
});
