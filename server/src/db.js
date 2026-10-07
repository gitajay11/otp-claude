/**
 * SQLite persistence layer, using Node's built-in `node:sqlite` module
 * (no native compilation step required).
 *
 * Tables
 *   users      – registered accounts
 *   otps       – one row per issued code (bcrypt hash only, never the code)
 *   otp_sends  – send log used for per-email rate limiting
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name     TEXT    NOT NULL,
    last_name      TEXT    NOT NULL,
    email          TEXT    NOT NULL UNIQUE,  -- always stored lower-cased
    country_iso    TEXT    NOT NULL,         -- ISO 3166-1 alpha-2, e.g. "IN"
    dial_code      TEXT    NOT NULL,         -- e.g. "+91"
    phone          TEXT    NOT NULL,         -- national significant number, digits only
    phone_e164     TEXT    NOT NULL,         -- e.g. "+919876543210"
    created_at     INTEGER NOT NULL,         -- epoch ms
    last_login_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS otps (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    NOT NULL,
    purpose      TEXT    NOT NULL CHECK (purpose IN ('signup', 'login')),
    otp_hash     TEXT    NOT NULL,           -- bcrypt hash; the plain code is never stored
    payload      TEXT,                       -- JSON (pending sign-up details)
    attempts     INTEGER NOT NULL DEFAULT 0,
    expires_at   INTEGER NOT NULL,
    consumed_at  INTEGER,                    -- set when used OR invalidated
    created_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otps_active ON otps (email, purpose, consumed_at);

  CREATE TABLE IF NOT EXISTS otp_sends (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email    TEXT    NOT NULL,
    sent_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_otp_sends_email ON otp_sends (email, sent_at);
`);

/** Run `fn` inside a transaction; rolls back if it throws. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function isUniqueViolation(err) {
  return typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed');
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const stmts = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(`
    INSERT INTO users (first_name, last_name, email, country_iso, dial_code, phone, phone_e164, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  touchLogin: db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?'),
  pruneOtps: db.prepare('DELETE FROM otps WHERE expires_at < ? OR (consumed_at IS NOT NULL AND consumed_at < ?)'),
  pruneSends: db.prepare('DELETE FROM otp_sends WHERE sent_at < ?'),
};

export const users = {
  findByEmail: (email) => stmts.userByEmail.get(email),
  findById: (id) => stmts.userById.get(id),

  create({ firstName, lastName, email, country, dialCode, phone, phoneE164 }) {
    const now = Date.now();
    const { lastInsertRowid } = stmts.insertUser.run(
      firstName, lastName, email, country, dialCode, phone, phoneE164, now, now,
    );
    return stmts.userById.get(lastInsertRowid);
  },

  touchLogin(id) {
    stmts.touchLogin.run(Date.now(), id);
    return stmts.userById.get(id);
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
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/** Housekeeping: drop stale OTP rows and old send-log entries. */
export function pruneExpired() {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  stmts.pruneOtps.run(hourAgo, hourAgo);
  stmts.pruneSends.run(hourAgo);
}
