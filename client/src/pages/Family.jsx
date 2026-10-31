import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy, Check, RefreshCw, UserMinus, LogOut, Pencil, Crown, ClipboardList, Eye,
} from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import { Loading } from '../components/Layouts.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate } from '../lib/format.js';

const ROLE_ICONS = { owner: Crown, scorekeeper: ClipboardList, viewer: Eye };

function RoleBadge({ role, label }) {
  const Icon = ROLE_ICONS[role];
  return <span className={`badge role-${role}`}><Icon size={13} aria-hidden="true" /> {label}</span>;
}

function Initials({ name }) {
  const text = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="avatar" style={{ width: 40, height: 40, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 15 }} aria-hidden="true">
      {text}
    </span>
  );
}

function InviteCard({ code, canReset, onReset, joinRoleLabel }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <section className="card stack">
      <h2 style={{ fontSize: '1.1rem' }}>Invite family members</h2>
      <p className="muted" style={{ margin: 0 }}>
        Share this code. They create an account, choose <strong>Join your family</strong> and enter it.
        New members start as <strong>{joinRoleLabel}s</strong> until an owner changes their role.
      </p>
      <div className="invite-code num" aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy code'}
        </button>
        {canReset && (
          <button type="button" className="btn" onClick={onReset}>
            <RefreshCw size={18} /> New code
          </button>
        )}
      </div>
    </section>
  );
}

export default function Family() {
  const { user, can, refresh } = useAuth();
  const navigate = useNavigate();
  const { data: family, error, loading, reload } = useApi('/households/current');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [renaming, setRenaming] = useState(false);

  if (loading && !family) return <Loading />;
  if (error && !family) return <p className="error">{error}</p>;

  const canManage = can('members.manage');
  const roleOf = (name) => family.roles.find((r) => r.name === name);

  // Runs an action, shows its result, then reloads the family and our own permissions
  const run = async (fn, success) => {
    setActionError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
      await Promise.all([reload(), refresh()]);
    } catch (err) {
      setActionError(err.message);
      reload();
    }
  };

  const changeRole = (member, role) => {
    if (member.isYou && role !== 'owner'
      && !confirm(`Change your own role to ${roleOf(role).label}? You will lose owner controls.`)) {
      reload();
      return;
    }
    run(
      () => api.patch(`/households/current/members/${member.id}`, { role }),
      `${member.displayName} is now ${roleOf(role).label}.`,
    );
  };

  const removeMember = (member) => {
    if (!confirm(`Remove ${member.displayName} from ${family.name}? Their past scores stay in the history.`)) return;
    run(() => api.del(`/households/current/members/${member.id}`), `${member.displayName} was removed.`);
  };

  const resetCode = () => {
    if (!confirm('Make a new invite code? The old code will stop working.')) return;
    run(() => api.post('/households/current/invite-code'), 'New invite code ready.');
  };

  const rename = async (e) => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get('name');
    await run(() => api.patch('/households/current', { name }), 'Family name updated.');
    setRenaming(false);
  };

  const leave = async () => {
    if (!confirm(`Leave ${family.name}? You'll need a new invite code to come back.`)) return;
    setActionError('');
    try {
      await api.post('/households/current/leave');
      await refresh();
      navigate('/welcome', { replace: true });
    } catch (err) {
      setActionError(err.message);
    }
  };

  const you = family.members.find((m) => m.isYou);

  return (
    <>
      <PageTitle
        title="Family & roles"
        subtitle={`${family.name} · You're ${roleOf(you.role).label === 'Owner' ? 'an' : 'a'} ${roleOf(you.role).label}`}
      />

      <div aria-live="polite">
        {message && <p className="notice">{message}</p>}
        {actionError && <p className="error" role="alert" style={{ marginBottom: 12 }}>{actionError}</p>}
      </div>

      <div className="stack">
        {family.inviteCode && (
          <InviteCard
            code={family.inviteCode}
            canReset={can('invite.reset')}
            onReset={resetCode}
            joinRoleLabel={roleOf(family.defaultJoinRole).label}
          />
        )}

        {can('family.manage') && (
          <section className="card">
            {renaming ? (
              <form className="row" onSubmit={rename} style={{ flexWrap: 'wrap' }}>
                <label htmlFor="famname" className="sr-only">Family name</label>
                <input id="famname" name="name" className="input" defaultValue={family.name} maxLength={60} required style={{ flex: 1, minWidth: 180 }} />
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn" onClick={() => setRenaming(false)}>Cancel</button>
              </form>
            ) : (
              <div className="row-between">
                <span><span className="muted">Family name</span><br /><strong>{family.name}</strong></span>
                <button type="button" className="btn" onClick={() => setRenaming(true)}><Pencil size={16} /> Rename</button>
              </div>
            )}
          </section>
        )}
      </div>

      <section className="section">
        <h2>Members ({family.members.length})</h2>
        <div className="list">
          {family.members.map((m) => (
            <div key={m.id} className="list-item member-row">
              <div className="row" style={{ minWidth: 0 }}>
                <Initials name={m.displayName} />
                <span style={{ minWidth: 0 }}>
                  <strong>{m.displayName}</strong>{m.isYou && <span className="muted"> (you)</span>}
                  <br />
                  <span className="muted member-meta">
                    {m.email ? `${m.email} · ` : ''}joined {fmtDate(m.joinedAt)}
                  </span>
                </span>
              </div>
              <div className="row member-actions">
                {canManage ? (
                  <>
                    <label htmlFor={`role-${m.id}`} className="sr-only">Role for {m.displayName}</label>
                    <select
                      id={`role-${m.id}`}
                      className="input role-select"
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value)}
                    >
                      {family.roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
                    </select>
                    {!m.isYou && (
                      <button type="button" className="btn btn-icon btn-danger" onClick={() => removeMember(m)} aria-label={`Remove ${m.displayName}`}>
                        <UserMinus size={18} />
                      </button>
                    )}
                  </>
                ) : (
                  <RoleBadge role={m.role} label={m.roleLabel} />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>What each role can do</h2>
        <div className="role-cards">
          {family.roles.map((r) => (
            <div key={r.name} className={`card role-card ${r.name === you.role ? 'is-you' : ''}`}>
              <div className="row-between">
                <RoleBadge role={r.name} label={r.label} />
                {r.name === you.role && <span className="muted" style={{ fontSize: '0.8rem' }}>Your role</span>}
              </div>
              <p style={{ margin: '8px 0' }}>{r.description}</p>
              <ul className="perm-list">
                <li><Check size={16} aria-hidden="true" /> See scores, history and stats</li>
                {r.permissions.map((p) => (
                  <li key={p}><Check size={16} aria-hidden="true" /> {family.permissionLabels[p]}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <button type="button" className="btn btn-danger" onClick={leave}>
          <LogOut size={18} /> Leave family
        </button>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Signed in as {user.email}. Leaving keeps your account but removes you from {family.name}.
        </p>
      </section>
    </>
  );
}
