import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HabitsPage from "./HabitsPage.jsx";
import { createEntry, listEntries } from "../db/entriesRepository.js";
import { createHabit, listHabits } from "../db/habitsRepository.js";
import { at } from "../test/factories.js";
import { renderRoutes } from "../test/render.jsx";

const routes = [{ path: "/habits", element: <HabitsPage /> }];

describe("Habits page", () => {
  it("shows an empty state, then creates a habit through the form", async () => {
    const { user } = renderRoutes(routes, "/habits");

    expect(await screen.findByRole("heading", { name: "No habits yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add your first habit" }));

    const dialog = await screen.findByRole("dialog", { name: "New habit" });
    await user.type(within(dialog).getByLabelText("Name"), "Alcohol");
    await user.type(within(dialog).getByLabelText(/Description/), "Mostly evenings");
    await user.click(within(dialog).getByRole("radio", { name: "Wine glass" }));
    await user.click(within(dialog).getByRole("radio", { name: "Plum" }));
    await user.click(within(dialog).getByRole("button", { name: "Add habit" }));

    expect(await screen.findByRole("link", { name: "Alcohol: view details" })).toBeInTheDocument();
    expect(screen.getByText("Mostly evenings")).toBeInTheDocument();
    const [habit] = await listHabits();
    expect(habit).toMatchObject({ name: "Alcohol", icon: "wine", accentColor: "#a8559f", isArchived: false });
  });

  it("shows the validation message for a duplicate name", async () => {
    await createHabit({ name: "Vaping" });
    const { user } = renderRoutes(routes, "/habits");

    await user.click(await screen.findByRole("button", { name: "New habit" }));
    const dialog = await screen.findByRole("dialog", { name: "New habit" });
    await user.type(within(dialog).getByLabelText("Name"), "vaping");
    await user.click(within(dialog).getByRole("button", { name: "Add habit" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent('You already have a habit called "Vaping".');
    expect(await listHabits()).toHaveLength(1);
  });

  it("edits a habit", async () => {
    await createHabit({ name: "Alcohol" });
    const { user } = renderRoutes(routes, "/habits");

    await user.click(await screen.findByRole("button", { name: "Actions for Alcohol" }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit habit" });
    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Drinking");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("link", { name: "Drinking: view details" })).toBeInTheDocument();
  });

  it("archives a habit (keeping its entries) and reactivates it", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    const { user } = renderRoutes(routes, "/habits");

    await user.click(await screen.findByRole("button", { name: "Actions for Alcohol" }));
    await user.click(await screen.findByRole("button", { name: "Archive (keeps history)" }));

    const archivedSection = await screen.findByRole("region", { name: "Archived" });
    expect(within(archivedSection).getByText("Alcohol")).toBeInTheDocument();
    expect(await listEntries()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Actions for Alcohol" }));
    await user.click(await screen.findByRole("button", { name: "Reactivate" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Archived" })).not.toBeInTheDocument());
    expect((await listHabits())[0].isArchived).toBe(false);
  });

  it("explains the consequences of deleting and offers archiving first", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 12) });
    await createEntry({ habitId: habit.id, emotionIds: ["fear.anxious"], timestamp: at(2026, 10, 13) });
    const { user } = renderRoutes(routes, "/habits");

    await user.click(await screen.findByRole("button", { name: "Actions for Alcohol" }));
    await user.click(await screen.findByRole("button", { name: "Delete…" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete “Alcohol”?" });
    expect(dialog).toHaveTextContent("2 logged urges");
    expect(dialog).toHaveTextContent("can't be undone");
    // Archiving is the highlighted, pre-focused choice.
    expect(within(dialog).getByRole("button", { name: "Archive instead" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Archive instead" }));
    await waitFor(async () => expect((await listHabits())[0].isArchived).toBe(true));
    expect(await listEntries()).toHaveLength(2);
  });

  it("deletes a habit and its entries after confirmation", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    const { user } = renderRoutes(routes, "/habits");

    await user.click(await screen.findByRole("button", { name: "Actions for Alcohol" }));
    await user.click(await screen.findByRole("button", { name: "Delete…" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete “Alcohol”?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete habit and 1 entry" }));

    expect(await screen.findByRole("heading", { name: "No habits yet" })).toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0);
    expect(await listEntries()).toHaveLength(0);
  });
});
