/**
 * Modal – an accessible dialog. A bottom sheet on phones, a centered box on
 * wide screens (see .modal in components.css).
 *
 * Accessibility handled here:
 *   - role="dialog" + aria-modal + a title screen readers announce
 *   - focus moves into the dialog when it opens and returns when it closes
 *   - Tab cycles inside the dialog instead of escaping behind it
 *   - Escape and a tap on the dimmed backdrop close it
 */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ isOpen, onClose, title, children, footer, closeLabel = "Close" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  // Keep the latest onClose in a ref so the big effect below doesn't need to
  // re-run (and steal focus) every time the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const preferred = dialog.querySelector("[data-autofocus]") ?? dialog;
    preferred.focus();

    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // The function returned from an effect is its "cleanup": React runs it
    // when the dialog closes.
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // A "portal" renders the dialog at the end of <body>, outside the page
  // layout, so nothing can clip it or sit on top of it.
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={closeLabel}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
