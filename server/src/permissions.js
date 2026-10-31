// Roles and what each one is allowed to do.
// This file is the single source of truth: the API checks it, and /api/auth/me
// sends the signed-in user's permission list to the app so buttons can hide.

export const PERMISSIONS = {
  'scores.edit': 'Start games, enter scores, finish and reopen games',
  'players.manage': 'Add, edit and remove players and photos',
  'games.manage': 'Add and edit game types',
  'sessions.delete': 'Delete a game from the history',
  'invite.view': 'See and share the invite code',
  'invite.reset': 'Make a new invite code (the old one stops working)',
  'members.manage': 'Change roles and remove members',
  'family.manage': 'Rename the family',
};

export const ROLES = {
  owner: {
    label: 'Owner',
    description: 'Runs the family account. Can do everything, including managing members and roles.',
    permissions: Object.keys(PERMISSIONS),
  },
  scorekeeper: {
    label: 'Scorekeeper',
    description: 'Runs game night: starts games, keeps score, manages players and games.',
    permissions: ['scores.edit', 'players.manage', 'games.manage', 'invite.view'],
  },
  viewer: {
    label: 'Viewer',
    description: 'Follows along: sees scores, history and stats, but cannot change anything.',
    permissions: [],
  },
};

export const ROLE_NAMES = Object.keys(ROLES);

/** Role new members get when they join with the invite code. The owner can promote them. */
export const DEFAULT_JOIN_ROLE = 'viewer';

export const can = (role, permission) => Boolean(ROLES[role]?.permissions.includes(permission));
