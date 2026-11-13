/**
 * Saving a file to the device and reading a file the user picked.
 * Both happen entirely in the browser – nothing is uploaded.
 */

/**
 * Offers `text` to the user as a file.
 *
 * On iPhone/iPad the share sheet ("Save to Files", AirDrop, …) is the
 * reliable way to get a file out of an installed web app, so it is used when
 * available. Everywhere else an ordinary download is triggered.
 *
 * @returns {Promise<"shared"|"downloaded"|"cancelled">}
 */
export async function saveTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });

  const isTouchDevice = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (isTouchDevice && typeof File === "function" && navigator.canShare) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      } catch (error) {
        // AbortError = the user closed the share sheet. Anything else: fall
        // through and try a normal download instead.
        if (error?.name === "AbortError") return "cancelled";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

/** Reads a user-selected File as text, refusing absurdly large files. */
export async function readTextFile(file) {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("That file is larger than 25 MB, which is far bigger than any backup from this app.");
  }
  return file.text();
}
