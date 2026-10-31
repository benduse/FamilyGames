import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { ROLES, can } from './permissions.js';

export const COOKIE_NAME = 'fg_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // page JavaScript cannot read it
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // the app calls the API through a same-site proxy (see README)
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Requires a valid login cookie. Sets req.userId. */
export function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(new HttpError(401, 'Please sign in.'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = Number(payload.sub);
    return next();
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
}

/**
 * Looks up the user's household on the server. Every data query uses req.household.id,
 * never a household id sent by the browser. This is what keeps families' data separate.
 */
export async function requireHousehold(req, _res, next) {
  const { rows } = await query(
    `SELECT h.id, h.name, h.invite_code, m.role
       FROM members m JOIN households h ON h.id = m.household_id
      WHERE m.user_id = $1`,
    [req.userId],
  );
  if (!rows[0]) return next(new HttpError(403, 'Create or join a family first.'));
  req.household = rows[0];
  return next();
}

/**
 * Allows the request only if the user's role has this permission (see permissions.js).
 * Example: router.post('/', requirePermission('players.manage'), handler)
 */
export const requirePermission = (permission) => (req, _res, next) => {
  if (!can(req.household?.role, permission)) {
    const role = ROLES[req.household?.role]?.label ?? 'Your role';
    return next(new HttpError(403, `${role}s can't do that. Ask the family owner to change your role.`));
  }
  return next();
};

/** Validates req.body (or another part) with a zod schema and replaces it with the parsed value. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part] ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first.path.join('.');
    return next(new HttpError(400, field ? `${field}: ${first.message}` : first.message));
  }
  req.valid = result.data;
  return next();
};

/** Parses a positive integer route param or throws 400. */
export function idParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id.');
  return id;
}
