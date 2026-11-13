import { NavLink } from "react-router";
import { History, LayoutDashboard, ListChecks, Plus, Settings } from "lucide-react";

/**
 * The navigation bar: fixed to the bottom on phones, a rail on the left on
 * wide screens (layout.css decides which).
 *
 * "Log urge" sits in the centre as a raised button because it is the app's
 * primary action and the centre is the easiest spot to reach with a thumb.
 *
 * <NavLink> is React Router's link component. It adds aria-current="page" to
 * the link for the page you are on, which the CSS uses to highlight it.
 */
const LEFT_ITEMS = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/history", label: "History", Icon: History },
];
const RIGHT_ITEMS = [
  { to: "/habits", label: "Habits", Icon: ListChecks },
  { to: "/settings", label: "Settings", Icon: Settings },
];

function NavItem({ to, label, Icon, end }) {
  return (
    <li className="bottom-nav__item">
      <NavLink to={to} end={end} className="bottom-nav__link">
        <Icon size={22} aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul className="bottom-nav__list">
        {LEFT_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <li className="bottom-nav__item bottom-nav__item--log">
          <NavLink to="/log" className="bottom-nav__log" aria-label="Log an urge">
            <span className="bottom-nav__log-circle">
              <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span aria-hidden="true">Log urge</span>
          </NavLink>
        </li>
        {RIGHT_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  );
}
