/**
 * Server entry point.
 *
 * In development the Vite dev server proxies /api here. In production
 * (`npm run build` then `npm start`) this process also serves the built
 * client from client/dist, so everything is same-origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { pruneExpired } from './db.js';
import { verifyMailer } from './services/mailer.js';
import authRouter from './routes/auth.js';
import { requireJson, notFound, errorHandler } from './middleware/index.js';

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

/* ------------------------------- API ------------------------------- */

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', requireJson);
app.use('/api/auth', authRouter);
app.use('/api', notFound);

/* ------------------------- Built client (prod) ---------------------- */

if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  // SPA fallback: any non-API GET returns index.html.
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use(errorHandler);

/* ------------------------------ Start ------------------------------ */

// Housekeeping every 10 minutes.
setInterval(pruneExpired, 10 * 60 * 1000).unref();
pruneExpired();

app.listen(config.port, () => {
  console.log(`[server] ${config.appName} API listening on http://localhost:${config.port} (${config.env})`);
  verifyMailer();
});
