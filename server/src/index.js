import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './db.js';
import { HttpError, requireAuth, requireHousehold } from './middleware.js';
import authRoutes from './routes/auth.js';
import householdRoutes from './routes/households.js';
import playerRoutes from './routes/players.js';
import gameRoutes from './routes/games.js';
import sessionRoutes from './routes/sessions.js';
import statsRoutes from './routes/stats.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to a random string of at least 32 characters.');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Render (and Netlify's proxy) sit in front of the app; this lets rate limiting see real client IPs
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '500kb' })); // room for one resized photo
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/households', requireAuth, householdRoutes);
app.use('/api/players', requireAuth, requireHousehold, playerRoutes);
app.use('/api/games', requireAuth, requireHousehold, gameRoutes);
app.use('/api/sessions', requireAuth, requireHousehold, sessionRoutes);
app.use('/api/stats', requireAuth, requireHousehold, statsRoutes);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

// One place turns every error into a safe JSON message (no stack traces or SQL sent to the browser)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err instanceof HttpError ? err.message : 'Something went wrong. Please try again.';

  if (err.type === 'entity.parse.failed') message = 'Invalid JSON.';
  if (err.type === 'entity.too.large') message = 'That upload is too large.';
  if (err.code === '23505') { status = 409; message = 'That already exists.'; }
  if (err.code === '23503' || err.code === '23514') { status = 400; message = 'That change is not allowed.'; }
  if (status >= 500) console.error(err);

  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Family Games API listening on http://localhost:${PORT}`);
});
