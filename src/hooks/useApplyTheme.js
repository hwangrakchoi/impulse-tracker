import { useEffect } from "react";

const THEME_STORAGE_KEY = "ett-theme";
const BROWSER_BAR_COLORS = { light: "#f6f5f1", dark: "#121214" };

/**
 * Applies the chosen theme ("system" | "light" | "dark") to the page.
 *
 * `useEffect` runs its function AFTER React has updated the screen, and again
 * whenever `theme` changes – the right place for code that reaches outside
 * React, like setting an attribute on <html>.
 */
export function useApplyTheme(theme) {
  useEffect(() => {
    if (!theme) return; // settings still loading

    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }

    // Remember the choice where index.html can read it before React starts,
    // which avoids a flash of the wrong theme on launch.
    try {
      if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* localStorage unavailable – harmless */
    }

    // Tint the browser toolbar / status bar to match.
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      const fallback = meta.media.includes("dark") ? "dark" : "light";
      meta.content = BROWSER_BAR_COLORS[theme === "system" ? fallback : theme];
    }
  }, [theme]);
}
