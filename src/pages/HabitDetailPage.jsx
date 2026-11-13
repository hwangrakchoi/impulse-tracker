/**
 * Habit detail page (/habits/:habitId) – everything recorded for one habit.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Archive, ArchiveRestore, History, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import CategoryDonut from "../components/charts/CategoryDonut.jsx";
import FrequencyChart from "../components/charts/FrequencyChart.jsx";
import TopEmotionsChart from "../components/charts/TopEmotionsChart.jsx";
import EntryCard from "../components/entries/EntryCard.jsx";
import { SegmentedControl } from "../components/ui/controls.jsx";
import { EmptyState, HabitIcon, PageHeader, StatTile } from "../components/ui/display.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { describeError } from "../db/errors.js";
import { updateEntryOutcome } from "../db/entriesRepository.js";
import { setHabitArchived } from "../db/habitsRepository.js";
import { updateSettings } from "../db/settingsRepository.js";
import { CopingStrategiesCard, OutcomesCard, ReferenceListCard } from "../features/analytics/panels.jsx";
import DeleteHabitDialog from "../features/habits/DeleteHabitDialog.jsx";
import HabitFormModal from "../features/habits/HabitFormModal.jsx";
import { useAppData, useSettings } from "../hooks/useAppData.js";
import { useToday } from "../hooks/useToday.js";
import {
  analyzeCopingStrategies,
  buildFrequencySeries,
  countEmotionSelections,
  filterEntries,
  summarizeHabit,
} from "../services/analytics.js";
import { DATE_RANGE_PRESETS, getPresetRange } from "../utils/dates.js";
import { pluralize } from "../utils/text.js";

const RANGE_OPTIONS = DATE_RANGE_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }));

/** "Lonely" or, on a tie, "Lonely, Bored (tie)". */
function formatLeaders(items, getLabel) {
  if (items.length === 0) return "–";
  const labels = items.slice(0, 3).map(getLabel).join(", ");
  return items.length > 1 ? `${labels}${items.length > 3 ? "…" : ""} (tie)` : labels;
}

export default function HabitDetailPage() {
  const { habitId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { entries, habitsById, tagsById, strategiesById, isLoading } = useAppData();
  const settings = useSettings();
  const today = useToday();

  const [rangePreset, setRangePreset] = useState("all");
  const [dialog, setDialog] = useState(null); // "edit" | "delete" | null

  const habit = habitsById.get(habitId);
  const granularity = settings?.trendGranularity ?? "day";

  const range = useMemo(() => getPresetRange(rangePreset, today), [rangePreset, today]);
  const allHabitEntries = useMemo(() => entries.filter((entry) => entry.habitId === habitId), [entries, habitId]);
  const habitEntries = useMemo(
    () => filterEntries(allHabitEntries, { from: range.from, to: range.to }),
    [allHabitEntries, range],
  );

  const summary = useMemo(() => summarizeHabit(habitEntries), [habitEntries]);
  const selections = useMemo(() => countEmotionSelections(habitEntries), [habitEntries]);
  const coping = useMemo(() => analyzeCopingStrategies(habitEntries), [habitEntries]);
  const frequencySeries = useMemo(
    () => buildFrequencySeries(habitEntries, { granularity, from: range.from ?? undefined, to: habitEntries.length > 0 ? today : undefined }),
    [habitEntries, granularity, range, today],
  );

  if (isLoading) return <div className="page" aria-busy="true" />;

  if (!habit) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon={SearchX}
            title="Habit not found"
            action={
              <Link to="/habits" className="btn btn--primary">
                Go to Habits
              </Link>
            }
          >
            It may have been deleted.
          </EmptyState>
        </div>
      </div>
    );
  }

  async function toggleArchived() {
    try {
      await setHabitArchived(habit.id, !habit.isArchived);
      showToast(habit.isArchived ? `“${habit.name}” reactivated.` : `“${habit.name}” archived. Its history is kept.`);
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  async function handleUpdateOutcome(entry, outcome) {
    try {
      await updateEntryOutcome(entry.id, outcome);
      showToast("Outcome updated.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  return (
    <div className="page">
      <PageHeader
        backTo="/habits"
        backLabel="Habits"
        title={
          <span className="row">
            <HabitIcon habit={habit} />
            <span>{habit.name}</span>
          </span>
        }
        subtitle={habit.description || undefined}
      />

      {habit.isArchived ? (
        <p className="notice">
          This habit is archived: it is hidden from the Log screen, and its history is kept and shown here.
        </p>
      ) : null}

      <div className="row row--wrap">
        {!habit.isArchived ? (
          <Link to={`/log?habit=${habit.id}`} className="btn btn--primary btn--sm">
            <Plus size={16} aria-hidden="true" />
            Log an urge
          </Link>
        ) : null}
        <Link to={`/history?habit=${habit.id}`} className="btn btn--secondary btn--sm">
          <History size={16} aria-hidden="true" />
          History
        </Link>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setDialog("edit")}>
          <Pencil size={16} aria-hidden="true" />
          Edit
        </button>
      </div>

      {allHabitEntries.length === 0 ? (
        <div className="card">
          <EmptyState icon={History} title="No urges logged for this habit yet">
            When you log one, its emotions, timing and outcomes are summarised here.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="stack stack--sm">
            <SegmentedControl label="Date range" options={RANGE_OPTIONS} value={rangePreset} onChange={setRangePreset} block />
            <p className="text-small text-muted" role="status">
              Showing {habitEntries.length} of {pluralize(allHabitEntries.length, "logged urge")} for this habit.
            </p>
          </div>

          {habitEntries.length === 0 ? (
            <p className="card text-secondary">Nothing was logged for this habit in this period.</p>
          ) : (
            <>
              <div className="stat-grid stat-grid--4">
                <StatTile label="Urges logged" value={summary.urgeEvents} />
                <StatTile
                  label="Most recorded emotion"
                  value={formatLeaders(summary.mostFrequentEmotions, (item) => item.displayName)}
                  note={summary.mostFrequentEmotions[0] ? `In ${summary.mostFrequentEmotions[0].count} of ${pluralize(summary.urgeEvents, "urge")}` : undefined}
                  isText
                />
                <StatTile
                  label="Most recorded category"
                  value={formatLeaders(summary.mostFrequentCategories, (item) => item.label)}
                  note={summary.mostFrequentCategories[0] ? `In ${summary.mostFrequentCategories[0].events} of ${pluralize(summary.urgeEvents, "urge")}` : undefined}
                  isText
                />
                <StatTile
                  label="Average intensity"
                  value={summary.averageIntensity === null ? "–" : `${summary.averageIntensity.toFixed(1)}/10`}
                  note={summary.entriesWithIntensity === 0 ? "Not recorded yet" : `From ${pluralize(summary.entriesWithIntensity, "urge")}`}
                />
              </div>

              <div className="chart-grid">
                <FrequencyChart
                  title="Trend"
                  series={frequencySeries}
                  granularity={granularity}
                  onGranularityChange={(value) => updateSettings({ trendGranularity: value })}
                  color={habit.accentColor}
                />
                <CategoryDonut involvement={summary.categoryInvolvement} subtitle={`How many ${habit.name} urges involved each category.`} />
                <TopEmotionsChart selections={selections} />
                <ReferenceListCard
                  title="Most common context"
                  references={summary.topContextTags}
                  namesById={tagsById}
                  urgeEvents={summary.urgeEvents}
                  emptyMessage="Add context tags when logging to see where and when this tends to come up."
                />
                <OutcomesCard outcomes={summary.outcomes} />
                <CopingStrategiesCard analysis={coping} strategiesById={strategiesById} />
              </div>

              <section className="stack stack--md" aria-labelledby="recent-title">
                <div className="row row--between">
                  <h2 id="recent-title">Most recent</h2>
                  <Link to={`/history?habit=${habit.id}`} className="link-btn text-small">
                    See all in History
                  </Link>
                </div>
                <ul className="stack stack--md">
                  {habitEntries.slice(0, 3).map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      habit={habit}
                      tagsById={tagsById}
                      strategiesById={strategiesById}
                      onUpdateOutcome={handleUpdateOutcome}
                      showDate
                    />
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      <section className="card stack stack--md" aria-labelledby="manage-title">
        <h2 id="manage-title">Manage habit</h2>
        <div className="button-stack">
          <button type="button" className="btn btn--secondary" onClick={toggleArchived}>
            {habit.isArchived ? <ArchiveRestore size={18} aria-hidden="true" /> : <Archive size={18} aria-hidden="true" />}
            {habit.isArchived ? "Reactivate" : "Archive (keeps history)"}
          </button>
          <button type="button" className="btn btn--danger-ghost" onClick={() => setDialog("delete")}>
            <Trash2 size={18} aria-hidden="true" />
            Delete…
          </button>
        </div>
      </section>

      {dialog === "edit" ? <HabitFormModal habit={habit} onClose={() => setDialog(null)} /> : null}
      {dialog === "delete" ? (
        <DeleteHabitDialog habit={habit} onClose={() => setDialog(null)} onDeleted={() => navigate("/habits")} />
      ) : null}
    </div>
  );
}
