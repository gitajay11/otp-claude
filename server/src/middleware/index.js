/**
 * Shared Express middleware: validation, auth, rate limiting, CSRF guard,
 * and the JSON error handler.
 */
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { users } from '../db.js';
import { HttpError } from '../utils/httpError.js';

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse `req.body` with a zod schema. On success the body is replaced with
 * the sanitised result; on failure a 400 with per-field messages is raised.
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] ?? '_form';
      fields[key] ??= issue.message;
    }
    return next(new HttpError(400, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields }));
  }
  req.body = result.data;
  next();
};

/* ------------------------------------------------------------------ */
/* CSRF guard                                                          */
/* ------------------------------------------------------------------ */

/**
 * State-changing API calls must be JSON. HTML forms can't send
 * `application/json` cross-site without a CORS preflight, so together with
 * SameSite cookies this blocks cross-site request forgery.
 */
export function requireJson(req, _res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json')) {
    return next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Requests must use Content-Type: application/json.'));
  }
  next();
}

/* ------------------------------------------------------------------ */
/* Sessions (JWT in an httpOnly cookie)                                */
/* ------------------------------------------------------------------ */

const cookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
};

export function startSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    algorithm: 'HS256',
  });
  res.cookie(config.jwt.cookieName, token, { ...cookieOptions, maxAge: config.jwt.cookieMaxAgeMs });
}

export function endSession(res) {
  res.clearCookie(config.jwt.cookieName, cookieOptions);
}

/** Populates `req.user` from the session cookie or responds 401. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[config.jwt.cookieName];
  if (!token) return next(new HttpError(401, 'UNAUTHENTICATED', 'You are not signed in.'));

  const expired = () => {
    endSession(res);
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.'));
  };

  let sub;
  try {
    ({ sub } = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer, algorithms: ['HS256'] }));
  } catch {
    return expired();
  }

  // Database errors propagate (500) rather than masquerading as a logout.
  const user = await users.findById(Number(sub));
  if (!user) return expired();
  req.user = user;
  next();
}

/* ------------------------------------------------------------------ */
/* Per-IP rate limits (the per-email OTP limits live in otpService)    */
/* ------------------------------------------------------------------ */

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      const retryAfterSec = Math.ceil(options.windowMs / 1000);
      res.status(429).json({ error: { code: 'IP_RATE_LIMITED', message, retryAfterSec } });
    },
  });

export const sendOtpIpLimiter = limiter(15 * 60 * 1000, 20, 'Too many requests from this network. Please try again later.');
export const verifyOtpIpLimiter = limiter(15 * 60 * 1000, 60, 'Too many verification attempts. Please try again later.');

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export function notFound(req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Endpoint not found.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    if (err.extra?.retryAfterSec) res.set('Retry-After', String(err.extra.retryAfterSec));
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }

  // Unexpected: log the stack (never the request body) and hide details from the client.
  console.error(`[error] ${req.method} ${req.originalUrl}\n`, err?.stack ?? err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
