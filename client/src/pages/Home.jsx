import { Link } from 'react-router-dom';
import { Plus, Trophy, ChevronRight } from 'lucide-react';
import PageTitle from '../components/PageTitle.jsx';
import Avatar from '../components/Avatar.jsx';
import { Loading } from '../components/Layouts.jsx';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, fmtToday, winnerText } from '../lib/format.js';

export default function Home() {
  const { user, can } = useAuth();
  const recent = useApi('/sessions?limit=5');
  const top = useApi('/stats/top');

  return (
    <>
      <PageTitle title="Game night" subtitle={`${fmtToday()} · ${user.household.name}`} />

      {can('scores.edit') && (
        <Link to="/games" className="btn btn-primary btn-block btn-big">
          <Plus size={22} /> Start a game
        </Link>
      )}

      <section className="section">
        <div className="row-between"><h2>Recent games</h2><Link to="/history">See all</Link></div>
        {recent.loading && <Loading />}
        {recent.error && <p className="error">{recent.error}</p>}
        {recent.data?.length === 0 && <div className="card empty">No games yet. Start one and it will show up here.</div>}
        <div className="list">
          {recent.data?.map((s) => (
            <Link key={s.id} to={`/play/${s.id}`} className="list-item">
              <span>
                <strong>{s.gameName}</strong> · {fmtDate(s.playedAt)}
                <br />
                <span className="muted">
                  {s.status === 'finished' ? winnerText(s.winners) : 'In progress'}
                </span>
              </span>
              <ChevronRight size={18} className="muted" />
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="row" style={{ gap: 8 }}><Trophy size={20} color="var(--accent)" /> Top scorer per game</h2>
        {top.data?.length === 0 && <div className="card empty">Finish a game to crown your first champion.</div>}
        <div className="top-scorers">
          {top.data?.map((t) => (
            <Link key={t.gameTypeId} to={`/stats?game=${t.gameTypeId}`} className="card top-scorer" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Avatar player={{ id: t.playerId, name: t.playerName, color: t.color, hasPhoto: t.hasPhoto, version: t.version }} size={52} />
              <strong>{t.playerName}</strong>
              <span className="muted" style={{ fontSize: '0.85rem' }}>{t.gameName} · {t.wins} {t.wins === 1 ? 'win' : 'wins'}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
