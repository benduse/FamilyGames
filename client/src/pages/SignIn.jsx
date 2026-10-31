import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { IconField } from './AuthForm.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function SignIn() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await signIn(form.get('email'), form.get('password'));
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-head">
        <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}><Logo size={48} /></div>
        <h1>Welcome back</h1>
        <p>Sign in to keep score</p>
      </div>
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <IconField id="email" name="email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@email.com" required />
        <IconField id="password" name="password" label="Password" icon={Lock} type="password" autoComplete="current-password" required />
        <div className="auth-links">
          <span />
          <button type="button" className="input-action" style={{ position: 'static', color: 'var(--primary)' }} onClick={() => setShowReset((s) => !s)}>
            Forgot password?
          </button>
        </div>
        {showReset && (
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Password reset by email is coming in a later version. For now, ask whoever set up your family account for help.
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          <LogIn size={18} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">New here? <Link to="/signup">Create an account</Link></p>
    </div>
  );
}
