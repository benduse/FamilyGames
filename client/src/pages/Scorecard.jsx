import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Flag, Trophy, Crown, RotateCcw, Trash2 } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import { Loading } from '../components/Layouts.jsx';
import NotFound from './NotFound.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDateTime } from '../lib/format.js';

const key = (playerId, round) => `${playerId}:${round}`;

export default function Scorecard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can('scores.edit');
  const { data: game, error, loading, reload } = useApi(`/sessions/${id}`);

  const [cells, setCells] = useState({}); // "playerId:round" -> text in the input
  const [saved, setSaved] = useState({}); // last value the server has, to skip no-op saves
  const [rounds, setRounds] = useState(1);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const pending = useRef(Promise.resolve()); // saves run one at a time, and Finish waits for them

  // Load server scores into the grid
  useEffect(() => {
    if (!game) return;
    const next = {};
    for (const s of game.scores) next[key(s.playerId, s.roundNo)] = String(s.points);
    setCells(next);
    setSaved(next);
    const maxRound = game.scores.reduce((m, s) => Math.max(m, s.roundNo), 0);
    setRounds(game.useRounds ? Math.max(maxRound, 1) : 1);
  }, [game]);

  // Totals and leader are computed live from what's on screen
  const totals = useMemo(() => {
    const t = {};
    for (const p of game?.players ?? []) {
      t[p.id] = 0;
      for (let r = 1; r <= rounds; r += 1) {
        const n = parseInt(cells[key(p.id, r)], 10);
        if (!Number.isNaN(n)) t[p.id] += n;
      }
    }
    return t;
  }, [cells, game, rounds]);

  const hasScores = Object.values(cells).some((v) => v !== '' && v !== undefined);
  const leaders = useMemo(() => {
    if (!game || !hasScores) return [];
    const values = game.players.map((p) => totals[p.id]);
    const best = game.winnerRule === 'low' ? Math.min(...values) : Math.max(...values);
    return game.players.filter((p) => totals[p.id] === best);
  }, [game, totals, hasScores]);

  if (loading && !game) return <Loading />;
  if (error && !game) return error.includes('not found') ? <NotFound /> : <p className="error">{error}</p>;

  const finished = game.status === 'finished';
  const editable = canEdit && !finished;
  // High-wins games end when someone climbs to the target; low-wins games (Hearts) end when someone hits it
  const reachedTarget = game.targetScore
    ? game.players.filter((p) => totals[p.id] >= game.targetScore) : [];

  const saveCell = (playerId, round) => {
    pending.current = pending.current.then(() => doSave(playerId, round));
    return pending.current;
  };

  const doSave = async (playerId, round) => {
    const k = key(playerId, round);
    const text = (cells[k] ?? '').trim();
    if (text === (saved[k] ?? '')) return;
    if (text !== '' && !/^-?\d+$/.test(text)) {
      setSaveError('Scores must be whole numbers.');
      return;
    }
    setStatus('Saving…');
    setSaveError('');
    try {
      await api.put(`/sessions/${id}/scores`, { playerId, roundNo: round, points: text === '' ? null : Number(text) });
      setSaved((s) => ({ ...s, [k]: text }));
      setStatus('Saved');
      setTimeout(() => setStatus(''), 1200);
    } catch (err) {
      setStatus('');
      setSaveError(err.message);
    }
  };

  const finish = async () => {
    await pending.current;
    if (!confirm('Finish this game? The winner will be recorded.')) return;
    await api.post(`/sessions/${id}/finish`);
    reload();
  };
  const reopen = async () => { await api.post(`/sessions/${id}/reopen`); reload(); };
  const remove = async () => {
    if (!confirm('Delete this game from the history?')) return;
    await api.del(`/sessions/${id}`);
    navigate('/history', { replace: true });
  };

  const roundRows = Array.from({ length: rounds }, (_, i) => i + 1);

  return (
    <>
      <PageTitle
        title={game.gameName}
        subtitle={`${fmtDateTime(game.playedAt)} · ${game.winnerRule === 'low' ? 'Lowest' : 'Highest'} total wins${game.targetScore ? ` · to ${game.targetScore}` : ''}`}
        action={finished && <span className="badge badge-done">Finished</span>}
      />

      <div className="scorecard-wrap">
        <table className="scorecard">
          <thead>
            <tr>
              <th className="rd" scope="col">{game.useRounds ? 'Rd' : ''}</th>
              {game.players.map((p) => (
                <th key={p.id} scope="col">
                  <span className="player-head">
                    <Avatar player={p} size={36} />
                    <span>{p.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roundRows.map((r) => (
              <tr key={r}>
                <th className="rd" scope="row">{game.useRounds ? r : 'Score'}</th>
                {game.players.map((p) => {
                  const k = key(p.id, r);
                  return (
                    <td key={p.id}>
                      {editable ? (
                        <input
                          className="cell-input"
                          inputMode="numeric"
                          aria-label={`${p.name}, ${game.useRounds ? `round ${r}` : 'score'}`}
                          value={cells[k] ?? ''}
                          onChange={(e) => setCells((c) => ({ ...c, [k]: e.target.value }))}
                          onBlur={() => saveCell(p.id, r)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        />
                      ) : (
                        <span className="num">{cells[k] ?? '–'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="totals">
              <th className="rd" scope="row">Total</th>
              {game.players.map((p) => (
                <td key={p.id} className={`num ${leaders.some((l) => l.id === p.id) ? 'lead' : ''}`}>
                  {totals[p.id]}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="saving" aria-live="polite">{status}</div>
      {saveError && <p className="error" role="alert">{saveError}</p>}

      {leaders.length > 0 && (
        <div className="leader-banner">
          {finished ? <Trophy size={22} /> : <Crown size={22} />}
          <span>
            {finished ? (leaders.length > 1 ? 'Tie! Winners: ' : 'Winner: ') : 'Leading: '}
            {leaders.map((l) => l.name).join(' & ')} ({totals[leaders[0].id]})
          </span>
        </div>
      )}
      {!finished && reachedTarget.length > 0 && (
        <p className="muted">{reachedTarget.map((p) => p.name).join(' & ')} reached {game.targetScore}. Time to finish?</p>
      )}

      {editable && (
        <div className="stack" style={{ marginTop: 12 }}>
          {game.useRounds && (
            <button className="btn btn-block" onClick={() => setRounds((n) => n + 1)}>
              <Plus size={18} /> Add round
            </button>
          )}
          <button className="btn btn-primary btn-block btn-big" onClick={finish}>
            <Flag size={20} /> Finish game
          </button>
        </div>
      )}

      {finished && (canEdit || can('sessions.delete')) && (
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {canEdit && <button className="btn" onClick={reopen}><RotateCcw size={18} /> Reopen to fix scores</button>}
          {can('sessions.delete') && <button className="btn btn-danger" onClick={remove}><Trash2 size={18} /> Delete game</button>}
        </div>
      )}
    </>
  );
}
