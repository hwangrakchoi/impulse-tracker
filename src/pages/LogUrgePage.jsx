/**
 * Log Urge page – also used for editing an existing entry.
 *
 * Routes:  /log            new entry   (optionally /log?habit=<id>)
 *          /log/:entryId   edit that entry
 */
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ListChecks, SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "../components/ui/display.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { requestPersistentStorage } from "../db/database.js";
import EntryForm from "../features/log/EntryForm.jsx";
import ReflectionSheet from "../features/log/ReflectionSheet.jsx";
import { useAppData, useSettings } from "../hooks/useAppData.js";

export default function LogUrgePage() {
  const { entryId } = useParams(); // the ":entryId" part of the URL, if any
  const [searchParams] = useSearchParams(); // the "?habit=…" part
  const navigate = useNavigate();
  const showToast = useToast();
  const { habits, entries, contextTags, copingStrategies, isLoading } = useAppData();
  const settings = useSettings();

  // Set after a new entry is saved, to offer the optional reflection prompt.
  const [entryForReflection, setEntryForReflection] = useState(null);

  if (isLoading || !settings) return <div className="page" aria-busy="true" />;

  const isEditing = Boolean(entryId);
  const entry = isEditing ? entries.find((item) => item.id === entryId) : undefined;

  if (isEditing && !entry && !entryForReflection) {
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon={SearchX}
            title="Entry not found"
            action={
              <Link to="/history" className="btn btn--primary">
                Go to History
              </Link>
            }
          >
            It may have been deleted.
          </EmptyState>
        </div>
      </div>
    );
  }

  // Archived habits are hidden when logging – except the one an existing
  // entry already belongs to, so editing never silently changes its habit.
  const selectableHabits = habits.filter((habit) => !habit.isArchived || habit.id === entry?.habitId);

  if (selectableHabits.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Log an urge" />
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title="Add a habit first"
            action={
              <Link to="/habits" className="btn btn--primary">
                Go to Habits
              </Link>
            }
          >
            {habits.length === 0
              ? "An urge is always logged against a habit. Create one and come straight back."
              : "All of your habits are archived. Reactivate one or add a new habit to log an urge."}
          </EmptyState>
        </div>
      </div>
    );
  }

  function handleSaved(savedEntry, { isNew }) {
    if (!isNew) {
      showToast("Entry updated.");
      navigate("/history");
      return;
    }
    showToast("Urge logged.");
    // Ask the browser (once it matters) not to clear our storage automatically.
    requestPersistentStorage();
    if (settings.reflectionPromptsEnabled) {
      setEntryForReflection(savedEntry);
    } else {
      navigate("/history");
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={isEditing ? "Edit entry" : "Log an urge"}
        subtitle={isEditing ? undefined : "Notice it, name it, save it. No judgment."}
        backTo={isEditing ? "/history" : undefined}
        backLabel="History"
      />

      <EntryForm
        // A different key per entry gives each one a fresh form.
        key={entry?.id ?? "new"}
        entry={entry}
        habits={selectableHabits}
        contextTags={contextTags}
        copingStrategies={copingStrategies}
        initialHabitId={searchParams.get("habit")}
        detailsInitiallyOpen={settings.logDetailsExpanded}
        onSaved={handleSaved}
        onCancel={isEditing ? () => navigate("/history") : undefined}
      />

      {entryForReflection ? <ReflectionSheet entry={entryForReflection} onDone={() => navigate("/history")} /> : null}
    </div>
  );
}
