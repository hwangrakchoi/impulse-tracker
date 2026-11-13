/**
 * Privacy settings: the optional PIN "privacy screen" and "Delete all data".
 *
 * The wording here matters. A PIN in a web app is a screen in front of the
 * data, not encryption of it – and the page says so plainly.
 */
import { useId, useState } from "react";
import { Info, LockKeyhole, Trash2 } from "lucide-react";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { FieldError } from "../../components/ui/controls.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { describeError } from "../../db/errors.js";
import { deleteAllData } from "../../db/maintenance.js";
import { updateSettings } from "../../db/settingsRepository.js";
import {
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
  createPinRecord,
  isPrivacyLockSupported,
  isValidPin,
  verifyPin,
} from "../../services/privacyLock.js";

const DELETE_CONFIRMATION_WORD = "DELETE";

function PinInput({ id, label, value, onChange, autoFocus = false }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input pin-input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PIN_MAX_LENGTH}
        value={value}
        // Keep digits only.
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        data-autofocus={autoFocus ? true : undefined}
      />
    </div>
  );
}

export default function PrivacySection({ settings }) {
  const showToast = useToast();
  const id = useId();
  const hasPin = Boolean(settings.privacyLock);
  const isSupported = isPrivacyLockSupported();

  const [dialog, setDialog] = useState(null); // "set-pin" | "remove-pin" | "delete-all" | null
  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [error, setError] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  function openDialog(name) {
    setPin("");
    setPinRepeat("");
    setError("");
    setConfirmationText("");
    setDialog(name);
  }

  async function handleSetPin(event) {
    event.preventDefault();
    if (!isValidPin(pin)) return setError(`Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`);
    if (pin !== pinRepeat) return setError("The two PINs don't match.");
    setIsBusy(true);
    try {
      await updateSettings({ privacyLock: await createPinRecord(pin) });
      // This session stays unlocked; the PIN is asked for from the next launch.
      showToast("Privacy screen turned on.");
      setDialog(null);
    } catch (caught) {
      setError(describeError(caught));
    }
    setIsBusy(false);
  }

  async function handleRemovePin(event) {
    event.preventDefault();
    setIsBusy(true);
    try {
      if (!(await verifyPin(pin, settings.privacyLock))) {
        setError("That PIN is not correct.");
      } else {
        await updateSettings({ privacyLock: null });
        showToast("Privacy screen turned off.");
        setDialog(null);
      }
    } catch (caught) {
      setError(describeError(caught));
    }
    setIsBusy(false);
  }

  async function handleDeleteAll() {
    setIsBusy(true);
    try {
      await deleteAllData();
      try {
        localStorage.removeItem("ett-theme");
      } catch {
        /* ignore */
      }
      showToast("All data on this device was deleted.");
      setDialog(null);
    } catch (caught) {
      showToast(describeError(caught), { tone: "error" });
    }
    setIsBusy(false);
  }

  return (
    <div className="stack">
      <div className="notice">
        <Info size={18} aria-hidden="true" />
        <span>
          Nothing you log leaves this device. The app has no account, no server and no analytics, and it works with the
          network switched off.
        </span>
      </div>

      {/* ---------- Privacy screen ---------- */}
      <div className="stack stack--sm">
        <h3>Privacy screen (PIN)</h3>
        <p className="text-small text-secondary">
          Asks for a PIN whenever the app is opened or brought back to the front. It keeps your logs away from a casual
          glance by someone holding your unlocked phone.
        </p>
        <p className="text-small text-secondary">
          <strong>It is not encryption.</strong> Your entries stay stored as ordinary data in this browser, and someone
          with technical skill and access to the unlocked device could read them without the PIN. Your phone's own
          passcode or Face ID is the real protection. If you forget the PIN, the only way back in is to erase the app's
          data.
        </p>
        {!isSupported ? (
          <p className="notice notice--warning">
            The privacy screen needs a secure (https) connection, which this page doesn't have right now.
          </p>
        ) : hasPin ? (
          <button type="button" className="btn btn--secondary" onClick={() => openDialog("remove-pin")}>
            <LockKeyhole size={18} aria-hidden="true" />
            Turn off privacy screen
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={() => openDialog("set-pin")}>
            <LockKeyhole size={18} aria-hidden="true" />
            Set a PIN
          </button>
        )}
      </div>

      {/* ---------- Delete everything ---------- */}
      <div className="stack stack--sm">
        <h3>Delete all data</h3>
        <p className="text-small text-secondary">
          Permanently erases every habit, entry, custom tag, strategy and setting from this device, including the PIN.
          There is no copy anywhere else unless you exported a backup.
        </p>
        <button type="button" className="btn btn--danger-ghost" onClick={() => openDialog("delete-all")}>
          <Trash2 size={18} aria-hidden="true" />
          Delete all data…
        </button>
      </div>

      {/* ---------- Dialogs ---------- */}
      <Modal
        isOpen={dialog === "set-pin"}
        onClose={() => setDialog(null)}
        title="Set a PIN"
        footer={
          <>
            <button type="submit" form={`${id}-set`} className="btn btn--primary" disabled={isBusy}>
              Turn on privacy screen
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </>
        }
      >
        <form id={`${id}-set`} className="stack" onSubmit={handleSetPin}>
          <p className="text-small text-secondary">
            Choose {PIN_MIN_LENGTH}–{PIN_MAX_LENGTH} digits. There is no “forgot PIN” recovery, so pick something you
            will remember – and keep a backup export somewhere safe.
          </p>
          <PinInput id={`${id}-pin`} label="New PIN" value={pin} onChange={setPin} autoFocus />
          <PinInput id={`${id}-repeat`} label="Repeat PIN" value={pinRepeat} onChange={setPinRepeat} />
          <FieldError>{error}</FieldError>
        </form>
      </Modal>

      <Modal
        isOpen={dialog === "remove-pin"}
        onClose={() => setDialog(null)}
        title="Turn off privacy screen"
        footer={
          <>
            <button type="submit" form={`${id}-remove`} className="btn btn--primary" disabled={isBusy}>
              Turn off
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </>
        }
      >
        <form id={`${id}-remove`} className="stack" onSubmit={handleRemovePin}>
          <PinInput id={`${id}-current`} label="Current PIN" value={pin} onChange={setPin} autoFocus />
          <FieldError>{error}</FieldError>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={dialog === "delete-all"}
        title="Delete all data?"
        tone="danger"
        confirmLabel="Delete everything"
        isBusy={isBusy}
        isConfirmDisabled={confirmationText.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD}
        onConfirm={handleDeleteAll}
        onCancel={() => setDialog(null)}
      >
        <p>
          This permanently erases all habits, logged urges, tags, strategies and settings on this device. It can't be
          undone.
        </p>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-confirm`}>
            Type {DELETE_CONFIRMATION_WORD} to confirm
          </label>
          <input
            id={`${id}-confirm`}
            className="input"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
