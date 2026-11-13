/**
 * LockGate – shows the PIN screen in front of the app when a privacy PIN is
 * set. See src/services/privacyLock.js for what this does and does not protect.
 *
 * The app underneath stays mounted while locked (just hidden and made
 * non-interactive), so a half-written entry is still there after unlocking.
 */
import { useEffect, useId, useState } from "react";
import { LockKeyhole } from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { FieldError } from "../../components/ui/controls.jsx";
import { deleteAllData } from "../../db/maintenance.js";
import { useSettings } from "../../hooks/useAppData.js";
import { PIN_MAX_LENGTH, verifyPin } from "../../services/privacyLock.js";

const WRONG_PIN_DELAY_MS = 1000;

function LockScreen({ lockRecord, onUnlock }) {
  const inputId = useId();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!pin || isChecking) return;
    setIsChecking(true);
    try {
      if (await verifyPin(pin, lockRecord)) {
        onUnlock();
        return;
      }
      // A short pause after a wrong PIN slows down guessing a little.
      await new Promise((resolve) => setTimeout(resolve, WRONG_PIN_DELAY_MS));
      setError("That PIN is not correct.");
    } catch {
      setError("The PIN could not be checked on this device.");
    }
    setPin("");
    setIsChecking(false);
  }

  async function handleReset() {
    await deleteAllData();
    try {
      localStorage.removeItem("ett-theme");
    } catch {
      /* ignore */
    }
    onUnlock();
  }

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`}>
      <span className="empty-state__icon" aria-hidden="true">
        <LockKeyhole size={28} />
      </span>
      <div className="stack stack--xs">
        <h1 id={`${inputId}-title`}>Enter your PIN</h1>
        <p className="text-secondary">Your logs are behind a privacy screen.</p>
      </div>

      <form className="lock-screen__form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={inputId}>
          PIN
        </label>
        <input
          id={inputId}
          className="input pin-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={PIN_MAX_LENGTH}
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, ""));
            setError("");
          }}
          aria-invalid={Boolean(error)}
          autoFocus
        />
        <FieldError>{error}</FieldError>
        <button type="submit" className="btn btn--primary" disabled={!pin || isChecking}>
          {isChecking ? "Checking…" : "Unlock"}
        </button>
        <button type="button" className="link-btn text-small text-muted" onClick={() => setIsResetOpen(true)}>
          Forgot PIN?
        </button>
      </form>

      <ConfirmDialog
        isOpen={isResetOpen}
        title="Forgot your PIN?"
        tone="danger"
        confirmLabel="Erase all data"
        isConfirmDisabled={resetText.trim().toUpperCase() !== "DELETE"}
        onConfirm={handleReset}
        onCancel={() => setIsResetOpen(false)}
      >
        <p>
          The PIN can't be recovered or reset on its own. The only way back into the app is to erase everything it has
          stored on this device – all habits and logged urges – and start again.
        </p>
        <p>If you have a backup file, you can import it afterwards.</p>
        <div className="field">
          <label className="field__label" htmlFor={`${inputId}-reset`}>
            Type DELETE to erase everything
          </label>
          <input
            id={`${inputId}-reset`}
            className="input"
            value={resetText}
            onChange={(event) => setResetText(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default function LockGate({ children }) {
  const settings = useSettings();
  // Start locked. If it turns out no PIN is set, nothing is shown anyway.
  const [isLocked, setIsLocked] = useState(true);
  const lockRecord = settings?.privacyLock ?? null;

  // No PIN → treat the session as unlocked, so setting a PIN later in
  // Settings does not immediately lock the user out mid-task. (Updating state
  // while rendering like this is React's recommended way to adjust state when
  // an input changes; React re-renders straight away, before painting.)
  if (settings && !lockRecord && isLocked) setIsLocked(false);

  // Lock again whenever the app goes to the background.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsLocked(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Until settings load we don't know whether a PIN exists: show nothing.
  if (!settings) return null;

  const showLockScreen = Boolean(lockRecord) && isLocked;

  return (
    <>
      {/* `inert` makes the hidden app unreachable by keyboard and screen readers. */}
      <div inert={showLockScreen} style={showLockScreen ? { display: "none" } : undefined}>
        {children}
      </div>
      {showLockScreen ? <LockScreen lockRecord={lockRecord} onUnlock={() => setIsLocked(false)} /> : null}
    </>
  );
}
