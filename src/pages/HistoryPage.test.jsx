import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HistoryPage from "./HistoryPage.jsx";
import { createEntry, getEntry, listEntries } from "../db/entriesRepository.js";
import { createHabit } from "../db/habitsRepository.js";
import { at } from "../test/factories.js";
import { renderRoutes } from "../test/render.jsx";

const routes = [{ path: "/history", element: <HistoryPage /> }];

/** The two example entries from the project brief, plus one for Vaping. */
async function seed() {
  const alcohol = await createHabit({ name: "Alcohol" });
  const vaping = await createHabit({ name: "Vaping" });
  const first = await createEntry({
    habitId: alcohol.id,
    emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.disappointed"],
    timestamp: at(2026, 10, 13, 17, 45),
    intensity: 8,
    contextTagIds: ["tag-alone"],
    notes: "Quiet Friday evening",
  });
  const second = await createEntry({
    habitId: alcohol.id,
    emotionIds: ["fear.anxious", "fear.rejected", "disgust.awful"],
    timestamp: at(2026, 10, 14, 20, 20),
    intensity: 6,
    outcome: "ongoing",
  });
  const third = await createEntry({ habitId: vaping.id, emotionIds: ["anger.frustrated"], timestamp: at(2026, 10, 12, 9, 0) });
  return { alcohol, vaping, first, second, third };
}

const cards = () => screen.getAllByRole("listitem").filter((item) => item.classList.contains("entry-card"));

describe("History page", () => {
  it("shows an empty state before anything is logged", async () => {
    renderRoutes(routes, "/history");
    expect(await screen.findByRole("heading", { name: "Nothing logged yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log an urge" })).toHaveAttribute("href", "/log");
  });

  it("lists entries newest first with habit, emotions by category, intensity, outcome and tags", async () => {
    await seed();
    renderRoutes(routes, "/history");

    await screen.findByText("3 entries");
    const [newest, middle, oldest] = cards();

    expect(within(newest).getByText("Alcohol")).toBeInTheDocument();
    expect(newest).toHaveTextContent("6/10");
    expect(newest).toHaveTextContent("Still ongoing");
    // Emotions are grouped under their named category, in the category color.
    const fearGroup = within(newest).getByRole("list", { name: "Fear emotions" });
    expect(within(fearGroup).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Anxious", "Rejected"]);
    expect(within(newest).getByRole("list", { name: "Disgust emotions" })).toHaveTextContent("Awful");
    expect(fearGroup.closest(".emotion-group").style.getPropertyValue("--emotion-color")).toBe("var(--emotion-fear)");

    expect(within(middle).getByRole("list", { name: "Sad emotions" })).toHaveTextContent("LonelyEmpty");
    expect(within(middle).getByRole("list", { name: "Disgust emotions" })).toHaveTextContent("Disappointed");
    expect(middle).toHaveTextContent("8/10");
    expect(middle).toHaveTextContent("Alone");

    expect(within(oldest).getByText("Vaping")).toBeInTheDocument();
    expect(within(oldest).getByRole("list", { name: "Anger emotions" })).toHaveTextContent("Frustrated");
  });

  it("filters by habit", async () => {
    const { alcohol } = await seed();
    const { user } = renderRoutes(routes, "/history");

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog", { name: "Filter history" });
    await user.selectOptions(within(sheet).getByLabelText("Habit"), alcohol.id);
    await user.click(within(sheet).getByRole("button", { name: "Show 2 entries" }));

    expect(await screen.findByText("2 entries of 3 match")).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
    expect(screen.queryByText("Vaping")).not.toBeInTheDocument();

    // The active filter is shown as a chip that removes it.
    await user.click(screen.getByRole("button", { name: "Remove filter: Alcohol" }));
    expect(await screen.findByText("3 entries")).toBeInTheDocument();
  });

  it("opens pre-filtered from a link like /history?habit=…", async () => {
    const { vaping } = await seed();
    renderRoutes(routes, `/history?habit=${vaping.id}`);
    expect(await screen.findByText("1 entry of 3 match")).toBeInTheDocument();
  });

  it("filters by category, emotion, intensity and outcome together with search", async () => {
    await seed();
    const { user } = renderRoutes(routes, "/history");

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog", { name: "Filter history" });

    await user.selectOptions(within(sheet).getByLabelText("Emotion category"), "disgust");
    expect(within(sheet).getByRole("button", { name: "Show 2 entries" })).toBeInTheDocument();

    await user.selectOptions(within(sheet).getByLabelText("Specific emotion"), "disgust.awful");
    expect(within(sheet).getByRole("button", { name: "Show 1 entry" })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Clear all filters" }));
    await user.selectOptions(within(sheet).getByLabelText("At least"), "7");
    expect(within(sheet).getByRole("button", { name: "Show 1 entry" })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: "Clear all filters" }));
    await user.selectOptions(within(sheet).getByLabelText("Outcome"), "none");
    await user.click(within(sheet).getByRole("button", { name: "Show 2 entries" }));

    await user.type(screen.getByRole("searchbox", { name: "Search history" }), "friday");
    expect(await screen.findByText("1 entry of 3 match")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search history" }));
    await user.type(screen.getByRole("searchbox", { name: "Search history" }), "nothing matches this");
    expect(await screen.findByRole("heading", { name: "No entries match" })).toBeInTheDocument();
  });

  it("sorts oldest first on request", async () => {
    await seed();
    const { user } = renderRoutes(routes, "/history");

    await user.click(await screen.findByRole("button", { name: /Sorted newest first/ }));
    expect(within(cards()[0]).getByText("Vaping")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sorted oldest first/ })).toHaveTextContent("Oldest first");
  });

  it("expands a card to show details and links to the edit screen", async () => {
    const { first } = await seed();
    const { user } = renderRoutes(routes, "/history");

    await screen.findByText("3 entries");
    const card = cards()[1];
    expect(within(card).queryByText("Quiet Friday evening")).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Details" }));
    expect(within(card).getByText("Quiet Friday evening")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Edit" })).toHaveAttribute("href", `/log/${first.id}`);
  });

  it("deletes an entry only after confirmation", async () => {
    const { third } = await seed();
    const { user } = renderRoutes(routes, "/history");

    await screen.findByText("3 entries");
    const card = cards()[2];
    await user.click(within(card).getByRole("button", { name: "Details" }));
    await user.click(within(card).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete this entry?" });
    expect(await getEntry(third.id)).toBeDefined(); // nothing deleted yet
    await user.click(within(dialog).getByRole("button", { name: "Delete entry" }));

    expect(await screen.findByText("2 entries")).toBeInTheDocument();
    expect(await getEntry(third.id)).toBeUndefined();
  });

  it("follows up an ongoing urge while preserving the original time", async () => {
    const { second } = await seed();
    const { user } = renderRoutes(routes, "/history");

    await screen.findByText("3 entries");
    await user.click(within(cards()[0]).getByRole("button", { name: "It passed" }));

    await waitFor(async () => expect((await getEntry(second.id)).outcome).toBe("passed"));
    const updated = await getEntry(second.id);
    expect(updated.timestamp).toBe(second.timestamp);
    expect(updated.outcomeUpdatedAt >= second.outcomeUpdatedAt).toBe(true);
    await waitFor(() => expect(screen.queryByRole("button", { name: "It passed" })).not.toBeInTheDocument());
    expect(await listEntries()).toHaveLength(3);
  });
});
