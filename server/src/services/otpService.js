/**
 * OTP lifecycle: issue → (rate limit) → hash & store → verify.
 *
 * Security properties
 *  - Codes come from a CSPRNG (crypto.randomInt) and only their bcrypt hash
 *    is persisted. The plain code exists in memory just long enough to email.
 *  - Codes expire after `config.otp.ttlMs` and are single-use.
 *  - Each code tolerates `maxAttempts` wrong guesses, then is invalidated.
 *    The attempt counter is incremented atomically *before* the bcrypt
 *    comparison so parallel requests cannot exceed the limit.
 *  - Issuing a new code invalidates any previous active code for that
 *    email + purpose.
 *  - Sends are rate-limited per email: 1 per cooldown window and N per hour.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { db, transaction } from '../db.js';
import { HttpError } from '../utils/httpError.js';

const { length, ttlMs, maxAttempts, resendCooldownMs, hourlyLimit, bcryptRounds } = config.otp;
const HOUR_MS = 60 * 60 * 1000;

const stmts = {
  lastSend: db.prepare('SELECT MAX(sent_at) AS last FROM otp_sends WHERE email = ?'),
  sendsSince: db.prepare('SELECT COUNT(*) AS count, MIN(sent_at) AS oldest FROM otp_sends WHERE email = ? AND sent_at > ?'),
  logSend: db.prepare('INSERT INTO otp_sends (email, sent_at) VALUES (?, ?)'),
  unlogSend: db.prepare('DELETE FROM otp_sends WHERE id = ?'),

  invalidateActive: db.prepare(
    'UPDATE otps SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL',
  ),
  insertOtp: db.prepare(`
    INSERT INTO otps (email, purpose, otp_hash, payload, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  activeOtp: db.prepare(`
    SELECT * FROM otps
    WHERE email = ? AND purpose = ? AND consumed_at IS NULL
    ORDER BY id DESC LIMIT 1
  `),
  claimAttempt: db.prepare(
    'UPDATE otps SET attempts = attempts + 1 WHERE id = ? AND attempts < ? AND consumed_at IS NULL',
  ),
  attemptsOf: db.prepare('SELECT attempts FROM otps WHERE id = ?'),
  consume: db.prepare('UPDATE otps SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL'),
};

/** Uniformly random, zero-padded numeric code, e.g. "04821". */
function generateCode() {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

/**
 * Throws 429 if this email may not receive another code yet.
 * Otherwise records the send immediately (reserving the slot so concurrent
 * requests can't slip through) and returns the log row id.
 */
function reserveSendSlot(email) {
  const now = Date.now();

  const { last } = stmts.lastSend.get(email);
  if (last && now - last < resendCooldownMs) {
    const retryAfterSec = Math.ceil((last + resendCooldownMs - now) / 1000);
    throw new HttpError(429, 'OTP_COOLDOWN', `Please wait ${retryAfterSec}s before requesting another code.`, {
      retryAfterSec,
    });
  }

  const { count, oldest } = stmts.sendsSince.get(email, now - HOUR_MS);
  if (count >= hourlyLimit) {
    const retryAfterSec = Math.ceil((oldest + HOUR_MS - now) / 1000);
    const minutes = Math.ceil(retryAfterSec / 60);
    throw new HttpError(
      429,
      'OTP_HOURLY_LIMIT',
      `Too many codes requested. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      { retryAfterSec },
    );
  }

  return stmts.logSend.run(email, now).lastInsertRowid;
}

/**
 * Issue a new OTP.
 *
 * @param {object}   opts
 * @param {string}   opts.email    normalised (lower-case) email
 * @param {'signup'|'login'} opts.purpose
 * @param {object}  [opts.payload] data to attach (e.g. pending sign-up details)
 * @param {(code: string) => Promise<void>} opts.deliver  sends the code (email)
 * @returns {{ expiresInSec: number, resendAfterSec: number }}
 */
export async function issueOtp({ email, purpose, payload = null, deliver }) {
  const sendLogId = reserveSendSlot(email);
  const code = generateCode();

  let hash;
  try {
    hash = await bcrypt.hash(code, bcryptRounds);
    await deliver(code);
  } catch (err) {
    // A failed delivery shouldn't burn the user's quota.
    stmts.unlogSend.run(sendLogId);
    throw err;
  }

  const now = Date.now();
  transaction(() => {
    stmts.invalidateActive.run(now, email, purpose);
    stmts.insertOtp.run(email, purpose, hash, payload ? JSON.stringify(payload) : null, now + ttlMs, now);
  });

  return {
    expiresInSec: Math.round(ttlMs / 1000),
    resendAfterSec: Math.round(resendCooldownMs / 1000),
  };
}

/**
 * Verify a code. Resolves with `{ payload }` on success; throws an HttpError
 * describing the failure otherwise. A successful code is consumed.
 */
export async function verifyOtp({ email, purpose, code }) {
  const record = stmts.activeOtp.get(email, purpose);
  if (!record) {
    throw new HttpError(400, 'OTP_NOT_FOUND', 'No active code for this email. Please request a new one.');
  }

  const now = Date.now();
  if (record.expires_at <= now) {
    stmts.consume.run(now, record.id);
    throw new HttpError(410, 'OTP_EXPIRED', 'This code has expired. Please request a new one.');
  }

  // Atomically claim an attempt before the (async) comparison.
  if (stmts.claimAttempt.run(record.id, maxAttempts).changes === 0) {
    throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', {
      attemptsRemaining: 0,
    });
  }

  const matches = await bcrypt.compare(code, record.otp_hash);

  if (!matches) {
    const { attempts } = stmts.attemptsOf.get(record.id);
    const attemptsRemaining = Math.max(0, maxAttempts - attempts);
    if (attemptsRemaining === 0) {
      stmts.consume.run(Date.now(), record.id); // burn it — a new code is required
      throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', {
        attemptsRemaining: 0,
      });
    }
    throw new HttpError(
      401,
      'OTP_INVALID',
      `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
      { attemptsRemaining },
    );
  }

  // Single use: only one concurrent request can win this update.
  if (stmts.consume.run(Date.now(), record.id).changes === 0) {
    throw new HttpError(400, 'OTP_NOT_FOUND', 'This code has already been used. Please request a new one.');
  }

  return { payload: record.payload ? JSON.parse(record.payload) : null };
}
