import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import { Loading } from '../components/Layouts.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

// Pick the game and who is playing. The date and time are recorded automatically when you press Start.
export default function NewGame() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const games = useApi('/games');
  const players = useApi('/players');
  const [gameId, setGameId] = useState(Number(params.get('game')) || '');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Everyone is selected by default; tap to leave someone out
  useEffect(() => {
    if (players.data) setPicked(players.data.map((p) => p.id));
  }, [players.data]);

  useEffect(() => {
    if (!gameId && games.data?.[0]) setGameId(games.data[0].id);
  }, [games.data, gameId]);

  const toggle = (id) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const ordered = players.data.filter((p) => picked.includes(p.id)).map((p) => p.id);
      const { id } = await api.post('/sessions', { gameTypeId: Number(gameId), playerIds: ordered });
      navigate(`/play/${id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (games.loading || players.loading) return <Loading />;

  return (
    <>
      <PageTitle title="New game" subtitle="Choose the game and who's playing" />
      <div className="stack">
        <div className="field">
          <label htmlFor="game">Game</label>
          <select id="game" className="input" value={gameId} onChange={(e) => setGameId(Number(e.target.value))}>
            {games.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <strong>Players ({picked.length})</strong>
            <Link to="/players">Add a player</Link>
          </div>
          {players.data?.length === 0 && <div className="card empty">Add players first.</div>}
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
            {players.data?.map((p) => (
              <button key={p.id} type="button" className="pick" aria-pressed={picked.includes(p.id)} onClick={() => toggle(p.id)}>
                <Avatar player={p} size={52} ring={picked.includes(p.id)} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-big" onClick={start} disabled={busy || !gameId || picked.length === 0}>
          <Play size={20} /> {busy ? 'Starting…' : 'Start game'}
        </button>
      </div>
    </>
  );
}
