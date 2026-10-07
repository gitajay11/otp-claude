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
 *  - Sends are rate-limited per email (1 per cooldown, N per hour). The
 *    check-and-record runs under a per-email advisory lock, so concurrent
 *    requests — even on different serverless instances — can't slip through.
 *
 * All time comparisons use the database clock (now()) to avoid skew between
 * function instances.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { sql } from '../db.js';
import { HttpError } from '../utils/httpError.js';

const { length, ttlMs, maxAttempts, resendCooldownMs, hourlyLimit, bcryptRounds } = config.otp;
const cooldownSec = Math.round(resendCooldownMs / 1000);
const ttlSec = Math.round(ttlMs / 1000);

/** Uniformly random, zero-padded numeric code, e.g. "04821". */
function generateCode() {
  return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
}

/**
 * Atomically check the per-email limits and, if allowed, record the send
 * (reserving the slot). Throws 429 otherwise. Returns the send-log row id.
 */
async function reserveSendSlot(email) {
  const [, [result]] = await sql.transaction([
    // Serialise concurrent sends for the same email until this transaction commits.
    sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`,
    sql`
      WITH stats AS (
        SELECT max(sent_at) AS last, min(sent_at) AS oldest, count(*)::int AS sends
        FROM otp_sends
        WHERE email = ${email} AND sent_at > now() - interval '1 hour'
      ), inserted AS (
        INSERT INTO otp_sends (email)
        SELECT ${email} FROM stats
        WHERE (last IS NULL OR last <= now() - make_interval(secs => ${cooldownSec}))
          AND sends < ${hourlyLimit}
        RETURNING id
      )
      SELECT
        (SELECT id FROM inserted) AS id,
        ceil(extract(epoch FROM (last + make_interval(secs => ${cooldownSec}) - now())))::int AS cooldown_left,
        ceil(extract(epoch FROM (oldest + interval '1 hour' - now())))::int AS hour_left
      FROM stats
    `,
  ]);

  if (result.id) return result.id;

  if (result.cooldown_left > 0) {
    const retryAfterSec = result.cooldown_left;
    throw new HttpError(429, 'OTP_COOLDOWN', `Please wait ${retryAfterSec}s before requesting another code.`, {
      retryAfterSec,
    });
  }
  const retryAfterSec = Math.max(1, result.hour_left);
  const minutes = Math.ceil(retryAfterSec / 60);
  throw new HttpError(
    429,
    'OTP_HOURLY_LIMIT',
    `Too many codes requested. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    { retryAfterSec },
  );
}

/**
 * Issue a new OTP.
 *
 * @param {object}   opts
 * @param {string}   opts.email    normalised (lower-case) email
 * @param {'signup'|'login'} opts.purpose
 * @param {object}  [opts.payload] data to attach (e.g. pending sign-up details)
 * @param {(code: string) => Promise<void>} opts.deliver  sends the code (email)
 * @returns {Promise<{ expiresInSec: number, resendAfterSec: number }>}
 */
export async function issueOtp({ email, purpose, payload = null, deliver }) {
  const sendLogId = await reserveSendSlot(email);
  const code = generateCode();

  let hash;
  try {
    hash = await bcrypt.hash(code, bcryptRounds);
    await deliver(code);
  } catch (err) {
    // A failed delivery shouldn't burn the user's quota.
    await sql`DELETE FROM otp_sends WHERE id = ${sendLogId}`;
    throw err;
  }

  await sql.transaction([
    sql`UPDATE otps SET consumed_at = now() WHERE email = ${email} AND purpose = ${purpose} AND consumed_at IS NULL`,
    sql`
      INSERT INTO otps (email, purpose, otp_hash, payload, expires_at)
      VALUES (${email}, ${purpose}, ${hash}, ${payload ? JSON.stringify(payload) : null}::jsonb,
              now() + make_interval(secs => ${ttlSec}))
    `,
    // Housekeeping piggy-backs on sends (no long-running process to schedule it).
    sql`DELETE FROM otps WHERE expires_at < now() - interval '1 hour'`,
    sql`DELETE FROM otp_sends WHERE sent_at < now() - interval '1 hour'`,
  ]);

  return { expiresInSec: ttlSec, resendAfterSec: cooldownSec };
}

/**
 * Verify a code. Resolves with `{ payload }` on success; throws an HttpError
 * describing the failure otherwise. A successful code is consumed.
 */
export async function verifyOtp({ email, purpose, code }) {
  const [record] = await sql`
    SELECT id, otp_hash, payload, (expires_at <= now()) AS expired
    FROM otps
    WHERE email = ${email} AND purpose = ${purpose} AND consumed_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `;
  if (!record) {
    throw new HttpError(400, 'OTP_NOT_FOUND', 'No active code for this email. Please request a new one.');
  }

  if (record.expired) {
    await sql`UPDATE otps SET consumed_at = now() WHERE id = ${record.id}`;
    throw new HttpError(410, 'OTP_EXPIRED', 'This code has expired. Please request a new one.');
  }

  // Atomically claim an attempt before the (slow) bcrypt comparison.
  const [claimed] = await sql`
    UPDATE otps SET attempts = attempts + 1
    WHERE id = ${record.id} AND attempts < ${maxAttempts} AND consumed_at IS NULL
    RETURNING attempts
  `;
  if (!claimed) {
    throw new HttpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Please request a new code.', {
      attemptsRemaining: 0,
    });
  }

  const matches = await bcrypt.compare(code, record.otp_hash);

  if (!matches) {
    const attemptsRemaining = Math.max(0, maxAttempts - claimed.attempts);
    if (attemptsRemaining === 0) {
      await sql`UPDATE otps SET consumed_at = now() WHERE id = ${record.id}`; // burn it
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
  const [consumed] = await sql`
    UPDATE otps SET consumed_at = now() WHERE id = ${record.id} AND consumed_at IS NULL RETURNING id
  `;
  if (!consumed) {
    throw new HttpError(400, 'OTP_NOT_FOUND', 'This code has already been used. Please request a new one.');
  }

  return { payload: record.payload };
}
