/**
 * Thin fetch wrapper for the auth API.
 *
 * All requests are same-origin (`/api/...`, proxied by Vite in dev) so the
 * httpOnly session cookie is sent automatically. Non-2xx responses throw an
 * ApiError carrying the server's { code, message, ...extra } payload.
 */

export class ApiError extends Error {
  constructor(status, { code = 'UNKNOWN', message = 'Something went wrong.', ...extra } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    /** Per-field validation messages, when provided. */
    this.fields = extra.fields ?? {};
    this.retryAfterSec = extra.retryAfterSec;
    this.attemptsRemaining = extra.attemptsRemaining;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Network error — please check your connection.' });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? { message: `Unexpected server response (${res.status}).` });
  }
  return data;
}

const post = (path, body = {}) => request(path, { method: 'POST', body });

export const api = {
  signupSendOtp: (details) => post('/auth/signup/send-otp', details),
  signupVerifyOtp: (email, otp) => post('/auth/signup/verify-otp', { email, otp }),
  loginSendOtp: (email) => post('/auth/login/send-otp', { email }),
  loginVerifyOtp: (email, otp) => post('/auth/login/verify-otp', { email, otp }),
  me: () => request('/auth/me'),
  logout: () => post('/auth/logout'),
};
