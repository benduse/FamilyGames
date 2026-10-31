import { NavLink } from 'react-router-dom';
import { Home, Dices, Users, ChartColumn } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/games', label: 'Games', Icon: Dices },
  { to: '/players', label: 'Players', Icon: Users },
  { to: '/stats', label: 'Stats', Icon: ChartColumn },
];

// Bottom tab bar on phones (moves into the header on wider screens, see styles.css)
export default function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon size={22} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
