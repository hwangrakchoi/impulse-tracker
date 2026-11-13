/**
 * Non-chart panels used on the Dashboard and the habit detail page:
 * insights, coping strategies, outcomes, context tags and ongoing urges.
 */
import { Hourglass, Lightbulb } from "lucide-react";
import { HabitIcon, MeterList } from "../../components/ui/display.jsx";
import { OUTCOMES } from "../../data/defaults.js";
import { MIN_RESOLVED_FOR_COPING_RATE } from "../../services/analytics.js";
import { MIN_ENTRIES_FOR_INSIGHTS } from "../../services/insights.js";
import { formatRelativeTime } from "../../utils/dates.js";
import { formatPercent, pluralize, ratio } from "../../utils/text.js";

/** Plain-language observations calculated from the user's own entries. */
export function InsightsCard({ insights, urgeEvents }) {
  return (
    <section className="card stack stack--md" aria-labelledby="insights-title">
      <h2 id="insights-title">Patterns in your logs</h2>
      {insights.length > 0 ? (
        <ul className="insight-list">
          {insights.map((insight) => (
            <li key={insight.id} className="insight">
              <Lightbulb size={18} aria-hidden="true" />
              <div className="stack stack--xs">
                <p className="insight__text">{insight.text}</p>
                <p className="insight__basis">{insight.basis}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary">
          {urgeEvents < MIN_ENTRIES_FOR_INSIGHTS
            ? `Patterns appear here once at least ${MIN_ENTRIES_FOR_INSIGHTS} urges are logged in this view (${urgeEvents} so far). With very little data, any “pattern” would just be chance.`
            : "Nothing stands out clearly in this view yet. That is a normal result, not a problem."}
        </p>
      )}
      <p className="chart-card__note">
        These sentences are counted directly from your entries. They describe what was recorded together – they do not
        show that one thing causes another.
      </p>
    </section>
  );
}

/**
 * Coping strategies and how the urges they were recorded with turned out.
 * @param {object} analysis  result of analyzeCopingStrategies()
 */
export function CopingStrategiesCard({ analysis, strategiesById }) {
  const strategies = analysis.strategies.filter((item) => strategiesById.get(item.strategyId));
  return (
    <section className="card stack stack--md" aria-labelledby="coping-title">
      <div className="stack stack--xs">
        <h2 id="coping-title">Coping strategies</h2>
        <p className="chart-card__subtitle">
          Of the urges where you recorded a strategy and an outcome, how many passed without engaging.
        </p>
      </div>
      {strategies.length === 0 ? (
        <p className="text-secondary">
          Add the strategies you try when logging an urge, and record the outcome, to see them here.
        </p>
      ) : (
        <>
          <MeterList
            label="Coping strategies"
            rows={strategies.map((item) => ({
              key: item.strategyId,
              name: strategiesById.get(item.strategyId).name,
              value: item.passedRate === null ? "Too few to say" : formatPercent(item.passedRate),
              detail:
                item.passedRate === null
                  ? `Recorded ${item.timesRecorded}× · ${item.resolved} with an outcome`
                  : `Passed in ${item.passed} of ${item.resolved} with an outcome · recorded ${item.timesRecorded}×`,
              fraction: item.passedRate ?? 0,
            }))}
          />
          {analysis.overall.passedRate !== null ? (
            <p className="text-small text-secondary">
              For comparison, across all urges with an outcome: passed in {analysis.overall.passed} of{" "}
              {analysis.overall.resolved} ({formatPercent(analysis.overall.passedRate)}).
            </p>
          ) : null}
        </>
      )}
      <p className="chart-card__note">
        Observational only. A percentage appears once a strategy has at least {MIN_RESOLVED_FOR_COPING_RATE} entries
        with an outcome. Urges still ongoing or without an outcome are left out. This is not evidence that a strategy
        works or doesn't – you may reach for different strategies in different situations.
      </p>
    </section>
  );
}

/** Recorded outcomes as neutral bars – no "good" or "bad" coloring. */
export function OutcomesCard({ outcomes }) {
  const rows = [
    { key: "passed", name: "Urge passed", count: outcomes.passed },
    { key: "engaged", name: "Engaged", count: outcomes.engaged },
    { key: "ongoing", name: "Still ongoing", count: outcomes.ongoing },
    { key: "notRecorded", name: "Not recorded", count: outcomes.notRecorded },
  ];
  return (
    <section className="card stack stack--md" aria-labelledby="outcomes-title">
      <h2 id="outcomes-title">Recorded outcomes</h2>
      <MeterList
        label="Recorded outcomes"
        rows={rows.map((row) => ({
          key: row.key,
          name: row.name,
          value: `${row.count} · ${formatPercent(ratio(row.count, outcomes.urgeEvents))}`,
          fraction: ratio(row.count, outcomes.urgeEvents) ?? 0,
        }))}
      />
      <p className="chart-card__note">Share of this habit's {pluralize(outcomes.urgeEvents, "logged urge")}. Recording an outcome is always optional.</p>
    </section>
  );
}

/**
 * A "most used" list for context tags or coping strategies.
 * @param {Array} references  result of countReferences()
 * @param {Map}   namesById   id → { name }
 */
export function ReferenceListCard({ title, references, namesById, emptyMessage, urgeEvents }) {
  const known = references.filter((item) => namesById.get(item.id));
  return (
    <section className="card stack stack--md" aria-label={title}>
      <h2>{title}</h2>
      {known.length === 0 ? (
        <p className="text-secondary">{emptyMessage}</p>
      ) : (
        <MeterList
          label={title}
          rows={known.map((item) => ({
            key: item.id,
            name: namesById.get(item.id).name,
            value: `${item.count} of ${urgeEvents} urges`,
            fraction: item.shareOfUrges ?? 0,
          }))}
        />
      )}
    </section>
  );
}

/** Urges saved as "still ongoing", with one-tap follow-up buttons. */
export function OngoingUrgesCard({ entries, habitsById, onUpdateOutcome }) {
  if (entries.length === 0) return null;
  return (
    <section className="card stack stack--md" aria-labelledby="ongoing-title">
      <div className="row">
        <Hourglass size={18} className="text-muted" aria-hidden="true" />
        <h2 id="ongoing-title">Still ongoing?</h2>
      </div>
      <p className="text-small text-secondary">
        You marked {entries.length === 1 ? "this urge" : "these urges"} as ongoing. Update {entries.length === 1 ? "it" : "them"} whenever you like –
        the original time is kept.
      </p>
      <ul className="stack stack--md">
        {entries.map((entry) => {
          const habit = habitsById.get(entry.habitId);
          return (
            <li key={entry.id} className="follow-up">
              <span className="row grow">
                <HabitIcon habit={habit} size="sm" />
                <span className="stack stack--xs">
                  <span className="text-strong">{habit?.name ?? "Deleted habit"}</span>
                  <span className="text-xs text-muted">Logged {formatRelativeTime(entry.timestamp)}</span>
                </span>
              </span>
              <span className="row">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => onUpdateOutcome(entry, OUTCOMES.PASSED)} aria-label={`${habit?.name ?? "Urge"}: it passed`}>
                  It passed
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => onUpdateOutcome(entry, OUTCOMES.ENGAGED)} aria-label={`${habit?.name ?? "Urge"}: I engaged`}>
                  I engaged
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
