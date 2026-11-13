import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingsPage from "./SettingsPage.jsx";
import { createEntry, listEntries } from "../db/entriesRepository.js";
import { createHabit } from "../db/habitsRepository.js";
import { deleteAllData } from "../db/maintenance.js";
import { getSettings } from "../db/settingsRepository.js";
import { buildBackup, serializeBackup } from "../services/backup.js";
import { at } from "../test/factories.js";
import { renderRoutes } from "../test/render.jsx";

const routes = [{ path: "/settings", element: <SettingsPage /> }];

const jsonFile = (text, name = "backup.json") => new File([text], name, { type: "application/json" });

describe("Settings page", () => {
  it("changes the theme", async () => {
    const { user } = renderRoutes(routes, "/settings");
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    await waitFor(async () => expect((await getSettings()).theme).toBe("dark"));
  });

  it("explains that the PIN is not encryption", async () => {
    renderRoutes(routes, "/settings");
    const privacy = await screen.findByRole("region", { name: "Privacy" });
    expect(privacy).toHaveTextContent("It is not encryption.");
  });

  it("previews an import, then restores the backup", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13, 17, 45) });
    const backupText = serializeBackup(await buildBackup());
    await deleteAllData();

    const { user } = renderRoutes(routes, "/settings");
    await user.upload(await screen.findByLabelText("Choose a backup file to import"), jsonFile(backupText));

    const dialog = await screen.findByRole("dialog", { name: "Review import" });
    const stats = within(dialog).getByRole("list", { name: "What will change" });
    expect(stats).toHaveTextContent("1 habit in file");
    expect(stats).toHaveTextContent("1 entry in file");
    expect(await listEntries()).toHaveLength(0); // the preview changes nothing

    await user.click(within(dialog).getByRole("button", { name: "Import" }));
    await waitFor(async () => expect(await listEntries()).toHaveLength(1));
  });

  it("rejects an invalid file without changing anything", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    const { user } = renderRoutes(routes, "/settings");

    await user.upload(await screen.findByLabelText("Choose a backup file to import"), jsonFile('{"app":"something-else"}'));

    const dialog = await screen.findByRole("dialog", { name: "This file can't be imported" });
    expect(dialog).toHaveTextContent("doesn't look like a backup file");
    expect(dialog).toHaveTextContent("nothing on this device was changed");
    expect(await listEntries()).toHaveLength(1);
  });

  it("requires typing DELETE before erasing everything", async () => {
    const habit = await createHabit({ name: "Alcohol" });
    await createEntry({ habitId: habit.id, emotionIds: ["sad.lonely"], timestamp: at(2026, 10, 13) });
    const { user } = renderRoutes(routes, "/settings");

    await user.click(await screen.findByRole("button", { name: "Delete all data…" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete all data?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete everything" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Type DELETE to confirm"), "delete");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(async () => expect(await listEntries()).toHaveLength(0));
  });
});
