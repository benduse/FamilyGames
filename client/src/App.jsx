import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout, PublicLayout, Loading } from './components/Layouts.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import Welcome from './pages/Welcome.jsx';
import Home from './pages/Home.jsx';
import Players from './pages/Players.jsx';
import Games from './pages/Games.jsx';
import NewGame from './pages/NewGame.jsx';
import Scorecard from './pages/Scorecard.jsx';
import History from './pages/History.jsx';
// Stats carries the charting library, so it loads only when opened
const Stats = lazy(() => import('./pages/Stats.jsx'));
import NotFound from './pages/NotFound.jsx';
import Family from './pages/Family.jsx';

export default function App() {
  return (
    <Routes>
      {/* Signed-out screens: header + footer, no tab bar */}
      <Route element={<PublicLayout />}>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/welcome" element={<Welcome />} />
      </Route>

      {/* Signed-in screens: header, tab bar, footer */}
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/players" element={<Players />} />
        <Route path="/stats" element={<Suspense fallback={<Loading />}><Stats /></Suspense>} />
        <Route path="/history" element={<History />} />
        <Route path="/family" element={<Family />} />
        <Route path="/play/new" element={<NewGame />} />
        <Route path="/play/:id" element={<Scorecard />} />
      </Route>

      {/* Anything else */}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
