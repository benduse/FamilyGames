import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import { HttpError, requirePermission, validate, idParam } from '../middleware.js';

const router = Router();

const createSchema = z.object({
  gameTypeId: z.number().int().positive(),
  playerIds: z.array(z.number().int().positive()).min(1, 'Pick at least one player').max(12),
});

const scoreSchema = z.object({
  playerId: z.number().int().positive(),
  roundNo: z.number().int().min(1).max(500),
  points: z.number().int().min(-100000).max(100000).nullable(), // null clears the cell
});

/** Loads a session that belongs to this household, or throws 404. */
async function getSession(id, householdId) {
  const { rows } = await query(
    `SELECT gs.id, gs.status, gs.played_at AS "playedAt", gs.finished_at AS "finishedAt",
            gt.id AS "gameTypeId", gt.name AS "gameName", gt.winner_rule AS "winnerRule",
            gt.use_rounds AS "useRounds", gt.target_score AS "targetScore"
       FROM game_sessions gs JOIN game_types gt ON gt.id = gs.game_type_id
      WHERE gs.id = $1 AND gs.household_id = $2 AND gs.deleted_at IS NULL`,
    [id, householdId],
  );
  if (!rows[0]) throw new HttpError(404, 'Game not found.');
  return rows[0];
}

// History: newest first, with winners
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const gameTypeId = req.query.gameTypeId ? idParam(req.query.gameTypeId) : null;
  const { rows } = await query(
    `SELECT gs.id, gs.status, gs.played_at AS "playedAt", gt.name AS "gameName", gt.id AS "gameTypeId",
            (SELECT count(*)::int FROM session_players sp WHERE sp.session_id = gs.id) AS "playerCount",
            COALESCE((SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'total', sw.total) ORDER BY p.name)
                        FROM session_winners sw JOIN players p ON p.id = sw.player_id
                       WHERE sw.session_id = gs.id), '[]') AS winners
       FROM game_sessions gs JOIN game_types gt ON gt.id = gs.game_type_id
      WHERE gs.household_id = $1 AND gs.deleted_at IS NULL AND ($2::int IS NULL OR gs.game_type_id = $2)
      ORDER BY gs.played_at DESC
      LIMIT $3`,
    [req.household.id, gameTypeId, limit],
  );
  res.json(rows);
});

// Start a game: the date and time are stamped by the database (played_at DEFAULT now())
router.post('/', requirePermission('scores.edit'), validate(createSchema), async (req, res) => {
  const { gameTypeId, playerIds } = req.valid;
  const uniqueIds = [...new Set(playerIds)];

  const game = await query('SELECT id FROM game_types WHERE id = $1 AND household_id = $2', [gameTypeId, req.household.id]);
  if (!game.rowCount) throw new HttpError(404, 'Game not found.');

  const players = await query(
    'SELECT id FROM players WHERE household_id = $1 AND id = ANY($2::int[]) AND NOT archived',
    [req.household.id, uniqueIds],
  );
  if (players.rowCount !== uniqueIds.length) throw new HttpError(400, 'One of those players is not in your family.');

  const id = await withTransaction(async (db) => {
    const { rows: [s] } = await db.query(
      'INSERT INTO game_sessions (household_id, game_type_id, created_by) VALUES ($1, $2, $3) RETURNING id',
      [req.household.id, gameTypeId, req.userId],
    );
    for (const [i, pid] of uniqueIds.entries()) {
      await db.query('INSERT INTO session_players (session_id, player_id, seat_order) VALUES ($1, $2, $3)', [s.id, pid, i]);
    }
    return s.id;
  });
  res.status(201).json({ id });
});

// Full scorecard: players, every score, totals and the current leader(s)
router.get('/:id', async (req, res) => {
  const id = idParam(req.params.id);
  const session = await getSession(id, req.household.id);

  const [players, scores] = await Promise.all([
    query(
      `SELECT p.id, p.name, p.color, (p.photo IS NOT NULL) AS "hasPhoto",
              extract(epoch FROM p.updated_at)::bigint AS "version", st.total
         FROM session_players sp
         JOIN players p ON p.id = sp.player_id
         JOIN session_totals st ON st.session_id = sp.session_id AND st.player_id = sp.player_id
        WHERE sp.session_id = $1
        ORDER BY sp.seat_order`,
      [id],
    ),
    query(
      `SELECT player_id AS "playerId", round_no AS "roundNo", points
         FROM scores WHERE session_id = $1 ORDER BY round_no`,
      [id],
    ),
  ]);

  const totals = players.rows.map((p) => p.total);
  const best = session.winnerRule === 'low' ? Math.min(...totals) : Math.max(...totals);
  const anyScores = scores.rowCount > 0;
  const leaders = anyScores ? players.rows.filter((p) => p.total === best).map((p) => p.id) : [];

  res.json({ ...session, players: players.rows, scores: scores.rows, leaders });
});

// Save one cell. Upsert keeps it simple for the scorecard grid.
router.put('/:id/scores', requirePermission('scores.edit'), validate(scoreSchema), async (req, res) => {
  const id = idParam(req.params.id);
  const session = await getSession(id, req.household.id);
  if (session.status === 'finished') throw new HttpError(409, 'This game is finished. Reopen it to change scores.');
  const { playerId, roundNo, points } = req.valid;
  if (!session.useRounds && roundNo !== 1) throw new HttpError(400, 'This game has a single final score.');

  const inGame = await query('SELECT 1 FROM session_players WHERE session_id = $1 AND player_id = $2', [id, playerId]);
  if (!inGame.rowCount) throw new HttpError(400, 'That player is not in this game.');

  if (points === null) {
    await query('DELETE FROM scores WHERE session_id = $1 AND player_id = $2 AND round_no = $3', [id, playerId, roundNo]);
  } else {
    await query(
      `INSERT INTO scores (session_id, player_id, round_no, points, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, player_id, round_no)
       DO UPDATE SET points = EXCLUDED.points, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [id, playerId, roundNo, points, req.userId],
    );
  }
  const { rows } = await query('SELECT player_id AS "playerId", total FROM session_totals WHERE session_id = $1', [id]);
  res.json({ totals: rows });
});

router.post('/:id/finish', requirePermission('scores.edit'), async (req, res) => {
  const id = idParam(req.params.id);
  await getSession(id, req.household.id);
  await query(
    "UPDATE game_sessions SET status = 'finished', finished_at = now() WHERE id = $1 AND household_id = $2",
    [id, req.household.id],
  );
  res.json({ ok: true });
});

router.post('/:id/reopen', requirePermission('scores.edit'), async (req, res) => {
  const id = idParam(req.params.id);
  await getSession(id, req.household.id);
  await query(
    "UPDATE game_sessions SET status = 'in_progress', finished_at = NULL WHERE id = $1 AND household_id = $2",
    [id, req.household.id],
  );
  res.json({ ok: true });
});

// Soft delete, so a mistake can be undone in the database
router.delete('/:id', requirePermission('sessions.delete'), async (req, res) => {
  const id = idParam(req.params.id);
  await getSession(id, req.household.id);
  await query('UPDATE game_sessions SET deleted_at = now() WHERE id = $1 AND household_id = $2', [id, req.household.id]);
  res.status(204).end();
});

export default router;
