import { useEffect, useMemo, useState } from "react";
import { parseLocalDate, toLocalDateKey } from "../utils/dates.js";

const CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Today's date (local midnight) that UPDATES when the calendar day changes.
 *
 * Why not just call `new Date()` while rendering? An app installed on the
 * Home Screen can stay open for days. "Last 7 days" or "today" computed once
 * would silently go stale after midnight. This hook re-checks every minute and
 * whenever the app returns to the foreground, and only triggers a re-render
 * when the day has actually changed.
 */
export function useToday() {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    // Setting state to the same string is ignored by React, so this costs
    // nothing until the date really changes.
    const refresh = () => setDateKey(toLocalDateKey(new Date()));
    const timer = setInterval(refresh, CHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return useMemo(() => parseLocalDate(dateKey), [dateKey]);
}
