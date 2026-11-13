/**
 * Privacy screen (optional PIN)
 * =============================
 * IMPORTANT – what this is and is not:
 *
 *   ✔ It hides the app behind a PIN prompt, which stops someone who picks up
 *     your unlocked phone from casually opening your logs.
 *   ✘ It does NOT encrypt anything. The entries are still stored as ordinary
 *     data in the browser's database. Anyone with technical skill and access
 *     to the unlocked device (or a backup of it) could read them without the
 *     PIN. The real protection is the phone's own passcode / Face ID.
 *
 * The Settings page says exactly this, so the feature never suggests more
 * security than it gives.
 *
 * We never store the PIN itself – only a salted, deliberately slow hash
 * (PBKDF2). That avoids leaving the PIN readable in storage, but a short
 * numeric PIN can still be guessed by brute force by anyone holding the hash.
 */

const PBKDF2_ITERATIONS = 150_000;
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/** The hashing API only exists on HTTPS pages and localhost. */
export function isPrivacyLockSupported() {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle) && typeof crypto.getRandomValues === "function";
}

export function isValidPin(pin) {
  return typeof pin === "string" && new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
}

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

async function hashPin(pin, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, keyMaterial, 256);
  return toBase64(bits);
}

/** Creates the record that is saved in settings when a PIN is set. */
export async function createPinRecord(pin) {
  if (!isValidPin(pin)) throw new Error(`Use ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toBase64(salt),
    hash: await hashPin(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS,
  };
}

/** True when `pin` matches the saved record. */
export async function verifyPin(pin, record) {
  if (!record?.salt || !record?.hash || typeof pin !== "string") return false;
  const candidate = await hashPin(pin, fromBase64(record.salt), record.iterations ?? PBKDF2_ITERATIONS);
  return candidate === record.hash;
}
