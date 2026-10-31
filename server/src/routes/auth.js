import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { ROLES, can } from '../permissions.js';
import {
  HttpError, requireAuth, setSessionCookie, clearSessionCookie, validate,
} from '../middleware.js';

const router = Router();

// Slow down password guessing: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);

const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name').max(60),
  email,
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});

const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(200),
});

async function loadMe(userId) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.display_name,
            h.id AS household_id, h.name AS household_name, h.invite_code, m.role
       FROM users u
       LEFT JOIN members m ON m.user_id = u.id
       LEFT JOIN households h ON h.id = m.household_id
      WHERE u.id = $1`,
    [userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    household: r.household_id
      ? {
        id: r.household_id,
        name: r.household_name,
        role: r.role,
        roleLabel: ROLES[r.role].label,
        permissions: ROLES[r.role].permissions,
        // Viewers don't get the invite code
        inviteCode: can(r.role, 'invite.view') ? r.invite_code : null,
      }
      : null,
  };
}

router.post('/signup', authLimiter, validate(signUpSchema), async (req, res) => {
  const { displayName, email: mail, password } = req.valid;
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [mail]);
  if (exists.rowCount) throw new HttpError(409, 'An account with that email already exists.');

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
    [mail, hash, displayName],
  );
  setSessionCookie(res, rows[0].id);
  res.status(201).json(await loadMe(rows[0].id));
});

router.post('/signin', authLimiter, validate(signInSchema), async (req, res) => {
  const { email: mail, password } = req.valid;
  const { rows } = await query('SELECT id, password_hash FROM users WHERE email = $1', [mail]);
  const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  // Same message for unknown email and wrong password, so attackers can't probe for accounts
  if (!ok) throw new HttpError(401, 'Email or password is incorrect.');
  setSessionCookie(res, rows[0].id);
  res.json(await loadMe(rows[0].id));
});

router.post('/signout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const me = await loadMe(req.userId);
  if (!me) {
    clearSessionCookie(res);
    throw new HttpError(401, 'Please sign in.');
  }
  res.json(me);
});

export { loadMe };
export default router;
