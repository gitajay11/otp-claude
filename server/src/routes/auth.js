/**
 * /api/auth routes
 *
 *   POST /signup/send-otp    { firstName, lastName, email, country, phone }
 *   POST /signup/verify-otp  { email, otp }        → creates account + session
 *   POST /login/send-otp     { email }
 *   POST /login/verify-otp   { email, otp }        → session
 *   GET  /me                                       → current user
 *   POST /logout
 *
 * Responses never include the OTP itself.
 */
import { Router } from 'express';
import { users, toPublicUser, isUniqueViolation } from '../db.js';
import { issueOtp, verifyOtp } from '../services/otpService.js';
import { sendOtpEmail } from '../services/mailer.js';
import { signupSendSchema, emailOnlySchema, verifyOtpSchema } from '../validation/schemas.js';
import {
  validate,
  requireAuth,
  startSession,
  endSession,
  sendOtpIpLimiter,
  verifyOtpIpLimiter,
} from '../middleware/index.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const emailExistsError = () =>
  new HttpError(409, 'EMAIL_EXISTS', 'This email is already registered. Try logging in instead.', {
    fields: { email: 'This email is already registered.' },
  });

/* ----------------------------- Sign up ----------------------------- */

router.post('/signup/send-otp', sendOtpIpLimiter, validate(signupSendSchema), async (req, res) => {
  const { firstName, lastName, email, country, mobile } = req.body;

  if (users.findByEmail(email)) throw emailExistsError();

  // `mobile` is the normalised number from validation (national trunk prefix stripped).
  const payload = {
    firstName,
    lastName,
    country,
    dialCode: mobile.dialCode,
    phone: mobile.nationalNumber,
    phoneE164: mobile.e164,
  };

  const timing = await issueOtp({
    email,
    purpose: 'signup',
    payload,
    deliver: (code) => sendOtpEmail({ to: email, code, purpose: 'signup', firstName }),
  });

  res.json({ message: 'Verification code sent.', email, ...timing });
});

router.post('/signup/verify-otp', verifyOtpIpLimiter, validate(verifyOtpSchema), async (req, res) => {
  const { email, otp } = req.body;
  const { payload } = await verifyOtp({ email, purpose: 'signup', code: otp });

  let user;
  try {
    user = users.create({ ...payload, email });
  } catch (err) {
    if (isUniqueViolation(err)) throw emailExistsError(); // registered in the meantime
    throw err;
  }

  startSession(res, user.id);
  res.status(201).json({ message: 'Account created.', user: toPublicUser(user) });
});

/* ------------------------------ Log in ----------------------------- */

router.post('/login/send-otp', sendOtpIpLimiter, validate(emailOnlySchema), async (req, res) => {
  const { email } = req.body;
  const user = users.findByEmail(email);
  if (!user) {
    throw new HttpError(404, 'EMAIL_NOT_FOUND', 'No account found for this email. Would you like to sign up?', {
      fields: { email: 'No account found for this email.' },
    });
  }

  const timing = await issueOtp({
    email,
    purpose: 'login',
    deliver: (code) => sendOtpEmail({ to: email, code, purpose: 'login', firstName: user.first_name }),
  });

  res.json({ message: 'Verification code sent.', email, ...timing });
});

router.post('/login/verify-otp', verifyOtpIpLimiter, validate(verifyOtpSchema), async (req, res) => {
  const { email, otp } = req.body;
  await verifyOtp({ email, purpose: 'login', code: otp });

  const existing = users.findByEmail(email);
  if (!existing) throw new HttpError(404, 'EMAIL_NOT_FOUND', 'No account found for this email.');

  const user = users.touchLogin(existing.id);
  startSession(res, user.id);
  res.json({ message: 'Logged in.', user: toPublicUser(user) });
});

/* ----------------------------- Session ----------------------------- */

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ message: 'Logged out.' });
});

export default router;
