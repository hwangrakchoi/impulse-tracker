/**
 * EntryCard – one logged urge in a timeline.
 *
 * The card always shows the essentials (habit, time, emotions grouped by
 * category, intensity, outcome, tags). "Details" expands it to reveal notes
 * and the Edit / Delete actions, so the timeline stays uncluttered.
 */
import { useId, useState } from "react";
import { Link } from "react-router";
import { Check, ChevronDown, CircleDot, Hourglass, Pencil, Tag, Trash2 } from "lucide-react";
import EmotionChip from "../emotions/EmotionChip.jsx";
import { getCategoryIcon } from "../emotions/categoryIcons.js";
import { HabitIcon } from "../ui/display.jsx";
import { OUTCOMES, getOutcomeLabel } from "../../data/defaults.js";
import { PRIMARY_EMOTIONS, resolveEmotion } from "../../data/emotionTaxonomy.js";
import { formatDateTime, formatTime } from "../../utils/dates.js";

const OUTCOME_ICONS = {
  [OUTCOMES.PASSED]: Check,
  [OUTCOMES.ENGAGED]: CircleDot,
  [OUTCOMES.ONGOING]: Hourglass,
};

/** Neutral badge for an outcome – deliberately not color-coded good/bad. */
export function OutcomeBadge({ outcome }) {
  if (!outcome) return null;
  const Icon = OUTCOME_ICONS[outcome] ?? CircleDot;
  return (
    <span className="badge">
      <Icon size={14} aria-hidden="true" />
      {getOutcomeLabel(outcome)}
    </span>
  );
}

/**
 * Emotions listed under their primary category, e.g.
 *   Sad      Lonely  Empty
 *   Disgust  Awful
 * so every category involved is named in text, not just shown by color.
 */
export function EmotionGroups({ emotionIds }) {
  const groups = PRIMARY_EMOTIONS.map((category) => ({
    category,
    ids: emotionIds.filter((id) => resolveEmotion(id).categoryId === category.id),
  })).filter((group) => group.ids.length > 0);
  const unknownIds = emotionIds.filter((id) => resolveEmotion(id).categoryId === null);

  return (
    <div className="emotion-groups">
      {groups.map(({ category, ids }) => {
        const Icon = getCategoryIcon(category.id);
        return (
          <div key={category.id} className="emotion-group" style={{ "--emotion-color": `var(${category.colorVar})` }}>
            <span className="emotion-group__label">
              <Icon size={16} aria-hidden="true" />
              {category.label}
            </span>
            <ul className="emotion-group__chips" aria-label={`${category.label} emotions`}>
              {ids.map((id) => (
                <li key={id}>
                  <EmotionChip emotionId={id} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {unknownIds.length > 0 ? (
        <div className="emotion-group" style={{ "--emotion-color": "var(--emotion-unknown)" }}>
          <span className="emotion-group__label">Other</span>
          <ul className="emotion-group__chips">
            {unknownIds.map((id) => (
              <li key={id}>
                <EmotionChip emotionId={id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ label, children }) {
  return (
    <div className="detail-block">
      <span className="detail-block__label">{label}</span>
      {children}
    </div>
  );
}

export default function EntryCard({ entry, habit, tagsById, strategiesById, showDate = false, onDelete, onUpdateOutcome }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();

  const tags = entry.contextTagIds.map((id) => tagsById.get(id)).filter(Boolean);
  const strategies = entry.copingStrategyIds.map((id) => strategiesById.get(id)).filter(Boolean);
  const wasEdited = entry.updatedAt !== entry.createdAt;
  const hasMeta = entry.intensity !== null || entry.outcome || tags.length > 0;

  return (
    <li className="card entry-card">
      <div className="entry-card__header">
        <HabitIcon habit={habit} size="sm" />
        <span className="entry-card__habit">
          {habit?.name ?? "Deleted habit"}
          {habit?.isArchived ? <span className="text-xs text-muted"> · archived</span> : null}
        </span>
        <time className="entry-card__time" dateTime={entry.timestamp}>
          {showDate ? formatDateTime(entry.timestamp) : formatTime(entry.timestamp)}
        </time>
      </div>

      <EmotionGroups emotionIds={entry.emotionIds} />

      {hasMeta ? (
        <div className="entry-card__meta">
          {entry.intensity !== null ? (
            <span className="badge">
              Intensity <strong>{entry.intensity}/10</strong>
            </span>
          ) : null}
          <OutcomeBadge outcome={entry.outcome} />
          {tags.map((tag) => (
            <span key={tag.id} className="badge badge--outline">
              <Tag size={12} aria-hidden="true" />
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* Follow-up for an urge saved as "still ongoing". */}
      {entry.outcome === OUTCOMES.ONGOING && onUpdateOutcome ? (
        <div className="follow-up">
          <span className="text-small text-strong">How did it go?</span>
          <div className="row row--wrap">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onUpdateOutcome(entry, OUTCOMES.PASSED)}>
              It passed
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onUpdateOutcome(entry, OUTCOMES.ENGAGED)}>
              I engaged
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="entry-card__toggle"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded ? "Hide details" : "Details"}
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {isExpanded ? (
        <div id={detailsId} className="entry-card__details">
          {entry.situationalNotes ? (
            <DetailBlock label="What was happening">
              <p className="text-prewrap">{entry.situationalNotes}</p>
            </DetailBlock>
          ) : null}
          {strategies.length > 0 ? (
            <DetailBlock label="Coping strategies tried">
              <p>{strategies.map((strategy) => strategy.name).join(", ")}</p>
            </DetailBlock>
          ) : null}
          {entry.notes ? (
            <DetailBlock label="Notes">
              <p className="text-prewrap">{entry.notes}</p>
            </DetailBlock>
          ) : null}
          {entry.reflectionResponse ? (
            <DetailBlock label={entry.reflectionPrompt || "Reflection"}>
              <p className="text-prewrap">{entry.reflectionResponse}</p>
            </DetailBlock>
          ) : null}

          <p className="text-xs text-muted">
            Urge at {formatDateTime(entry.timestamp)}
            {entry.outcomeUpdatedAt && entry.outcome ? ` · outcome recorded ${formatDateTime(entry.outcomeUpdatedAt)}` : ""}
            {wasEdited ? ` · last edited ${formatDateTime(entry.updatedAt)}` : ""}
          </p>

          <div className="row">
            <Link to={`/log/${entry.id}`} className="btn btn--secondary btn--sm">
              <Pencil size={16} aria-hidden="true" />
              Edit
            </Link>
            {onDelete ? (
              <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => onDelete(entry)}>
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
