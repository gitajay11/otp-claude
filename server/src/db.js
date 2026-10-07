/**
 * PostgreSQL persistence layer (Neon serverless driver).
 *
 * Uses Neon's HTTP driver: every query is a stateless HTTPS request, which
 * suits serverless functions (no connection pool to exhaust or keep warm).
 * Multi-statement atomic work uses `sql.transaction([...])`.
 *
 * Schema lives in server/schema.sql (apply with `npm run db:migrate`).
 */
import { neon } from '@neondatabase/serverless';
import { config } from './config.js';

export const sql = neon(config.databaseUrl);

/** Postgres unique_violation. */
export const isUniqueViolation = (err) => err?.code === '23505';

const toMs = (value) => (value ? new Date(value).getTime() : null);

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users = {
  async findByEmail(email) {
    const [row] = await sql`SELECT * FROM users WHERE email = ${email}`;
    return row ?? null;
  },

  async findById(id) {
    const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
    return row ?? null;
  },

  async create({ firstName, lastName, email, country, dialCode, phone, phoneE164 }) {
    const [row] = await sql`
      INSERT INTO users (first_name, last_name, email, country_iso, dial_code, phone, phone_e164, last_login_at)
      VALUES (${firstName}, ${lastName}, ${email}, ${country}, ${dialCode}, ${phone}, ${phoneE164}, now())
      RETURNING *
    `;
    return row;
  },

  async touchLogin(id) {
    const [row] = await sql`UPDATE users SET last_login_at = now() WHERE id = ${id} RETURNING *`;
    return row;
  },
};

/** Shape a DB row into the public JSON representation sent to clients. */
export function toPublicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    country: row.country_iso,
    dialCode: row.dial_code,
    phone: row.phone,
    createdAt: toMs(row.created_at),
    lastLoginAt: toMs(row.last_login_at),
  };
}
