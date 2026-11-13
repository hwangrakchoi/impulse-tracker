/**
 * App – the root component: decides which page to show for each URL.
 *
 * React Router reads the browser's address bar and renders the matching
 * <Route>. Every page sits inside <AppShell>, which draws the navigation bar.
 *
 * Pages other than Log are loaded "lazily": their code is downloaded only
 * when first opened. The Dashboard pulls in the charting library, so keeping
 * it out of the first download makes the Log screen open faster. (Once the
 * app is installed everything is cached for offline use anyway.)
 */
import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import AppShell from "./components/layout/AppShell.jsx";
import UpdatePrompt from "./components/pwa/UpdatePrompt.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import LockGate from "./features/lock/LockGate.jsx";
import { useSettings } from "./hooks/useAppData.js";
import { useApplyTheme } from "./hooks/useApplyTheme.js";
import LogUrgePage from "./pages/LogUrgePage.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.jsx"));
const HabitsPage = lazy(() => import("./pages/HabitsPage.jsx"));
const HabitDetailPage = lazy(() => import("./pages/HabitDetailPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));

export default function App() {
  const settings = useSettings();
  useApplyTheme(settings?.theme);

  return (
    <BrowserRouter>
      <ToastProvider>
        <LockGate>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="log" element={<LogUrgePage />} />
              <Route path="log/:entryId" element={<LogUrgePage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="habits" element={<HabitsPage />} />
              <Route path="habits/:habitId" element={<HabitDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* Unknown address → back to the dashboard. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </LockGate>
        <UpdatePrompt />
      </ToastProvider>
    </BrowserRouter>
  );
}
