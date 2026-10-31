import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Copy, Check, LogOut, History, ShieldCheck } from 'lucide-react';
import Logo from './Logo.jsx';
import { NAV_ITEMS } from './TabBar.jsx';
import { useAuth } from '../lib/auth.jsx';

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, []);

  const copyCode = async () => {
    await navigator.clipboard?.writeText(user.household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const initials = user.displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="avatar"
        style={{ width: 38, height: 38, background: 'var(--primary)', color: '#fff', border: 0, cursor: 'pointer', fontSize: 15 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {initials}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-meta">
            <strong style={{ color: 'var(--text)' }}>{user.displayName}</strong><br />
            {user.household?.name} · {user.household?.roleLabel}
          </div>
          {user.household?.inviteCode && (
            <button type="button" className="menu-item" role="menuitem" onClick={copyCode}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>Invite code: <strong className="num">{user.household.inviteCode}</strong></span>
            </button>
          )}
          <Link className="menu-item" role="menuitem" to="/family" onClick={() => setOpen(false)}>
            <ShieldCheck size={18} /> Family &amp; roles
          </Link>
          <Link className="menu-item" role="menuitem" to="/history" onClick={() => setOpen(false)}>
            <History size={18} /> Game history
          </Link>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={async () => { await signOut(); navigate('/signin'); }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ signedIn = true }) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="Family Games home">
          <Logo />
          <span>
            <span className="brand-name">Family Games</span><br />
            <span className="brand-sub">Score Card</span>
          </span>
        </Link>
        <div className="header-spacer" />
        {signedIn && (
          <>
            <nav className="top-nav" aria-label="Main">
              {NAV_ITEMS.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}>
                  <Icon size={18} /> {label}
                </NavLink>
              ))}
            </nav>
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
