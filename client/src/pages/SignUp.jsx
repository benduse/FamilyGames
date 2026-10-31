import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, UserPlus } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { IconField } from './AuthForm.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function SignUp() {
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await signUp(form.get('displayName'), form.get('email'), form.get('password'));
      navigate('/welcome', { replace: true });
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
        <h1>Create your account</h1>
        <p>Start keeping score with your family</p>
      </div>
      <form className="card stack" onSubmit={onSubmit} noValidate>
        <IconField id="displayName" name="displayName" label="Your name" icon={User} autoComplete="name" placeholder="Benjamin" required maxLength={60} />
        <IconField id="email" name="email" label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@email.com" required />
        <IconField id="password" name="password" label="Password" icon={Lock} type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters" />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          <UserPlus size={18} /> {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/signin">Sign in</Link></p>
    </div>
  );
}
