/**
 * Runs before every test file (configured in vite.config.js → test.setupFiles).
 *
 * Tests run in Node with "jsdom", a simulated browser. jsdom has no real
 * IndexedDB and lacks a few layout APIs, so we fill those gaps here.
 */
import "fake-indexeddb/auto"; // an in-memory IndexedDB – must be imported first
import "@testing-library/jest-dom/vitest"; // adds matchers like toBeInTheDocument()
import { beforeEach, vi } from "vitest";
import { db } from "../db/database.js";

// Start every test with a brand-new, empty database (plus the starter tags).
beforeEach(async () => {
  await db.delete();
  await db.open();
});

// --- Browser APIs that jsdom does not implement ---

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
