/**
 * History page – every logged urge as a timeline, with search, filters and
 * sorting.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowUpDown, History as HistoryIcon, Plus, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import EntryCard from "../components/entries/EntryCard.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { EmptyState, PageHeader } from "../components/ui/display.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { describeError } from "../db/errors.js";
import { deleteEntry, updateEntryOutcome } from "../db/entriesRepository.js";
import HistoryFilterSheet from "../features/history/HistoryFilterSheet.jsx";
import { EMPTY_FILTERS, describeActiveFilters, toEntryFilters } from "../features/history/historyFilters.js";
import { useAppData } from "../hooks/useAppData.js";
import { filterEntries, groupBy, sortEntries } from "../services/analytics.js";
import { formatDateTime, formatDayHeading, toLocalDateKey } from "../utils/dates.js";
import { pluralize } from "../utils/text.js";

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const { habits, entries, habitsById, tagsById, strategiesById, isLoading } = useAppData();
  const showToast = useToast();
  const [searchParams] = useSearchParams();

  // A link such as /history?habit=<id> opens the page already filtered.
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, habitId: searchParams.get("habit") ?? "" }));
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState("newest");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // useMemo: redo the filtering only when its inputs actually change.
  const visibleEntries = useMemo(() => {
    const matching = filterEntries(entries, toEntryFilters(filters, search), { habitsById, tagsById, strategiesById });
    return sortEntries(matching, sortDirection);
  }, [entries, filters, search, sortDirection, habitsById, tagsById, strategiesById]);

  const activeFilters = describeActiveFilters(filters, habitsById);
  const isFiltering = activeFilters.length > 0 || search.trim() !== "";

  // Group the entries on screen by calendar day for the date headings.
  const pageEntries = visibleEntries.slice(0, visibleCount);
  const dayGroups = Array.from(groupBy(pageEntries, (entry) => toLocalDateKey(entry.timestamp)));

  function updateFilters(next) {
    setFilters(next);
    setVisibleCount(PAGE_SIZE);
  }

  async function handleDeleteConfirmed() {
    try {
      await deleteEntry(entryToDelete.id);
      showToast("Entry deleted.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
    setEntryToDelete(null);
  }

  async function handleUpdateOutcome(entry, outcome) {
    try {
      await updateEntryOutcome(entry.id, outcome);
      showToast("Outcome updated.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  if (isLoading) return <div className="page" aria-busy="true" />;

  return (
    <div className="page">
      <PageHeader title="History" subtitle="Everything you've logged, newest first unless you change it." />

      {entries.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={HistoryIcon}
            title="Nothing logged yet"
            action={
              <Link to="/log" className="btn btn--primary">
                <Plus size={18} aria-hidden="true" />
                Log an urge
              </Link>
            }
          >
            When you log an urge it appears here, with the emotions you chose in their category colors.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* ---------- Search, filter and sort controls ---------- */}
          <div className="stack stack--md">
            <div className="search-field">
              <Search size={20} className="search-field__icon" aria-hidden="true" />
              <input
                className="input"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search notes, tags, emotions…"
                aria-label="Search history"
                enterKeyHint="search"
              />
            </div>

            <div className="row row--between">
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setIsFilterSheetOpen(true)}>
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setSortDirection((current) => (current === "newest" ? "oldest" : "newest"))}
                aria-label={`Sorted ${sortDirection} first. Switch to ${sortDirection === "newest" ? "oldest" : "newest"} first.`}
              >
                <ArrowUpDown size={16} aria-hidden="true" />
                {sortDirection === "newest" ? "Newest first" : "Oldest first"}
              </button>
            </div>

            {activeFilters.length > 0 ? (
              <ul className="row row--wrap" aria-label="Active filters">
                {activeFilters.map((filter) => (
                  <li key={filter.key}>
                    <button
                      type="button"
                      className="filter-chip"
                      onClick={() => updateFilters({ ...filters, ...filter.cleared })}
                      aria-label={`Remove filter: ${filter.label}`}
                    >
                      {filter.label}
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-small text-muted" role="status">
              {isFiltering
                ? `${pluralize(visibleEntries.length, "entry", "entries")} of ${entries.length} match`
                : pluralize(entries.length, "entry", "entries")}
            </p>
          </div>

          {/* ---------- Timeline ---------- */}
          {visibleEntries.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={SearchX}
                title="No entries match"
                action={
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => {
                      updateFilters({ ...EMPTY_FILTERS });
                      setSearch("");
                    }}
                  >
                    Clear search and filters
                  </button>
                }
              >
                Try a different search or remove a filter.
              </EmptyState>
            </div>
          ) : (
            dayGroups.map(([dateKey, dayEntries]) => (
              <section key={dateKey} className="stack stack--md" aria-label={formatDayHeading(dayEntries[0].timestamp)}>
                <h2 className="timeline-day">{formatDayHeading(dayEntries[0].timestamp)}</h2>
                <ul className="stack stack--md">
                  {dayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      habit={habitsById.get(entry.habitId)}
                      tagsById={tagsById}
                      strategiesById={strategiesById}
                      onDelete={setEntryToDelete}
                      onUpdateOutcome={handleUpdateOutcome}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {visibleEntries.length > visibleCount ? (
            <button type="button" className="btn btn--secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, visibleEntries.length - visibleCount)} more
            </button>
          ) : null}
        </>
      )}

      <HistoryFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        filters={filters}
        onChange={updateFilters}
        habits={habits}
        resultCount={visibleEntries.length}
      />

      <ConfirmDialog
        isOpen={Boolean(entryToDelete)}
        title="Delete this entry?"
        tone="danger"
        confirmLabel="Delete entry"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setEntryToDelete(null)}
      >
        {entryToDelete ? (
          <p>
            <strong>{habitsById.get(entryToDelete.habitId)?.name ?? "Entry"}</strong> ·{" "}
            {formatDateTime(entryToDelete.timestamp)}. It will be removed from History and from your analytics. This
            can't be undone.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
