import Modal from "./Modal.jsx";

/**
 * A yes/no question shown before anything destructive happens.
 *
 * Props:
 *   tone             "danger" paints the confirm button red
 *   isConfirmDisabled  keeps the confirm button off until a condition is met
 *                    (e.g. the user typed a confirmation word)
 *   secondaryAction  optional { label, onClick } – a safer alternative offered
 *                    alongside (e.g. "Archive instead")
 */
export default function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  isBusy = false,
  isConfirmDisabled = false,
  secondaryAction,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      closeLabel={cancelLabel}
      footer={
        <>
          {secondaryAction ? (
            // When a safer option exists it is the prominent, pre-focused button.
            <button type="button" className="btn btn--primary" onClick={secondaryAction.onClick} disabled={isBusy} data-autofocus>
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${tone === "danger" ? (secondaryAction ? "btn--danger-ghost" : "btn--danger") : "btn--primary"}`}
            onClick={onConfirm}
            disabled={isBusy || isConfirmDisabled}
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={isBusy} data-autofocus={secondaryAction ? undefined : true}>
            {cancelLabel}
          </button>
        </>
      }
    >
      <div className="stack stack--md text-secondary">{children}</div>
    </Modal>
  );
}
