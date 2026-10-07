/**
 * Mobile-number rules shared by the client (instant feedback) and the
 * server (authoritative validation), so both always agree.
 *
 * Uses libphonenumber-js *mobile* metadata: lengths are checked against the
 * country's MOBILE number lengths (e.g. India → 10, Germany → 10–11), not
 * the looser general lengths that also cover landlines and short codes.
 */
import {
  Metadata,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/mobile';

const metadata = new Metadata();

/** Allowed national-number lengths for mobiles in `iso`, e.g. [10]. */
export function mobileLengths(iso) {
  if (!isSupportedCountry(iso)) return null;
  metadata.selectNumberingPlan(iso);
  const plan = metadata.numberingPlan;
  return plan.type('MOBILE')?.possibleLengths() ?? plan.possibleLengths();
}

/** [10] → "10 digits", [10, 11] → "10 or 11 digits", [8, 9, 10] → "8–10 digits" */
export function describeLengths(lengths) {
  if (!lengths?.length) return 'a valid number of digits';
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  if (min === max) return `${min} digits`;
  if (lengths.length === 2) return `${min} or ${max} digits`;
  return `${min}–${max} digits`;
}

/**
 * Validate a digits-only mobile number for a country.
 *
 * The national (trunk) prefix is stripped before measuring, so both
 * "07911123456" and "7911123456" are accepted for the UK.
 *
 * @returns {{ ok: true, nationalNumber: string, e164: string, dialCode: string }
 *         | { ok: false, reason: 'REQUIRED'|'NOT_DIGITS'|'INVALID_COUNTRY'|'TOO_SHORT'|'TOO_LONG'|'INVALID_LENGTH', expected?: string }}
 */
export function checkMobileNumber(digits, iso) {
  if (!digits) return { ok: false, reason: 'REQUIRED' };
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'NOT_DIGITS' };
  const lengths = mobileLengths(iso);
  if (!lengths) return { ok: false, reason: 'INVALID_COUNTRY' };

  const parsed = parsePhoneNumberFromString(digits, iso);
  const national = parsed?.nationalNumber ?? digits;
  const expected = describeLengths(lengths);

  if (national.length < Math.min(...lengths)) return { ok: false, reason: 'TOO_SHORT', expected };
  if (national.length > Math.max(...lengths)) return { ok: false, reason: 'TOO_LONG', expected };
  if (!lengths.includes(national.length)) return { ok: false, reason: 'INVALID_LENGTH', expected };

  const dialCode = `+${getCountryCallingCode(iso)}`;
  return { ok: true, nationalNumber: national, e164: `${dialCode}${national}`, dialCode };
}

/** Human-readable message for a failed check. */
export function mobileErrorMessage(result, countryName = 'this country') {
  switch (result.reason) {
    case 'REQUIRED':
      return 'Mobile number is required';
    case 'NOT_DIGITS':
      return 'Mobile number can contain digits only';
    case 'INVALID_COUNTRY':
      return 'Select a valid country';
    case 'TOO_SHORT':
      return `Too short — ${countryName} mobile numbers have ${result.expected}`;
    case 'TOO_LONG':
      return `Too long — ${countryName} mobile numbers have ${result.expected}`;
    default:
      return `${countryName} mobile numbers have ${result.expected}`;
  }
}
