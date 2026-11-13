/**
 * Test helper: renders a page the way the real app does – inside a router
 * and the toast provider – but starting at a URL of our choosing.
 */
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { ToastProvider } from "../components/ui/Toast.jsx";

/** Shows the current URL so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/**
 * @param {Array<{ path: string, element: JSX.Element }>} routes
 * @param {string} startAt  the URL to open first, e.g. "/log"
 */
export function renderRoutes(routes, startAt = "/") {
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={[startAt]}>
      <ToastProvider>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<div>Other page</div>} />
        </Routes>
        <LocationProbe />
      </ToastProvider>
    </MemoryRouter>,
  );
  return { user, ...view };
}
