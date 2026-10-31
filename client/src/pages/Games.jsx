import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, X, ArrowUpWideNarrow, ArrowDownNarrowWide } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import { Loading } from '../components/Layouts.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate } from '../lib/format.js';

function GameForm({ onSaved, onCancel }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const target = f.get('target');
    setBusy(true);
    try {
      await api.post('/games', {
        name: f.get('name'),
        winnerRule: f.get('winnerRule'),
        useRounds: f.get('scoring') === 'rounds',
        targetScore: target ? Number(target) : null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={onSubmit} style={{ marginBottom: 20 }}>
      <div className="row-between">
        <h2 style={{ fontSize: '1.1rem' }}>Add a game</h2>
        <button type="button" className="btn btn-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="field">
        <label htmlFor="gname">Game name</label>
        <input id="gname" name="name" className="input" required maxLength={40} placeholder="Monopoly" />
      </div>
      <div className="field">
        <label htmlFor="winnerRule">Who wins?</label>
        <select id="winnerRule" name="winnerRule" className="input" defaultValue="high">
          <option value="high">Highest total wins</option>
          <option value="low">Lowest total wins (golf style)</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="scoring">How do you score?</label>
        <select id="scoring" name="scoring" className="input" defaultValue="rounds">
          <option value="rounds">Round by round</option>
          <option value="final">One final score each</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="target">Target score (optional)</label>
        <input id="target" name="target" className="input num" type="number" inputMode="numeric" min="1" placeholder="500" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save game'}</button>
    </form>
  );
}

export default function Games() {
  const { can } = useAuth();
  const { data: games, loading, error, reload } = useApi('/games');
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageTitle
        title="Games"
        subtitle="Pick a game to start keeping score"
        action={can('games.manage') && !adding && <button className="btn" onClick={() => setAdding(true)}><Plus size={18} /> Add game</button>}
      />
      {adding && <GameForm onSaved={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />}
      {loading && !games && <Loading />}
      {error && <p className="error">{error}</p>}
      <div className="list">
        {games?.map((g) => (
          <div key={g.id} className="list-item">
            <div>
              <strong>{g.name}</strong>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span className="badge">
                  {g.winnerRule === 'low' ? <ArrowDownNarrowWide size={14} /> : <ArrowUpWideNarrow size={14} />}
                  {g.winnerRule === 'low' ? 'Lowest wins' : 'Highest wins'}
                </span>
                <span className="badge">{g.useRounds ? 'Rounds' : 'Final score'}</span>
                {g.targetScore && <span className="badge">To {g.targetScore}</span>}
              </div>
              <small className="muted">
                {g.timesPlayed ? `Played ${g.timesPlayed}× · last ${fmtDate(g.lastPlayed)}` : 'Not played yet'}
              </small>
            </div>
            {can('scores.edit') && (
              <Link to={`/play/new?game=${g.id}`} className="btn btn-primary" aria-label={`Play ${g.name}`}>
                <Play size={18} /> Play
              </Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
