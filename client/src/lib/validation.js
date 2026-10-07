/**
 * Client-side validation — mirrors server/src/validation/schemas.js so users
 * get instant feedback. The server re-validates everything.
 */
import { checkMobileNumber, mobileErrorMessage } from 'nexus-shared/phone';
import { findCountry } from './countries';

export const NAME_RE = /^[\p{L}\p{M}]+$/u;
export const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateName(value, label) {
  const v = value.trim();
  if (!v) return `${label} is required`;
  if (v.length > 50) return `${label} must be 50 characters or fewer`;
  if (!NAME_RE.test(v)) return `${label} can contain letters only`;
  return undefined;
}

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'Email is required';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address';
  return undefined;
}

export function validatePhone(value, iso) {
  const result = checkMobileNumber(value, iso);
  return result.ok ? undefined : mobileErrorMessage(result, findCountry(iso)?.name);
}

/** @returns {Record<string, string>} field → message (empty when valid) */
export function validateSignup(v) {
  const errors = {
    firstName: validateName(v.firstName, 'First name'),
    lastName: validateName(v.lastName, 'Last name'),
    email: validateEmail(v.email),
    phone: validatePhone(v.phone, v.country),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, msg]) => msg));
}

/** Strip harmless phone formatting characters (spaces, dashes, dots, parens). */
export const stripPhoneFormatting = (value) => value.replace(/[\s\-().]/g, '');
