import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Home, KeyRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Loading } from '../components/Layouts.jsx';

// After sign up: create a new family, or join one with an invite code
export default function Welcome() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.household) return <Navigate to="/" replace />;

  const submit = (path, body) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setUser(await api.post(path, body(new FormData(e.currentTarget))));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth" style={{ maxWidth: 480 }}>
      <div className="auth-head">
        <h1>Hi, {user.displayName.split(' ')[0]}!</h1>
        <p>Set up your family to start keeping score</p>
      </div>
      <div className="stack">
        <form className="card stack" onSubmit={submit('/households', (f) => ({ name: f.get('name') }))}>
          <h2 style={{ fontSize: '1.1rem' }}>Start a new family</h2>
          <div className="field">
            <label htmlFor="name">Family name</label>
            <div className="input-wrap">
              <Home size={18} aria-hidden="true" />
              <input id="name" name="name" className="input" placeholder="The Niyodusengas" required maxLength={60} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy}>Create family</button>
          <small className="muted">We'll add 8 games (Uno, Scrabble, Spades, Hearts, Yahtzee, Rummy, Phase 10 and Mini Golf) so you can play right away.</small>
        </form>
        <form className="card stack" onSubmit={submit('/households/join', (f) => ({ inviteCode: f.get('code') }))}>
          <h2 style={{ fontSize: '1.1rem' }}>Join your family</h2>
          <div className="field">
            <label htmlFor="code">Invite code</label>
            <div className="input-wrap">
              <KeyRound size={18} aria-hidden="true" />
              <input id="code" name="code" className="input num" placeholder="8 letters or numbers" required maxLength={8} style={{ textTransform: 'uppercase' }} />
            </div>
            <small className="muted">Find it in the account menu of whoever created the family.</small>
          </div>
          <button className="btn" disabled={busy}>Join family</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
