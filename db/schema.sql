-- Family Games Score Card: database schema (PostgreSQL 14+)
-- Run once against an empty database:  psql "$DATABASE_URL" -f db/schema.sql

BEGIN;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE households (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  household_id INT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'scorekeeper', 'viewer')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
-- MVP: a user belongs to one household
CREATE UNIQUE INDEX members_one_household ON members(user_id);

CREATE TABLE players (
  id           SERIAL PRIMARY KEY,
  household_id INT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  color        TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  photo        BYTEA,
  photo_type   TEXT CHECK (photo_type IN ('image/jpeg', 'image/png', 'image/webp')),
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  archived     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_household ON players(household_id);

CREATE TABLE game_types (
  id           SERIAL PRIMARY KEY,
  household_id INT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  winner_rule  TEXT NOT NULL DEFAULT 'high' CHECK (winner_rule IN ('high', 'low')),
  use_rounds   BOOLEAN NOT NULL DEFAULT true,
  target_score INT CHECK (target_score IS NULL OR target_score > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

CREATE TABLE game_sessions (
  id           SERIAL PRIMARY KEY,
  household_id INT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  game_type_id INT NOT NULL REFERENCES game_types(id) ON DELETE RESTRICT,
  played_at    TIMESTAMPTZ NOT NULL DEFAULT now(),   -- logged automatically
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished')),
  finished_at  TIMESTAMPTZ,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ                            -- soft delete
);
CREATE INDEX sessions_household_played ON game_sessions(household_id, played_at DESC);

CREATE TABLE session_players (
  session_id INT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id  INT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  seat_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, player_id)
);

CREATE TABLE scores (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL,
  player_id  INT NOT NULL,
  round_no   INT NOT NULL CHECK (round_no BETWEEN 1 AND 500),
  points     INT NOT NULL CHECK (points BETWEEN -100000 AND 100000),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id, round_no),
  FOREIGN KEY (session_id, player_id)
    REFERENCES session_players(session_id, player_id) ON DELETE CASCADE
);

-- Total points per player per session (players with no scores yet count as 0)
CREATE VIEW session_totals AS
SELECT sp.session_id,
       sp.player_id,
       COALESCE(SUM(s.points), 0)::INT AS total
FROM session_players sp
LEFT JOIN scores s
  ON s.session_id = sp.session_id AND s.player_id = sp.player_id
GROUP BY sp.session_id, sp.player_id;

-- Winner(s) of each finished game, respecting "highest wins" or "lowest wins". Ties share the win.
CREATE VIEW session_winners AS
WITH ranked AS (
  SELECT st.session_id, st.player_id, st.total, gs.household_id, gs.game_type_id, gs.played_at,
         CASE WHEN gt.winner_rule = 'low'
              THEN MIN(st.total) OVER (PARTITION BY st.session_id)
              ELSE MAX(st.total) OVER (PARTITION BY st.session_id)
         END AS winning_total
  FROM session_totals st
  JOIN game_sessions gs ON gs.id = st.session_id
  JOIN game_types gt    ON gt.id = gs.game_type_id
  WHERE gs.status = 'finished' AND gs.deleted_at IS NULL
)
SELECT session_id, player_id, total, household_id, game_type_id, played_at
FROM ranked
WHERE total = winning_total;

COMMIT;
