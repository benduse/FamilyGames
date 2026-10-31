import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query, withTransaction } from '../db.js';
import {
  HttpError, requireHousehold, requirePermission, validate, idParam,
} from '../middleware.js';
import {
  PERMISSIONS, ROLES, ROLE_NAMES, DEFAULT_JOIN_ROLE, can,
} from '../permissions.js';
import { loadMe } from './auth.js';

const router = Router();

// Starter games so a new family can play right away
const STARTER_GAMES = [
  { name: 'Uno', winnerRule: 'high', useRounds: true, target: 500 },
  { name: 'Scrabble', winnerRule: 'high', useRounds: true, target: null },
  { name: 'Spades', winnerRule: 'high', useRounds: true, target: 500 },
  { name: 'Hearts', winnerRule: 'low', useRounds: true, target: 100 },
  { name: 'Yahtzee', winnerRule: 'high', useRounds: false, target: null },
  { name: 'Rummy', winnerRule: 'high', useRounds: true, target: 500 },
  { name: 'Phase 10', winnerRule: 'low', useRounds: true, target: null },
  { name: 'Mini Golf', winnerRule: 'low', useRounds: true, target: null },
];

// No 0/O/1/I so codes are easy to read aloud
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeInviteCode() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const nameSchema = z.object({ name: z.string().trim().min(1, 'Name your family').max(60) });
const joinSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'Codes are 8 letters or numbers'),
});
const roleSchema = z.object({ role: z.enum(ROLE_NAMES, { message: 'Pick owner, scorekeeper or viewer' }) });

async function assertNoHousehold(userId) {
  const { rowCount } = await query('SELECT 1 FROM members WHERE user_id = $1', [userId]);
  if (rowCount) throw new HttpError(409, 'You already belong to a family.');
}

/**
 * Locks this family's member rows for the rest of the transaction, so two owners
 * changing roles at the same moment can't both demote themselves and leave no owner.
 */
async function lockMembers(db, householdId) {
  const { rows } = await db.query(
    'SELECT user_id, role FROM members WHERE household_id = $1 FOR UPDATE',
    [householdId],
  );
  return rows;
}

const ownerCount = (members) => members.filter((m) => m.role === 'owner').length;

// ---------- Create or join ----------

router.post('/', validate(nameSchema), async (req, res) => {
  await assertNoHousehold(req.userId);
  await withTransaction(async (db) => {
    const { rows: [h] } = await db.query(
      'INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id',
      [req.valid.name, makeInviteCode()],
    );
    await db.query(
      "INSERT INTO members (household_id, user_id, role) VALUES ($1, $2, 'owner')",
      [h.id, req.userId],
    );
    // The person who creates the family is also a player
    await db.query(
      `INSERT INTO players (household_id, name, color, user_id)
       SELECT $1, split_part(display_name, ' ', 1), '#3D3BBF', id FROM users WHERE id = $2`,
      [h.id, req.userId],
    );
    for (const g of STARTER_GAMES) {
      await db.query(
        `INSERT INTO game_types (household_id, name, winner_rule, use_rounds, target_score)
         VALUES ($1, $2, $3, $4, $5)`,
        [h.id, g.name, g.winnerRule, g.useRounds, g.target],
      );
    }
  });
  res.status(201).json(await loadMe(req.userId));
});

// New members start as Viewers; the owner promotes them from the Family screen
router.post('/join', validate(joinSchema), async (req, res) => {
  await assertNoHousehold(req.userId);
  const { rows } = await query('SELECT id FROM households WHERE invite_code = $1', [req.valid.inviteCode]);
  if (!rows[0]) throw new HttpError(404, 'No family found with that code.');
  await query(
    'INSERT INTO members (household_id, user_id, role) VALUES ($1, $2, $3)',
    [rows[0].id, req.userId, DEFAULT_JOIN_ROLE],
  );
  res.json(await loadMe(req.userId));
});

// ---------- The current family ----------

router.use('/current', requireHousehold);

// Family details, members and the role catalog (for the Family screen)
router.get('/current', async (req, res) => {
  const { role } = req.household;
  const { rows } = await query(
    `SELECT u.id, u.display_name, u.email, m.role, m.joined_at
       FROM members m JOIN users u ON u.id = m.user_id
      WHERE m.household_id = $1
      ORDER BY array_position(ARRAY['owner','scorekeeper','viewer'], m.role), m.joined_at`,
    [req.household.id],
  );
  const seeEmails = can(role, 'members.manage');
  res.json({
    id: req.household.id,
    name: req.household.name,
    role,
    inviteCode: can(role, 'invite.view') ? req.household.invite_code : null,
    defaultJoinRole: DEFAULT_JOIN_ROLE,
    members: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: seeEmails ? r.email : null, // only the owner sees email addresses
      role: r.role,
      roleLabel: ROLES[r.role].label,
      joinedAt: r.joined_at,
      isYou: r.id === req.userId,
    })),
    roles: ROLE_NAMES.map((name) => ({
      name,
      label: ROLES[name].label,
      description: ROLES[name].description,
      permissions: ROLES[name].permissions,
    })),
    permissionLabels: PERMISSIONS,
  });
});

router.patch('/current', requirePermission('family.manage'), validate(nameSchema), async (req, res) => {
  await query('UPDATE households SET name = $1 WHERE id = $2', [req.valid.name, req.household.id]);
  res.json(await loadMe(req.userId));
});

// New invite code: anyone holding the old code can no longer join
router.post('/current/invite-code', requirePermission('invite.reset'), async (req, res) => {
  const { rows } = await query(
    'UPDATE households SET invite_code = $1 WHERE id = $2 RETURNING invite_code',
    [makeInviteCode(), req.household.id],
  );
  res.json({ inviteCode: rows[0].invite_code });
});

// Change someone's role (owners only). A family must always keep at least one owner.
router.patch('/current/members/:userId', requirePermission('members.manage'), validate(roleSchema), async (req, res) => {
  const targetId = idParam(req.params.userId);
  const { role } = req.valid;
  await withTransaction(async (db) => {
    const members = await lockMembers(db, req.household.id);
    const target = members.find((m) => m.user_id === targetId);
    if (!target) throw new HttpError(404, 'That person is not in your family.');
    if (target.role === 'owner' && role !== 'owner' && ownerCount(members) === 1) {
      throw new HttpError(409, 'Your family needs at least one owner. Make someone else an owner first.');
    }
    await db.query(
      'UPDATE members SET role = $1 WHERE household_id = $2 AND user_id = $3',
      [role, req.household.id, targetId],
    );
  });
  res.json({ ok: true });
});

// Remove someone from the family (owners only). Their past scores stay in the history.
router.delete('/current/members/:userId', requirePermission('members.manage'), async (req, res) => {
  const targetId = idParam(req.params.userId);
  if (targetId === req.userId) throw new HttpError(400, 'Use "Leave family" to remove yourself.');
  await withTransaction(async (db) => {
    const members = await lockMembers(db, req.household.id);
    if (!members.some((m) => m.user_id === targetId)) throw new HttpError(404, 'That person is not in your family.');
    await db.query('DELETE FROM members WHERE household_id = $1 AND user_id = $2', [req.household.id, targetId]);
  });
  res.status(204).end();
});

// Leave the family yourself
router.post('/current/leave', async (req, res) => {
  await withTransaction(async (db) => {
    const members = await lockMembers(db, req.household.id);
    if (req.household.role === 'owner' && ownerCount(members) === 1) {
      throw new HttpError(409, members.length === 1
        ? "You're the only member, so you can't leave yet."
        : 'Make someone else an owner before you leave.');
    }
    await db.query('DELETE FROM members WHERE household_id = $1 AND user_id = $2', [req.household.id, req.userId]);
  });
  res.json(await loadMe(req.userId));
});

export default router;
