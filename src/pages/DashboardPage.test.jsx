import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "./DashboardPage.jsx";
import { createEntry } from "../db/entriesRepository.js";
import { createHabit, listHabits } from "../db/habitsRepository.js";
import { getSettings, updateSettings } from "../db/settingsRepository.js";
import { renderRoutes } from "../test/render.jsx";

const routes = [{ path: "/", element: <DashboardPage /> }];

/** A timestamp `hoursAgo` hours before now (always inside "30 days"). */
const hoursAgo = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

describe("Dashboard – first run", () => {
  it("shows onboarding with optional example habits, and creates only what is picked", async () => {
    const { user } = renderRoutes(routes, "/");

    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText(/Not a medical tool/)).toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0); // nothing is created up front

    await user.click(screen.getByRole("checkbox", { name: "Alcohol" }));
    await user.click(screen.getByRole("checkbox", { name: "Vaping" }));
    await user.type(screen.getByLabelText(/Something else/), "Doomscrolling");
    await user.click(screen.getByRole("button", { name: "Add 3 habits and continue" }));

    await waitFor(async () => expect((await listHabits()).map((habit) => habit.name)).toEqual(["Alcohol", "Vaping", "Doomscrolling"]));
    expect((await getSettings()).onboardingComplete).toBe(true);
    expect(await screen.findByRole("heading", { name: "Your patterns will appear here" })).toBeInTheDocument();
  });

  it("can be skipped without creating any habit", async () => {
    const { user } = renderRoutes(routes, "/");
    await user.click(await screen.findByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("heading", { name: "Start with a habit" })).toBeInTheDocument();
    expect(await listHabits()).toHaveLength(0);
  });
});

describe("Dashboard – analytics", () => {
  async function seed() {
    await updateSettings({ onboardingComplete: true });
    const alcohol = await createHabit({ name: "Alcohol" });
    const vaping = await createHabit({ name: "Vaping" });
    // Two Sad emotions in one urge must count Sad only once for that urge.
    await createEntry({ habitId: alcohol.id, emotionIds: ["sad.lonely", "sad.depressed.empty", "disgust.awful"], timestamp: hoursAgo(5), intensity: 8 });
    await createEntry({ habitId: alcohol.id, emotionIds: ["sad.lonely", "fear.anxious"], timestamp: hoursAgo(30), intensity: 6 });
    await createEntry({ habitId: vaping.id, emotionIds: ["fear.anxious"], timestamp: hoursAgo(50) });
    return { alcohol, vaping };
  }

  it("shows urge events, emotion selections and average intensity as separate numbers", async () => {
    await seed();
    renderRoutes(routes, "/");

    const urges = await screen.findByText("Urges logged");
    expect(urges.parentElement).toHaveTextContent("3");
    expect(screen.getByText("Emotions selected").parentElement).toHaveTextContent("6");
    expect(screen.getByText("Average intensity").parentElement).toHaveTextContent("7.0/10");
    expect(screen.getByText("From 2 urges with intensity")).toBeInTheDocument();
  });

  it("counts categories once per urge and explains why shares can exceed 100%", async () => {
    await seed();
    renderRoutes(routes, "/");

    const card = await screen.findByRole("region", { name: "Emotion categories" });
    const rows = within(card).getAllByRole("listitem").map((item) => item.textContent);
    expect(rows).toContain("Sad2 · 67%");
    expect(rows).toContain("Fear2 · 67%");
    expect(rows).toContain("Disgust1 · 33%");
    expect(card).toHaveTextContent(/can add up to more than 100%/);
  });

  it("offers a table view of every chart", async () => {
    await seed();
    const { user } = renderRoutes(routes, "/");

    const card = await screen.findByRole("region", { name: "Most recorded emotions" });
    await user.click(within(card).getByRole("button", { name: "Show Most recorded emotions as a table" }));
    const table = within(card).getByRole("table");
    const firstRow = within(table).getAllByRole("row")[1];
    expect(firstRow).toHaveTextContent("Anxious");
    expect(firstRow).toHaveTextContent("Fear");
    expect(firstRow).toHaveTextContent("67%");
  });

  it("filters every panel by habit", async () => {
    const { alcohol } = await seed();
    const { user } = renderRoutes(routes, "/");

    await user.selectOptions(await screen.findByRole("combobox", { name: "Habit" }), alcohol.id);
    expect(await screen.findByText("Showing 2 of 3 logged urges.")).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Emotion categories" });
    expect(within(card).getAllByRole("listitem").map((item) => item.textContent)).toContain("Sad2 · 100%");
  });

  it("holds back pattern statements until there is enough data", async () => {
    await seed();
    renderRoutes(routes, "/");
    expect(await screen.findByText(/Patterns appear here once at least 5 urges/)).toBeInTheDocument();
  });

  it("offers a follow-up for urges still marked ongoing", async () => {
    await updateSettings({ onboardingComplete: true });
    const habit = await createHabit({ name: "Vaping" });
    await createEntry({ habitId: habit.id, emotionIds: ["fear.anxious"], timestamp: hoursAgo(1), outcome: "ongoing" });
    renderRoutes(routes, "/");

    const card = await screen.findByRole("region", { name: "Still ongoing?" });
    expect(within(card).getByRole("button", { name: "Vaping: it passed" })).toBeInTheDocument();
  });
});
