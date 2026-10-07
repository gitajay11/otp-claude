/**
 * Country metadata for the dial-code picker, derived from libphonenumber-js
 * (the same library the server validates with, so the rules always agree).
 */
import { getCountries, getCountryCallingCode, getExampleNumber } from 'libphonenumber-js/mobile';
import { describeLengths, mobileLengths } from 'nexus-shared/phone';
import mobileExamples from 'libphonenumber-js/mobile/examples';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** "IN" → 🇮🇳 (regional indicator symbols). */
export const flagEmoji = (iso) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function displayName(iso) {
  try {
    return regionNames.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** @type {{ iso: string, name: string, dial: string, flag: string }[]} */
export const COUNTRIES = getCountries()
  .map((iso) => ({
    iso,
    name: displayName(iso),
    dial: `+${getCountryCallingCode(iso)}`,
    flag: flagEmoji(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY = 'IN';

export const findCountry = (iso) => COUNTRIES.find((c) => c.iso === iso);

/** "10 digits" for India, "10 or 11 digits" for Germany, … */
export const mobileLengthHint = (iso) => describeLengths(mobileLengths(iso));

/** Example mobile number for placeholders/hints, e.g. "8123456789". */
export function exampleMobile(iso) {
  try {
    return getExampleNumber(iso, mobileExamples)?.nationalNumber;
  } catch {
    return undefined;
  }
}

/**
 * Search by country name, ISO code or dial code ("ind", "IN", "+91", "91").
 * Prefix matches on the name rank first.
 */
export function searchCountries(query) {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const digits = q.replace(/^\+/, '');
  const isDial = /^\d+$/.test(digits);

  const scored = [];
  for (const c of COUNTRIES) {
    const name = c.name.toLowerCase();
    let score = -1;
    if (isDial && c.dial.slice(1).startsWith(digits)) score = c.dial.slice(1) === digits ? 0 : 1;
    else if (c.iso.toLowerCase() === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) score = 2;
    else if (name.includes(q)) score = 3;
    if (score >= 0) scored.push([score, c]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}
