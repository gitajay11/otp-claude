/**
 * Express application factory (no listen()).
 *
 * Used by two entry points:
 *   - server/src/index.js  → long-running local/self-hosted server
 *   - api/index.js         → Vercel serverless function
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import { requireJson, notFound, errorHandler } from './middleware/index.js';

/**
 * @param {object} [opts]
 * @param {string} [opts.clientDist]  serve this built SPA directory (self-hosting only;
 *                                    on Vercel the CDN serves the client)
 */
export function createApp({ clientDist } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // The flag-emoji polyfill font is fetched from jsDelivr on platforms
          // (e.g. Windows) without native flag glyphs.
          'font-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
        },
      },
    }),
  );

  // Logs method, URL, status and timing only — request bodies (and therefore
  // OTPs) are never logged.
  app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  /* ----------------------------- API ----------------------------- */

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', requireJson);
  app.use('/api/auth', authRouter);
  app.use('/api', notFound);

  /* ------------------------ Built client ------------------------- */

  if (clientDist && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // SPA fallback: any non-API GET returns index.html.
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
