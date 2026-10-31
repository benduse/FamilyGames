import { Link } from 'react-router-dom';
import { Home, History } from 'lucide-react';

function BigDice() {
  return (
    <svg width="88" height="88" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="3" />
      {[[20, 20], [44, 20], [32, 32], [20, 44], [44, 44]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="var(--primary)" />
      ))}
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="not-found">
      <BigDice />
      <div className="code">404</div>
      <h1>This page rolled off the table</h1>
      <p className="muted" style={{ margin: 0 }}>We couldn't find that page.</p>
      <Link to="/" className="btn btn-primary btn-block"><Home size={18} /> Back to home</Link>
      <Link to="/history" className="row" style={{ gap: 6 }}><History size={16} /> Or see your game history</Link>
    </div>
  );
}
