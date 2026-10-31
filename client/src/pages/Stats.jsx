import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import PageTitle from '../components/PageTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import { Loading } from '../components/Layouts.jsx';
import { useApi } from '../lib/useApi.js';

// Display order: 2nd, 1st, 3rd. Bar height follows each player's wins.
const PODIUM = [
  { place: 2, color: 'var(--silver)' },
  { place: 1, color: 'var(--gold)' },
  { place: 3, color: 'var(--bronze)' },
];
const barHeight = (wins, maxWins) => 36 + (maxWins ? Math.round((110 * wins) / maxWins) : 0);

const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export default function Stats() {
  const [params, setParams] = useSearchParams();
  const games = useApi('/games');
  const gameId = params.get('game') || '';

  // Default to the most recently played game
  useEffect(() => {
    if (!gameId && games.data?.length) {
      const first = games.data.find((g) => g.timesPlayed > 0) || games.data[0];
      setParams({ game: String(first.id) }, { replace: true });
    }
  }, [gameId, games.data, setParams]);

  const board = useApi(gameId ? `/stats/leaderboard/${gameId}` : null);
  const overTime = useApi(gameId ? `/stats/over-time/${gameId}` : null);

  // Turn monthly wins into a running total per player for the line chart
  const chart = useMemo(() => {
    if (!board.data || !overTime.data) return [];
    const months = [...new Set(overTime.data.map((r) => r.month))].sort();
    const running = Object.fromEntries(board.data.map((p) => [p.id, 0]));
    if (!months.length) return [];
    const start = { month: 'Start', ...Object.fromEntries(board.data.map((p) => [p.name, 0])) };
    return [start, ...months.map((month) => {
      for (const r of overTime.data.filter((x) => x.month === month)) running[r.playerId] += r.wins;
      const row = { month: monthLabel(month) };
      for (const p of board.data) row[p.name] = running[p.id];
      return row;
    })];
  }, [board.data, overTime.data]);

  const top3 = board.data?.slice(0, 3) ?? [];
  const game = games.data?.find((g) => String(g.id) === gameId);

  return (
    <>
      <PageTitle
        title="Stats"
        subtitle="Who's on top"
        action={(
          <select
            aria-label="Game"
            className="input"
            style={{ width: 'auto', borderRadius: 999 }}
            value={gameId}
            onChange={(e) => setParams({ game: e.target.value })}
          >
            {games.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      />

      {(games.loading || board.loading) && !board.data && <Loading />}
      {board.error && <p className="error">{board.error}</p>}
      {board.data?.length === 0 && (
        <div className="card empty">No finished {game?.name ?? ''} games yet. Finish one to see the podium.</div>
      )}

      {top3.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Wins, all time</h2>
          <div className="podium">
            {PODIUM.map(({ place, color }) => {
              const p = top3[place - 1];
              if (!p) return <div key={place} className="podium-col" />;
              return (
                <div key={place} className="podium-col">
                  <Avatar player={p} size={place === 1 ? 52 : 44} />
                  <strong>{p.name}</strong>
                  <div className="podium-bar num" style={{ height: barHeight(p.wins, top3[0].wins), background: color }}>{p.wins}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {board.data?.length > 0 && (
        <section className="section">
          <h2>Leaderboard</h2>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Player</th><th className="n">Wins</th><th className="n">Played</th>
                  <th className="n">Win %</th><th className="n">{game?.winnerRule === 'low' ? 'Best (low)' : 'Best'}</th>
                </tr>
              </thead>
              <tbody>
                {board.data.map((p, i) => (
                  <tr key={p.id}>
                    <td className="num">{i + 1}</td>
                    <td><span className="row" style={{ gap: 8 }}><Avatar player={p} size={28} ring={false} />{p.name}</span></td>
                    <td className="n">{p.wins}</td>
                    <td className="n">{p.played}</td>
                    <td className="n">{p.winRate}%</td>
                    <td className="n">{p.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {chart.length > 0 && (
        <section className="section">
          <h2>Ranking over time</h2>
          <div className="card" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" tickLine={false} />
                <YAxis allowDecimals={false} stroke="var(--muted)" tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Legend />
                {board.data.map((p) => (
                  <Line key={p.id} type="monotone" dataKey={p.name} stroke={p.color} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Total wins at the end of each month.</p>
        </section>
      )}
    </>
  );
}
