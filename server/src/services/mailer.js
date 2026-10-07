/**
 * Outbound email via Nodemailer (SMTP).
 *
 * Errors are logged by message only — never with the message body — so a
 * code can't leak into logs through a failed send.
 */
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';
import { renderOtpEmail } from '../templates/otpEmail.js';

const { smtp } = config;

export const isMailConfigured = Boolean(smtp.host && smtp.from);

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

/** Best-effort SMTP connectivity check at startup (non-fatal). */
export async function verifyMailer() {
  if (!isMailConfigured) {
    console.warn('[mail] SMTP_HOST / MAIL_FROM not set — OTP emails cannot be sent until configured in server/.env.');
    return;
  }
  try {
    await getTransporter().verify();
    console.log(`[mail] SMTP connection to ${smtp.host}:${smtp.port} verified.`);
  } catch (err) {
    console.warn(`[mail] SMTP verification failed (${err.code ?? 'error'}): ${err.message}`);
  }
}

/**
 * Send a verification code.
 * @param {{ to: string, code: string, purpose: 'signup'|'login', firstName?: string }} opts
 */
export async function sendOtpEmail({ to, code, purpose, firstName }) {
  if (!isMailConfigured) {
    throw new HttpError(503, 'MAIL_NOT_CONFIGURED', 'Email service is not configured. Please try again later.');
  }

  const expiresInMinutes = Math.round(config.otp.ttlMs / 60000);
  const { subject, html, text } = renderOtpEmail({
    appName: config.appName,
    code,
    purpose,
    firstName,
    expiresInMinutes,
  });

  try {
    await getTransporter().sendMail({ from: smtp.from, to, subject, html, text });
  } catch (err) {
    console.error(`[mail] Failed to send ${purpose} code (${err.code ?? 'error'}): ${err.message}`);
    throw new HttpError(502, 'MAIL_SEND_FAILED', 'We could not send the email right now. Please try again shortly.');
  }
}
