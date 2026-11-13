/**
 * Dashboard – analytics across all habits.
 *
 * One filter row (habit + date range) scopes everything below it, so every
 * number and chart on the page describes the same set of entries.
 *
 * All calculations are done by the pure functions in src/services/. This
 * component only chooses the inputs and lays out the results.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChartPie, ChevronRight, ListChecks, Plus } from "lucide-react";
import CategoryDonut from "../components/charts/CategoryDonut.jsx";
import FrequencyChart from "../components/charts/FrequencyChart.jsx";
import HabitCategoryBars from "../components/charts/HabitCategoryBars.jsx";
import TimeOfDayChart from "../components/charts/TimeOfDayChart.jsx";
import TopEmotionsChart from "../components/charts/TopEmotionsChart.jsx";
import { SegmentedControl } from "../components/ui/controls.jsx";
import { EmptyState, HabitIcon, PageHeader, StatTile } from "../components/ui/display.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { OUTCOMES } from "../data/defaults.js";
import { describeError } from "../db/errors.js";
import { updateEntryOutcome } from "../db/entriesRepository.js";
import { updateSettings } from "../db/settingsRepository.js";
import { CopingStrategiesCard, InsightsCard, OngoingUrgesCard } from "../features/analytics/panels.jsx";
import Onboarding from "../features/onboarding/Onboarding.jsx";
import { useAppData, useSettings } from "../hooks/useAppData.js";
import { useToday } from "../hooks/useToday.js";
import {
  analyzeCopingStrategies,
  buildFrequencySeries,
  buildHabitCategoryMatrix,
  buildTimeOfDayDistribution,
  countCategoryInvolvement,
  countEmotionSelections,
  filterEntries,
  groupBy,
  summarizeTotals,
} from "../services/analytics.js";
import { generateInsights } from "../services/insights.js";
import { DATE_RANGE_PRESETS, formatDate, getPresetRange } from "../utils/dates.js";
import { pluralize } from "../utils/text.js";

const RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }));

export default function DashboardPage() {
  const { habits, entries, habitsById, tagsById, strategiesById, isLoading } = useAppData();
  const settings = useSettings();
  const showToast = useToast();
  const today = useToday();

  const [habitId, setHabitId] = useState("");
  const [rangePreset, setRangePreset] = useState("30d");

  // If the selected habit is deleted elsewhere, fall back to "All habits".
  const activeHabitId = habitsById.has(habitId) ? habitId : "";

  // --- Step 1: the entries in view -------------------------------------
  // useMemo caches a calculation and repeats it only when a listed input
  // changes, so typing elsewhere on the page never recalculates the charts.
  const range = useMemo(() => getPresetRange(rangePreset, today), [rangePreset, today]);
  const viewEntries = useMemo(
    () => filterEntries(entries, { habitId: activeHabitId || null, from: range.from, to: range.to }),
    [entries, activeHabitId, range],
  );

  // --- Step 2: everything derived from them ------------------------------
  const granularity = settings?.trendGranularity ?? "day";
  const blockHours = settings?.timeBlockHours ?? 3;

  const analytics = useMemo(() => {
    const habitsInView = activeHabitId ? habits.filter((habit) => habit.id === activeHabitId) : habits;
    return {
      totals: summarizeTotals(viewEntries),
      involvement: countCategoryInvolvement(viewEntries),
      selections: countEmotionSelections(viewEntries),
      habitMatrix: buildHabitCategoryMatrix(viewEntries, habitsInView),
      coping: analyzeCopingStrategies(viewEntries),
      insights: generateInsights({ entries: viewEntries, habits, tagsById, strategiesById }),
    };
  }, [viewEntries, habits, activeHabitId, tagsById, strategiesById]);

  const frequencySeries = useMemo(
    // The line runs up to today, so recent quiet days are visible too.
    () => buildFrequencySeries(viewEntries, { granularity, from: range.from ?? undefined, to: viewEntries.length > 0 ? today : undefined }),
    [viewEntries, granularity, range, today],
  );
  const timeBlocks = useMemo(() => buildTimeOfDayDistribution(viewEntries, blockHours), [viewEntries, blockHours]);

  const ongoingEntries = useMemo(() => entries.filter((entry) => entry.outcome === OUTCOMES.ONGOING).slice(0, 5), [entries]);
  const entriesByHabit = useMemo(() => groupBy(entries, (entry) => entry.habitId), [entries]);

  async function handleUpdateOutcome(entry, outcome) {
    try {
      await updateEntryOutcome(entry.id, outcome);
      showToast("Outcome updated.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  if (isLoading || !settings) return <div className="page" aria-busy="true" />;

  // --- First run and empty states ----------------------------------------
  if (habits.length === 0 && !settings.onboardingComplete) {
    return (
      <div className="page">
        <Onboarding />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" />
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title="Start with a habit"
            action={
              <Link to="/habits" className="btn btn--primary">
                Go to Habits
              </Link>
            }
          >
            Add a habit you'd like to understand better. Then log urges as they come up, and patterns will appear here.
          </EmptyState>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" />
        <div className="card">
          <EmptyState
            icon={ChartPie}
            title="Your patterns will appear here"
            action={
              <Link to="/log" className="btn btn--primary">
                <Plus size={18} aria-hidden="true" />
                Log your first urge
              </Link>
            }
          >
            Each time you log an urge and the emotions around it, this page updates: which emotions come up most, for
            which habit, and at what time of day.
          </EmptyState>
        </div>
      </div>
    );
  }

  const { totals, involvement, selections, habitMatrix, coping, insights } = analytics;

  return (
    <div className="page">
      <PageHeader title="Dashboard" subtitle={formatDate(today)} />

      <OngoingUrgesCard entries={ongoingEntries} habitsById={habitsById} onUpdateOutcome={handleUpdateOutcome} />

      {/* ---------- Filters: scope everything below ---------- */}
      <div className="stack stack--sm">
        <div className="filter-bar">
          <select className="select" value={activeHabitId} onChange={(event) => setHabitId(event.target.value)} aria-label="Habit">
            <option value="">All habits</option>
            {habits.map((habit) => (
              <option key={habit.id} value={habit.id}>
                {habit.name}
                {habit.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </select>
          <SegmentedControl label="Date range" options={RANGE_OPTIONS} value={rangePreset} onChange={setRangePreset} />
        </div>
        <p className="text-small text-muted" role="status">
          Showing {viewEntries.length} of {pluralize(entries.length, "logged urge")}.
        </p>
      </div>

      {viewEntries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ChartPie}
            title="Nothing logged in this view"
            action={
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setHabitId("");
                  setRangePreset("all");
                }}
              >
                Show all habits, all time
              </button>
            }
          >
            No urges match this habit and date range.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="stat-grid stat-grid--3">
            <StatTile label="Urges logged" value={totals.urgeEvents} note="One per entry" />
            <StatTile label="Emotions selected" value={totals.emotionSelections} note="Across those urges" />
            <StatTile
              label="Average intensity"
              value={totals.averageIntensity === null ? "–" : `${totals.averageIntensity.toFixed(1)}/10`}
              note={
                totals.entriesWithIntensity === 0
                  ? "Not recorded yet"
                  : `From ${pluralize(totals.entriesWithIntensity, "urge")} with intensity`
              }
            />
          </div>

          <InsightsCard insights={insights} urgeEvents={totals.urgeEvents} />

          <div className="chart-grid">
            <CategoryDonut involvement={involvement} />
            <HabitCategoryBars rows={habitMatrix} />
            <TopEmotionsChart selections={selections} />
            <FrequencyChart
              series={frequencySeries}
              granularity={granularity}
              onGranularityChange={(value) => updateSettings({ trendGranularity: value })}
            />
            <TimeOfDayChart
              blocks={timeBlocks}
              blockHours={blockHours}
              onBlockHoursChange={(value) => updateSettings({ timeBlockHours: value })}
            />
            <CopingStrategiesCard analysis={coping} strategiesById={strategiesById} />
          </div>
        </>
      )}

      {/* ---------- Links to each habit's own page ---------- */}
      <section className="card stack stack--sm" aria-labelledby="habit-details-title">
        <h2 id="habit-details-title">Habit details</h2>
        <ul className="habit-links">
          {habits.map((habit) => (
            <li key={habit.id}>
              <Link to={`/habits/${habit.id}`} className="habit-link">
                <HabitIcon habit={habit} size="sm" />
                <span className="grow text-strong">
                  {habit.name}
                  {habit.isArchived ? <span className="text-xs text-muted"> · archived</span> : null}
                </span>
                <span className="text-small text-muted">{pluralize(entriesByHabit.get(habit.id)?.length ?? 0, "urge")}</span>
                <ChevronRight size={18} className="text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted">
        This app helps you notice patterns in what you record. It is not a medical or diagnostic tool, and a pattern in
        your logs is not proof of a cause.
      </p>
    </div>
  );
}
