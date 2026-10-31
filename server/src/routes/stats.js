import { Router } from 'express';
import { query } from '../db.js';
import { idParam } from '../middleware.js';

const router = Router();

// Home dashboard: the player with the most wins in each game
router.get('/top', async (req, res) => {
  const { rows } = await query(
    `WITH wins AS (
       SELECT sw.game_type_id, sw.player_id, count(*)::int AS wins
         FROM session_winners sw
        WHERE sw.household_id = $1
        GROUP BY sw.game_type_id, sw.player_id
     )
     SELECT DISTINCT ON (gt.id)
            gt.id AS "gameTypeId", gt.name AS "gameName",
            p.id AS "playerId", p.name AS "playerName", p.color,
            (p.photo IS NOT NULL) AS "hasPhoto", extract(epoch FROM p.updated_at)::bigint AS "version",
            w.wins
       FROM wins w
       JOIN game_types gt ON gt.id = w.game_type_id
       JOIN players p ON p.id = w.player_id
      ORDER BY gt.id, w.wins DESC, p.name`,
    [req.household.id],
  );
  res.json(rows);
});

// Leaderboard for one game: wins, games played, win rate, best total
router.get('/leaderboard/:gameTypeId', async (req, res) => {
  const gameTypeId = idParam(req.params.gameTypeId);
  const { rows } = await query(
    `SELECT p.id, p.name, p.color, (p.photo IS NOT NULL) AS "hasPhoto",
            extract(epoch FROM p.updated_at)::bigint AS "version",
            count(*)::int AS played,
            count(sw.player_id)::int AS wins,
            round(100.0 * count(sw.player_id) / count(*))::int AS "winRate",
            CASE WHEN gt.winner_rule = 'low' THEN min(st.total) ELSE max(st.total) END AS best
       FROM session_totals st
       JOIN game_sessions gs ON gs.id = st.session_id
       JOIN game_types gt    ON gt.id = gs.game_type_id
       JOIN players p        ON p.id = st.player_id
       LEFT JOIN session_winners sw ON sw.session_id = st.session_id AND sw.player_id = st.player_id
      WHERE gs.household_id = $1 AND gs.game_type_id = $2
        AND gs.status = 'finished' AND gs.deleted_at IS NULL
      GROUP BY p.id, gt.winner_rule
      ORDER BY wins DESC, "winRate" DESC, p.name`,
    [req.household.id, gameTypeId],
  );
  res.json(rows);
});

// Ranking over time: wins per player per month for one game (the app turns this into a running total)
router.get('/over-time/:gameTypeId', async (req, res) => {
  const gameTypeId = idParam(req.params.gameTypeId);
  const { rows } = await query(
    `SELECT to_char(date_trunc('month', sw.played_at), 'YYYY-MM') AS month,
            sw.player_id AS "playerId", count(*)::int AS wins
       FROM session_winners sw
      WHERE sw.household_id = $1 AND sw.game_type_id = $2
      GROUP BY 1, 2
      ORDER BY 1`,
    [req.household.id, gameTypeId],
  );
  res.json(rows);
});

export default router;
