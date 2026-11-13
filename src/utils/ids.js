/**
 * Creates a random, practically-unique ID (a "UUID") for a new record.
 *
 * Random IDs – rather than 1, 2, 3… – mean two devices could create records
 * independently and later be merged without their IDs clashing. That keeps
 * the door open for cloud sync in a future version.
 */
export function createId() {
  // Available in all modern browsers on HTTPS and localhost.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback (e.g. the dev server opened over plain http on a phone).
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  // Mark the value as a "version 4" UUID, as the standard requires.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
