/**
 * Request schemas (zod). These are the server-side source of truth — the
 * client mirrors the same rules for instant feedback, but nothing from the
 * browser is trusted.
 *
 * Parsing also *sanitises*: strings are trimmed, emails lower-cased, country
 * codes upper-cased, and unknown keys are stripped.
 */
import { z } from 'zod';
import { isSupportedCountry } from 'libphonenumber-js';
import { checkMobileNumber, mobileErrorMessage } from 'nexus-shared/phone';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** Unicode letters (plus combining marks for decomposed accents). */
const NAME_RE = /^[\p{L}\p{M}]+$/u;

/** WHATWG "valid email address" pattern, additionally requiring a dot in the domain. */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const name = (label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(NAME_RE, `${label} can contain letters only`);

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Enter a valid email address')
  .regex(EMAIL_RE, 'Enter a valid email address');

export const signupSendSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email,
    country: z
      .string({ error: 'Country is required' })
      .trim()
      .toUpperCase()
      .refine((c) => isSupportedCountry(c), 'Select a valid country'),
    phone: z
      .string({ error: 'Mobile number is required' })
      .trim()
      .min(1, 'Mobile number is required')
      .max(17, 'Mobile number is too long')
      .regex(/^\d+$/, 'Mobile number can contain digits only'),
  })
  .superRefine((v, ctx) => {
    // Per-country mobile length check (an invalid country is already reported on its own field).
    if (!isSupportedCountry(v.country)) return;
    const result = checkMobileNumber(v.phone, v.country);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: mobileErrorMessage(result, regionNames.of(v.country)) });
    }
  })
  // Attach the normalised number for the route handler.
  .transform((v) => ({ ...v, mobile: checkMobileNumber(v.phone, v.country) }));

export const emailOnlySchema = z.object({ email });

export const verifyOtpSchema = z.object({
  email,
  otp: z
    .string({ error: 'Code is required' })
    .trim()
    .regex(/^\d{5}$/, 'Code must be exactly 5 digits'),
});
