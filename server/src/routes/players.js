import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError, requirePermission, validate, idParam } from '../middleware.js';

const router = Router();

const MAX_PHOTO_BYTES = 300 * 1024;

// Check the file's first bytes too, not just the type the browser claims
const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

/** Accepts "data:image/jpeg;base64,...." and returns { buffer, type }. */
function parsePhoto(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, 'Photo must be a JPEG, PNG or WebP image.');
  const [, type, b64] = match;
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) throw new HttpError(400, 'Photo is too large (300 KB max).');
  if (!SIGNATURES[type](buffer)) throw new HttpError(400, 'That file is not a valid image.');
  return { buffer, type };
}

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a color');
const playerSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(40),
  color,
  photo: z.string().max(450_000).nullable().optional(), // data URL, or null to remove
});
const updateSchema = playerSchema.partial().extend({ archived: z.boolean().optional() });

const PUBLIC_COLUMNS = `id, name, color, archived, user_id AS "userId",
  (photo IS NOT NULL) AS "hasPhoto", extract(epoch FROM updated_at)::bigint AS "version"`;

router.get('/', async (req, res) => {
  const includeArchived = req.query.all === 'true';
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM players
      WHERE household_id = $1 AND ($2 OR NOT archived)
      ORDER BY archived, created_at`,
    [req.household.id, includeArchived],
  );
  res.json(rows);
});

router.post('/', requirePermission('players.manage'), validate(playerSchema), async (req, res) => {
  const { name, color: c, photo } = req.valid;
  const p = photo ? parsePhoto(photo) : null;
  const { rows } = await query(
    `INSERT INTO players (household_id, name, color, photo, photo_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${PUBLIC_COLUMNS}`,
    [req.household.id, name, c, p?.buffer ?? null, p?.type ?? null],
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', requirePermission('players.manage'), validate(updateSchema), async (req, res) => {
  const id = idParam(req.params.id);
  const { name, color: c, photo, archived } = req.valid;
  const sets = [];
  const params = [id, req.household.id];
  const add = (sql, value) => { params.push(value); sets.push(`${sql} = $${params.length}`); };

  if (name !== undefined) add('name', name);
  if (c !== undefined) add('color', c);
  if (photo === null) { sets.push('photo = NULL', 'photo_type = NULL'); }
  if (photo) {
    const p = parsePhoto(photo);
    add('photo', p.buffer);
    add('photo_type', p.type);
  }
  if (archived !== undefined) add('archived', archived);
  if (!sets.length) throw new HttpError(400, 'Nothing to update.');

  const { rows } = await query(
    `UPDATE players SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $1 AND household_id = $2 RETURNING ${PUBLIC_COLUMNS}`,
    params,
  );
  if (!rows[0]) throw new HttpError(404, 'Player not found.');
  res.json(rows[0]);
});

// Photos are only served to signed-in members of the same family
router.get('/:id/photo', async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await query(
    'SELECT photo, photo_type FROM players WHERE id = $1 AND household_id = $2 AND photo IS NOT NULL',
    [id, req.household.id],
  );
  if (!rows[0]) throw new HttpError(404, 'No photo.');
  res.set('Content-Type', rows[0].photo_type);
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(rows[0].photo);
});

export default router;
