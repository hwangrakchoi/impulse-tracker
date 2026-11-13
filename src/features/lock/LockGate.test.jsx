import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import LockGate from "./LockGate.jsx";
import { updateSettings } from "../../db/settingsRepository.js";
import { createPinRecord, isValidPin, verifyPin } from "../../services/privacyLock.js";

describe("PIN hashing", () => {
  it("accepts only 4–8 digit PINs", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("123456789")).toBe(false);
  });

  it("stores a salted hash, never the PIN itself", async () => {
    const record = await createPinRecord("2468");
    expect(JSON.stringify(record)).not.toContain("2468");
    expect(await verifyPin("2468", record)).toBe(true);
    expect(await verifyPin("1357", record)).toBe(false);
    // Same PIN, different salt → different hash.
    expect((await createPinRecord("2468")).hash).not.toBe(record.hash);
  });
});

describe("LockGate", () => {
  it("shows the app straight away when no PIN is set", async () => {
    render(<LockGate>Secret logs</LockGate>);
    expect(await screen.findByText("Secret logs")).toBeVisible();
  });

  it("hides the app until the correct PIN is entered", async () => {
    await updateSettings({ privacyLock: await createPinRecord("2468") });
    const user = userEvent.setup();
    render(<LockGate>Secret logs</LockGate>);

    expect(await screen.findByRole("heading", { name: "Enter your PIN" })).toBeInTheDocument();
    expect(screen.getByText("Secret logs")).not.toBeVisible();

    await user.type(screen.getByLabelText("PIN"), "1111");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("That PIN is not correct.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("Secret logs")).not.toBeVisible();

    await user.type(screen.getByLabelText("PIN"), "2468");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.getByText("Secret logs")).toBeVisible());
  });
});
