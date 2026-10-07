/**
 * Long-running server entry point (local development / self-hosting).
 *
 * In development the Vite dev server proxies /api here. After
 * `npm run build`, this process also serves the built client from
 * client/dist, so everything is same-origin.
 *
 * On Vercel, api/index.js is used instead.
 */
import { config } from './config.js';
import { createApp } from './app.js';
import { verifyMailer } from './services/mailer.js';

const app = createApp({ clientDist: config.clientDist });

app.listen(config.port, () => {
  console.log(`[server] ${config.appName} API listening on http://localhost:${config.port} (${config.env})`);
  verifyMailer();
});
