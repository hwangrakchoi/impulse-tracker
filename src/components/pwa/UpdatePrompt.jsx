/**
 * Handles the service worker – the background script that makes the app work
 * offline – and tells the user when a new version of the app is available.
 *
 * How updates work:
 *   1. You deploy a new build.
 *   2. The next time the app is opened (or brought to the front) with a
 *      connection, the browser downloads the new files in the background.
 *   3. This component then shows "A new version is ready" with an Update
 *      button. Nothing reloads on its own, so a half-written entry is safe.
 *
 * Updating replaces the app's CODE only. Your data lives in IndexedDB, which
 * app updates never touch.
 *
 * "virtual:pwa-register/react" is not a real file: vite-plugin-pwa generates
 * it at build time.
 */
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { useToast } from "../ui/Toast.jsx";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly while the app stays open

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_scriptUrl, registration) {
      if (!registration) return;
      // Installed iPhone apps can stay open for days, so look for updates
      // periodically and whenever the app returns to the foreground.
      const checkForUpdate = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
      });
    },
  });

  const showToast = useToast();

  // First install: a brief, unobtrusive note at the bottom of the screen.
  useEffect(() => {
    if (!offlineReady) return;
    showToast("Ready to use without an internet connection.");
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, showToast]);

  if (needRefresh) {
    return (
      <div className="banner" role="alert">
        <RefreshCw size={20} aria-hidden="true" />
        <span className="grow">
          <strong>A new version is ready.</strong> Your data stays on this device.
        </span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => updateServiceWorker(true)}>
          Update
        </button>
        <button type="button" className="icon-btn" aria-label="Update later" onClick={() => setNeedRefresh(false)}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
}
