import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LogUrgePage from "./LogUrgePage.jsx";
import { createEntry, listEntries } from "../db/entriesRepository.js";
import { createHabit, setHabitArchived } from "../db/habitsRepository.js";
import { updateSettings } from "../db/settingsRepository.js";
import { at } from "../test/factories.js";
import { renderRoutes } from "../test/render.jsx";

const routes = [
  { path: "/log", element: <LogUrgePage /> },
  { path: "/log/:entryId", element: <LogUrgePage /> },
  { path: "/history", element: <div>History page</div> },
];

describe("logging an urge", () => {
  it("asks for a habit first when none exist", async () => {
    renderRoutes(routes, "/log");
    expect(await screen.findByRole("heading", { name: "Add a habit first" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Habits" })).toHaveAttribute("href", "/habits");
  });

  it("saves Alcohol with Lonely, Empty and Awful and the current time", async () => {
    const alcohol = await createHabit({ name: "Alcohol" });
    await createHabit({ name: "Vaping" });
    const { user } = renderRoutes(routes, "/log");

    await user.click(await screen.findByRole("radio", { name: "Alcohol" }));

    await user.click(screen.getByRole("button", { name: "Sad" }));
    await user.click(screen.getByRole("button", { name: "Lonely" }));
    await user.click(screen.getByRole("button", { name: "More specific than Depressed" }));
    await user.click(screen.getByRole("button", { name: "Empty" }));
    await user.click(screen.getByRole("button", { name: "Disgust" }));
    await user.click(screen.getByRole("button", { name: "Awful" }));

    const before = Date.now();
    await user.click(screen.getByRole("button", { name: "Save entry" }));

    // A quiet confirmation, then the optional reflection prompt.
    expect(await screen.findByText("Urge logged.")).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: "Saved. A moment to reflect?" });

    const [entry] = await listEntries();
    expect(entry.habitId).toBe(alcohol.id);
    expect(entry.emotionIds).toEqual(["sad.lonely", "sad.depressed.empty", "disgust.awful"]);
    expect(Date.parse(entry.timestamp)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(entry.timestamp)).toBeLessThanOrEqual(Date.now());
    expect(entry).toMatchObject({ intensity: null, outcome: null });

    // The prompt is skippable, and skipping leads to History.
    await user.click(within(dialog).getByRole("button", { name: "Skip" }));
    expect(await screen.findByText("History page")).toBeInTheDocument();
    expect(await listEntries()).toHaveLength(1);
  });

  it("explains what is missing instead of saving an incomplete entry", async () => {
    await createHabit({ name: "Alcohol" });
    await createHabit({ name: "Vaping" });
    const { user } = renderRoutes(routes, "/log");

    await user.click(await screen.findByRole("button", { name: "Save entry" }));

    expect(await screen.findByText("Choose which habit this urge was about.")).toBeInTheDocument();
    expect(screen.getByText("Choose at least one emotion.")).toBeInTheDocument();
    expect(await listEntries()).toHaveLength(0);

    // Fixing a field clears its message.
    await user.click(screen.getByRole("radio", { name: "Vaping" }));
    expect(screen.queryByText("Choose which habit this urge was about.")).not.toBeInTheDocument();
  });

  it("pre-selects the only habit and saves optional details", async () => {
    await createHabit({ name: "Vaping" });
    await updateSettings({ reflectionPromptsEnabled: false });
    const { user } = renderRoutes(routes, "/log");

    expect(await screen.findByRole("radio", { name: "Vaping" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Fear" }));
    await user.click(screen.getByRole("button", { name: "Anxious" }));

    await user.click(screen.getByRole("button", { name: /Add details/ }));
    await user.click(screen.getByRole("radio", { name: "8" }));
    await user.type(screen.getByLabelText("What was happening?"), "Can't fall asleep");
    await user.click(screen.getByRole("checkbox", { name: "Before bed" }));
    await user.click(screen.getByRole("radio", { name: /Engaged/ }));
    await user.click(screen.getByRole("checkbox", { name: "Breathing exercise" }));

    // Add a custom coping strategy on the fly.
    await user.click(screen.getByRole("button", { name: "Custom strategy" }));
    await user.type(screen.getByRole("textbox", { name: "Custom strategy" }), "Cold shower{Enter}");
    expect(await screen.findByRole("checkbox", { name: "Cold shower" })).toBeChecked();

    await user.type(screen.getByLabelText("Notes"), "Third night in a row");
    await user.click(screen.getByRole("button", { name: "Save entry" }));

    // With prompts turned off we go straight to History.
    expect(await screen.findByText("History page")).toBeInTheDocument();
    const [entry] = await listEntries();
    expect(entry).toMatchObject({
      emotionIds: ["fear.anxious"],
      intensity: 8,
      situationalNotes: "Can't fall asleep",
      contextTagIds: ["tag-before-bed"],
      outcome: "engaged",
      notes: "Third night in a row",
    });
    expect(entry.copingStrategyIds).toHaveLength(2);
    expect(entry.copingStrategyIds).toContain("strategy-breathing-exercise");
    // No message scolds the user for the "engaged" outcome.
    expect(screen.queryByText(/fail|relapse|should/i)).not.toBeInTheDocument();
  });

  it("lets the timestamp be changed to log an earlier urge", async () => {
    await createHabit({ name: "Alcohol" });
    await updateSettings({ reflectionPromptsEnabled: false });
    const { user } = renderRoutes(routes, "/log");

    await user.click(await screen.findByRole("button", { name: "Sad" }));
    await user.click(screen.getByRole("button", { name: "Bored" }));
    await user.click(screen.getByRole("button", { name: "Change" }));
    const input = screen.getByLabelText("Date and time of the urge");
    await user.clear(input);
    await user.type(input, "2026-10-13T17:45");
    await user.click(screen.getByRole("button", { name: "Save entry" }));

    await screen.findByText("History page");
    const [entry] = await listEntries();
    expect(entry.timestamp).toBe(at(2026, 10, 13, 17, 45));
  });

  it("offers only active habits", async () => {
    await createHabit({ name: "Alcohol" });
    const archived = await createHabit({ name: "Gambling" });
    await setHabitArchived(archived.id, true);
    renderRoutes(routes, "/log");

    expect(await screen.findByRole("radio", { name: "Alcohol" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Gambling/ })).not.toBeInTheDocument();
  });
});

describe("editing an entry", () => {
  it("loads the saved values, saves changes and keeps the original time", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    const original = await createEntry({
      habitId: habit.id,
      emotionIds: ["sad.lonely"],
      timestamp: at(2026, 10, 13, 17, 45),
      intensity: 8,
    });
    const { user } = renderRoutes(routes, `/log/${original.id}`);

    expect(await screen.findByRole("heading", { name: "Edit entry" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Alcohol" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "8" })).toBeChecked();
    expect(screen.getByLabelText("Date and time of the urge")).toHaveValue("2026-10-13T17:45");

    // Swap Lonely for Anxious and lower the intensity.
    await user.click(screen.getByRole("button", { name: "Remove Lonely" }));
    await user.click(screen.getByRole("button", { name: "Fear" }));
    await user.click(screen.getByRole("button", { name: "Anxious" }));
    await user.click(screen.getByRole("radio", { name: "6" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("History page")).toBeInTheDocument();
    const [entry] = await listEntries();
    expect(entry).toMatchObject({
      id: original.id,
      emotionIds: ["fear.anxious"],
      intensity: 6,
      timestamp: original.timestamp,
      createdAt: original.createdAt,
    });
    await waitFor(() => expect(screen.getByText("Entry updated.")).toBeInTheDocument());
  });

  it("shows a clear message for an entry that no longer exists", async () => {
    await createHabit({ name: "Alcohol" });
    renderRoutes(routes, "/log/does-not-exist");
    expect(await screen.findByRole("heading", { name: "Entry not found" })).toBeInTheDocument();
  });
});
