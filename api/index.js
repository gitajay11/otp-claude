/**
 * Vercel serverless function: the whole Express API.
 *
 * vercel.json rewrites /api/* here; the original URL is preserved, so the
 * Express routes (/api/auth/...) match as usual. Static files (the built
 * React client) are served by Vercel's CDN, not by this function.
 */
import { createApp } from '../server/src/app.js';

export default createApp();
