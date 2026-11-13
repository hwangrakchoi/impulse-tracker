/**
 * Toasts – the small confirmation messages ("Urge logged").
 *
 * This file uses React "context": <ToastProvider> wraps the whole app once,
 * and any component inside it can call `const showToast = useToast()` without
 * props being passed down through every level.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

const ToastContext = createContext(() => {});

const TOAST_DURATION_MS = 3200;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const showToast = useCallback((message, { tone = "success" } = {}) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = useMemo(() => showToast, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* role="status" + aria-live makes screen readers announce new toasts. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === "error" ? "toast--error" : ""}`}>
            {toast.tone === "error" ? <CircleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns `showToast(message, { tone: "success" | "error" })`. */
// eslint-disable-next-line react/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
