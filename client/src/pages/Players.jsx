import { useRef, useState } from 'react';
import { Plus, Camera, Pencil, X } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import { Loading } from '../components/Layouts.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { resizePhoto } from '../lib/image.js';
import { PLAYER_COLORS } from '../lib/format.js';

function PlayerForm({ player, onSaved, onCancel }) {
  const [name, setName] = useState(player?.name || '');
  const [color, setColor] = useState(player?.color || PLAYER_COLORS[1].hex);
  const [photo, setPhoto] = useState(undefined); // undefined = unchanged, null = remove, string = new
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const preview = photo === undefined ? player : { name, color, hasPhoto: false };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await resizePhoto(file));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { name, color, ...(photo !== undefined && { photo }) };
      const saved = player ? await api.patch(`/players/${player.id}`, body) : await api.post('/players', body);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${player.name}? Their past games stay in the history.`)) return;
    await api.patch(`/players/${player.id}`, { archived: true });
    onSaved(null);
  };

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div className="row-between">
        <h2 style={{ fontSize: '1.1rem' }}>{player ? `Edit ${player.name}` : 'Add a player'}</h2>
        <button type="button" className="btn btn-icon" onClick={onCancel} aria-label="Close"><X size={18} /></button>
      </div>

      <div className="row">
        {typeof photo === 'string'
          ? <span className="avatar" style={{ width: 72, height: 72, '--ring': color }}><img src={photo} alt="New photo preview" /></span>
          : <Avatar player={{ ...preview, name: name || '?', color }} size={72} />}
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Camera size={18} /> {player?.hasPhoto || photo ? 'Change photo' : 'Add photo'}
          </button>
          {(player?.hasPhoto || typeof photo === 'string') && photo !== null && (
            <button type="button" className="btn btn-danger" onClick={() => setPhoto(null)}>Remove photo</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pname">Name</label>
        <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Grandma" />
      </div>

      <div className="field">
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }} id="color-label">Color</span>
        <div className="color-row" role="radiogroup" aria-labelledby="color-label">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className="swatch"
              role="radio"
              aria-checked={color.toUpperCase() === c.hex}
              aria-label={c.name}
              style={{ background: c.hex }}
              onClick={() => setColor(c.hex)}
            />
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="row-between">
        {player ? <button type="button" className="btn btn-danger" onClick={remove}>Remove player</button> : <span />}
        <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

export default function Players() {
  const { can } = useAuth();
  const canEdit = can('players.manage');
  const { data: players, loading, error, reload } = useApi('/players');
  const [editing, setEditing] = useState(null); // null = closed, 'new', or a player

  const done = () => { setEditing(null); reload(); };

  return (
    <>
      <PageTitle
        title="Players"
        subtitle="Everyone who plays on game night"
        action={canEdit && !editing && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} /> Add</button>
        )}
      />
      {editing && (
        <div style={{ marginBottom: 20 }}>
          <PlayerForm key={editing === 'new' ? 'new' : editing.id} player={editing === 'new' ? null : editing} onSaved={done} onCancel={() => setEditing(null)} />
        </div>
      )}
      {loading && !players && <Loading />}
      {error && <p className="error">{error}</p>}
      <div className="grid-cards">
        {players?.map((p) => (
          <div key={p.id} className="card" style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center' }}>
            <Avatar player={p} size={72} />
            <strong>{p.name}</strong>
            {canEdit && (
              <button className="btn" style={{ minHeight: 36, padding: '6px 12px' }} onClick={() => setEditing(p)}>
                <Pencil size={16} /> Edit
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
