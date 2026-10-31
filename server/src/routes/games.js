import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { HttpError, requirePermission, validate, idParam } from '../middleware.js';

const router = Router();

const gameSchema = z.object({
  name: z.string().trim().min(1, 'Name the game').max(40),
  winnerRule: z.enum(['high', 'low']),
  useRounds: z.boolean(),
  targetScore: z.number().int().positive().max(100000).nullable().optional(),
});

const COLUMNS = `gt.id, gt.name, gt.winner_rule AS "winnerRule", gt.use_rounds AS "useRounds",
  gt.target_score AS "targetScore"`;

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${COLUMNS},
            count(gs.id) FILTER (WHERE gs.deleted_at IS NULL)::int AS "timesPlayed",
            max(gs.played_at) FILTER (WHERE gs.deleted_at IS NULL) AS "lastPlayed"
       FROM game_types gt
       LEFT JOIN game_sessions gs ON gs.game_type_id = gt.id
      WHERE gt.household_id = $1
      GROUP BY gt.id
      ORDER BY "lastPlayed" DESC NULLS LAST, gt.name`,
    [req.household.id],
  );
  res.json(rows);
});

router.post('/', requirePermission('games.manage'), validate(gameSchema), async (req, res) => {
  const { name, winnerRule, useRounds, targetScore } = req.valid;
  try {
    const { rows } = await query(
      `INSERT INTO game_types AS gt (household_id, name, winner_rule, use_rounds, target_score)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [req.household.id, name, winnerRule, useRounds, targetScore ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'You already have a game with that name.');
    throw err;
  }
});

router.put('/:id', requirePermission('games.manage'), validate(gameSchema), async (req, res) => {
  const id = idParam(req.params.id);
  const { name, winnerRule, useRounds, targetScore } = req.valid;
  const { rows } = await query(
    `UPDATE game_types AS gt SET name = $3, winner_rule = $4, use_rounds = $5, target_score = $6
      WHERE id = $1 AND household_id = $2 RETURNING ${COLUMNS}`,
    [id, req.household.id, name, winnerRule, useRounds, targetScore ?? null],
  );
  if (!rows[0]) throw new HttpError(404, 'Game not found.');
  res.json(rows[0]);
});

export default router;
