import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import { Loading } from '../components/Layouts.jsx';
import { useApi } from '../lib/useApi.js';
import { fmtDateTime, winnerText } from '../lib/format.js';

export default function History() {
  const games = useApi('/games');
  const [gameId, setGameId] = useState('');
  const sessions = useApi(`/sessions?limit=200${gameId ? `&gameTypeId=${gameId}` : ''}`);

  return (
    <>
      <PageTitle title="Game history" subtitle="Every game your family has played" />
      <div className="field" style={{ marginBottom: 16, maxWidth: 280 }}>
        <label htmlFor="filter">Show</label>
        <select id="filter" className="input" value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">All games</option>
          {games.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {sessions.loading && !sessions.data && <Loading />}
      {sessions.error && <p className="error">{sessions.error}</p>}
      {sessions.data?.length === 0 && <div className="card empty">No games here yet.</div>}
      <div className="list">
        {sessions.data?.map((s) => (
          <Link key={s.id} to={`/play/${s.id}`} className="list-item">
            <span>
              <strong>{s.gameName}</strong>{' '}
              {s.status === 'finished'
                ? <span className="badge badge-done">Finished</span>
                : <span className="badge">In progress</span>}
              <br />
              <span className="muted">
                {fmtDateTime(s.playedAt)} · {s.playerCount} players
                {s.status === 'finished' && ` · ${winnerText(s.winners)}`}
              </span>
            </span>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </div>
    </>
  );
}
