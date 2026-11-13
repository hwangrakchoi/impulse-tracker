/**
 * Error types thrown by the data layer.
 *
 * Using our own error classes lets the UI tell "the user typed something
 * invalid" (show a friendly message next to the field) apart from "the
 * database itself failed" (show a general error).
 */

/** The data given to a repository function was not acceptable. */
export class ValidationError extends Error {
  /**
   * @param {string} message      Human-readable summary.
   * @param {Record<string,string>} fieldErrors  e.g. { name: "Give the habit a name." }
   */
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** The record that was supposed to be changed does not exist (any more). */
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Turns any thrown value into a short message that is safe to show. */
export function describeError(error) {
  if (error instanceof ValidationError || error instanceof NotFoundError) return error.message;
  if (error?.name === "QuotaExceededError") {
    return "This device is out of storage space, so the change could not be saved.";
  }
  if (error?.name === "DatabaseClosedError" || error?.name === "OpenFailedError") {
    return "The local database is not available. Try closing other tabs of this app and reloading.";
  }
  return "Something went wrong while saving on this device. Please try again.";
}
