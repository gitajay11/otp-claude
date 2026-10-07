/**
 * An error that maps directly to an HTTP response.
 *
 * `code` is a stable machine-readable identifier the client can branch on
 * (e.g. EMAIL_EXISTS); `message` is safe to show to users; `extra` is merged
 * into the JSON error body (e.g. { retryAfterSec } or { fields }).
 */
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
