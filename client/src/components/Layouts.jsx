import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import TabBar from './TabBar.jsx';
import Footer from './Footer.jsx';
import { useAuth } from '../lib/auth.jsx';

export function Loading() {
  return <div className="empty" role="status">Loading…</div>;
}

/** Signed-in pages: header, content, footer line, tab bar. */
export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (!user.household) return <Navigate to="/welcome" replace />;
  return (
    <div className="shell">
      <Header />
      <main className="main"><Outlet /></main>
      <Footer />
      <TabBar />
    </div>
  );
}

/** Signed-out pages (sign in, sign up, welcome, 404): header without the tab bar. */
export function PublicLayout() {
  const { user } = useAuth();
  return (
    <div className="shell">
      <Header signedIn={Boolean(user?.household)} />
      <main className="main"><Outlet /></main>
      <Footer />
    </div>
  );
}
