import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import BottomNav from "./BottomNav.jsx";

/**
 * The frame shared by every page: a "skip to content" link for keyboard
 * users, the page itself, and the navigation bar.
 *
 * <Outlet /> is where React Router renders the page that matches the URL.
 * <Suspense> shows a placeholder while a lazily-loaded page is downloading.
 */
export default function AppShell() {
  const { pathname } = useLocation();

  // Start each page at the top instead of keeping the previous scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Suspense fallback={<div className="page" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
