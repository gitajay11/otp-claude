-- Nexus OTP Auth — PostgreSQL schema (Neon).
-- Idempotent: safe to run repeatedly (`npm run db:migrate`).

-- Registered accounts.
CREATE TABLE IF NOT EXISTS users (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name     text        NOT NULL,
  last_name      text        NOT NULL,
  email          text        NOT NULL UNIQUE,   -- always stored lower-cased
  country_iso    text        NOT NULL,          -- ISO 3166-1 alpha-2, e.g. 'IN'
  dial_code      text        NOT NULL,          -- e.g. '+91'
  phone          text        NOT NULL,          -- national significant number, digits only
  phone_e164     text        NOT NULL,          -- e.g. '+919876543210'
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

-- One row per issued code. Only the bcrypt hash is stored, never the code.
CREATE TABLE IF NOT EXISTS otps (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text        NOT NULL,
  purpose      text        NOT NULL CHECK (purpose IN ('signup', 'login')),
  otp_hash     text        NOT NULL,
  payload      jsonb,                            -- pending sign-up details
  attempts     integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,                      -- set when used OR invalidated
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otps_active  ON otps (email, purpose) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps (expires_at);

-- Send log for per-email rate limiting.
CREATE TABLE IF NOT EXISTS otp_sends (
  id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email    text        NOT NULL,
  sent_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_sends_email ON otp_sends (email, sent_at);
