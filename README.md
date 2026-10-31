# Family Games Score Card (MVP)

Keep score on family game night: sign in, add players with photos, pick a game, enter scores round by round, and see who's on top.

**Stack:** JavaScript · React (Vite, React Router, Recharts, lucide-react icons) · HTML · CSS · Node.js + Express · PostgreSQL (SQL) · Netlify · Render · GitHub

```
family-games-scorecard/
├── client/          React app (deploys to Netlify)
│   ├── src/pages/       Sign in, Sign up, Welcome, Home, Players, Games, New game, Scorecard, History, Stats, 404
│   ├── src/components/  Header, Tab bar, Footer, Avatar, Logo, Layouts
│   ├── src/lib/         API client, auth context, photo resize, formatting
│   └── netlify.toml     Build settings, /api proxy to Render, security headers
├── server/          Express API (deploys to Render)
│   └── src/routes/      auth, households, players, games, sessions, stats
├── db/schema.sql    Tables, constraints and the views that decide winners
└── render.yaml      One-click Render setup (API + database)
```

## What's in the MVP

- Email + password accounts (bcrypt hashes, httpOnly cookie, rate-limited sign-in)
- Create a family, or join one with an 8-character invite code
- Roles (Owner, Scorekeeper, Viewer) with a Family & roles screen to invite, promote, remove and leave
- Players with a color and an optional photo (resized to 256 px in the browser)
- 8 starter games (Uno, Scrabble, Spades, Hearts, Yahtzee, Rummy, Phase 10, Mini Golf) and your own games: highest or lowest wins, rounds or one final score, optional target
- Start a game: the date and time are logged automatically
- Live scorecard with running totals, leader highlight, add round, finish, reopen, delete
- Home dashboard (recent games, top scorer per game), game history, stats (podium, leaderboard, ranking over time chart)
- Header with logo and subtitle, bottom tab bar with icons on phones (top nav on desktop), footer, 404 page

## Roles

Every member of a family has one role. The rules live in `server/src/permissions.js`; the API enforces them and the app hides buttons you can't use.

| Can... | Owner | Scorekeeper | Viewer |
| --- | :-: | :-: | :-: |
| See scores, history and stats | ✓ | ✓ | ✓ |
| Start games, enter scores, finish and reopen games | ✓ | ✓ | |
| Add, edit and remove players and photos | ✓ | ✓ | |
| Add and edit game types | ✓ | ✓ | |
| See and share the invite code | ✓ | ✓ | |
| Delete a game from the history | ✓ | | |
| Make a new invite code | ✓ | | |
| Change roles and remove members | ✓ | | |
| Rename the family | ✓ | | |

- The person who creates the family is the **Owner**. People who join with the invite code start as **Viewers**; an owner promotes them on the **Family & roles** screen (account menu).
- A family can have several owners but never zero: the last owner can't be demoted, removed or leave.
- Viewers never receive the invite code, and only owners see members' email addresses.
- To add a permission: add it to `PERMISSIONS`, list it under the roles that get it, then protect the route with `requirePermission('your.permission')` and check `can('your.permission')` in the app.

## Run it on your computer

You need **Node.js 22** and **PostgreSQL 14+** installed.

```bash
# 1. Database
createdb family_games
psql family_games -f db/schema.sql

# 2. API (terminal 1)
cd server
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm install
npm run dev                   # http://localhost:4000/api/health

# 3. App (terminal 2)
cd client
npm install
npm run dev                   # open http://localhost:5173
```

No `psql`? After step 2's `.env` is set, run `npm run db:schema` inside `server/` instead.

Generate a JWT secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Deploy

1. **GitHub:** create an empty repo, then
   `git init && git add . && git commit -m "MVP" && git branch -M main && git remote add origin <url> && git push -u origin main`
2. **Render (API + database):** New > Blueprint > choose the repo. `render.yaml` creates the database and the API.
   - Load the tables once from your laptop using the database's **External URL**: `psql "<external url>" -f db/schema.sql` (or put that URL in `server/.env` with `DATABASE_SSL=true` and run `npm run db:schema`).
   - After Netlify gives you a URL, set `CLIENT_ORIGIN` on the API to it.
3. **Netlify (app):** Add new site > Import from GitHub. Base directory `client`, build command `npm run build`, publish directory `client/dist`.
   - Edit `client/netlify.toml` and replace `YOUR-API` with your Render service name, then push.

**Why the Netlify proxy?** The app calls `/api/...` on its own Netlify address, and Netlify forwards the call to Render. That keeps the login cookie "first-party", which Safari and other browsers require.

**Render free tier:** free databases expire 30 days after creation and free web services sleep when idle (the first request after a break is slow). Fine for building; upgrade the database before the family relies on it.

## Security checklist (already built in)

- Passwords hashed with bcrypt (cost 12); login token in an httpOnly, SameSite cookie, 7-day expiry
- Sign-in and sign-up limited to 10 attempts per 15 minutes per IP
- Every query is parameterized (`$1, $2`), and every query is scoped to the signed-in user's household, looked up on the server
- Input validated with zod, backed by database constraints
- Photos: type and file signature checked, 300 KB cap, served only to family members
- helmet security headers, CORS locked to your site, JSON size limit, errors never leak SQL or stack traces
- Secrets only in `.env` (git-ignored) or Render/Netlify settings

## Known limits / next steps

- Password reset by email is not built yet
- Negative scores: some phone keyboards hide the minus key on number pads
- Scores refresh when you reload; live sync between phones comes later
- Next phases: game builder with teams and extra columns, dark-mode toggle, PWA install, CSV export, tests
