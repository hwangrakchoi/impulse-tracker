/**
 * Backup & restore on the Settings page: export JSON, export CSV, and import
 * a JSON backup with a preview of exactly what would change.
 */
import { useRef, useState } from "react";
import { FileDown, FileUp, TriangleAlert } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import { SegmentedControl } from "../../components/ui/controls.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { describeError } from "../../db/errors.js";
import {
  IMPORT_MODES,
  applyImportPlan,
  buildBackup,
  entriesToCsv,
  getBackupFilename,
  parseBackupText,
  previewImport,
  serializeBackup,
  validateBackup,
} from "../../services/backup.js";
import { readTextFile, saveTextFile } from "../../services/fileTransfer.js";
import { formatDate } from "../../utils/dates.js";
import { pluralize } from "../../utils/text.js";

const MODE_OPTIONS = [
  { value: IMPORT_MODES.MERGE, label: "Merge" },
  { value: IMPORT_MODES.REPLACE, label: "Replace everything" },
];

const STAT_ROWS = [
  { key: "habits", singular: "habit", plural: "habits" },
  { key: "entries", singular: "entry", plural: "entries" },
  { key: "contextTags", singular: "context tag", plural: "context tags" },
  { key: "copingStrategies", singular: "coping strategy", plural: "coping strategies" },
];

/** "3 new · 1 updated · 2 already here" */
function describeStat(stat, mode) {
  if (mode === IMPORT_MODES.REPLACE) {
    return `${stat.inFile} restored · ${stat.removedFromDevice} on this device erased`;
  }
  const parts = [`${stat.added} new`];
  if (stat.updated > 0) parts.push(`${stat.updated} updated`);
  if (stat.matchedByName > 0) parts.push(`${stat.matchedByName} matched by name`);
  if (stat.unchanged > 0) parts.push(`${stat.unchanged} already here`);
  return parts.join(" · ");
}

export default function BackupSection({ entries, habitsById, tagsById, strategiesById }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  // Import state: null when idle, otherwise
  // { fileName, errors } or { fileName, data, warnings, meta, mode, plan }
  const [importState, setImportState] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  async function exportJson() {
    try {
      const result = await saveTextFile(getBackupFilename("json"), serializeBackup(await buildBackup()), "application/json");
      if (result !== "cancelled") showToast("Backup file created.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  async function exportCsv() {
    try {
      const csv = entriesToCsv(entries, { habitsById, tagsById, strategiesById });
      // A leading byte-order mark (\uFEFF) tells Excel the file is UTF-8, so accents display correctly.
      const result = await saveTextFile(getBackupFilename("csv"), `\uFEFF${csv}`, "text/csv");
      if (result !== "cancelled") showToast("CSV file created.");
    } catch (error) {
      showToast(describeError(error), { tone: "error" });
    }
  }

  async function handleFileChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again later
    if (!file) return;

    try {
      const parsed = parseBackupText(await readTextFile(file));
      if (!parsed.ok) return setImportState({ fileName: file.name, errors: parsed.errors });

      const validated = validateBackup(parsed.value);
      if (!validated.ok) return setImportState({ fileName: file.name, errors: validated.errors });

      const plan = await previewImport(validated.data, IMPORT_MODES.MERGE);
      setImportState({ fileName: file.name, data: validated.data, warnings: validated.warnings, meta: validated.meta, mode: IMPORT_MODES.MERGE, plan });
    } catch (error) {
      setImportState({ fileName: file.name, errors: [error instanceof Error && error.message ? error.message : "The file could not be read."] });
    }
  }

  async function changeMode(mode) {
    const plan = await previewImport(importState.data, mode);
    setImportState((current) => ({ ...current, mode, plan }));
  }

  async function confirmImport() {
    setIsBusy(true);
    try {
      // Re-check against the device right now, in case something changed
      // while the preview was open.
      const plan = await previewImport(importState.data, importState.mode);
      await applyImportPlan(plan);
      showToast(importState.mode === IMPORT_MODES.REPLACE ? "Backup restored." : "Backup merged into your data.");
      setImportState(null);
    } catch (error) {
      showToast(`Import failed – nothing was changed. ${describeError(error)}`, { tone: "error" });
    }
    setIsBusy(false);
  }

  const plan = importState?.plan;
  const nothingToDo =
    plan && plan.mode === IMPORT_MODES.MERGE && STAT_ROWS.every((row) => plan.stats[row.key].added + plan.stats[row.key].updated === 0);

  return (
    <div className="stack stack--md">
      <p className="text-small text-secondary">
        Your data exists only on this device. A backup file is the only way to move it to another device or recover it
        if this one is lost, reset, or its browser data is cleared.
      </p>

      <div className="button-stack">
        <button type="button" className="btn btn--secondary" onClick={exportJson}>
          <FileDown size={18} aria-hidden="true" />
          Export backup (JSON)
        </button>
        <button type="button" className="btn btn--secondary" onClick={exportCsv} disabled={entries.length === 0}>
          <FileDown size={18} aria-hidden="true" />
          Export entries (CSV)
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
          <FileUp size={18} aria-hidden="true" />
          Import backup…
        </button>
        {/* The real file input is hidden; the button above opens it. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={handleFileChosen}
          aria-label="Choose a backup file to import"
          tabIndex={-1}
        />
      </div>
      <p className="text-xs text-muted">
        The JSON backup restores everything. The CSV is for viewing entries in a spreadsheet and can't be imported.
        Backup files are not encrypted – store them somewhere you trust.
      </p>

      <Modal
        isOpen={Boolean(importState)}
        onClose={() => setImportState(null)}
        title={importState?.errors ? "This file can't be imported" : "Review import"}
        footer={
          importState?.errors ? (
            <button type="button" className="btn btn--primary" onClick={() => setImportState(null)} data-autofocus>
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`btn ${importState?.mode === IMPORT_MODES.REPLACE ? "btn--danger" : "btn--primary"}`}
                onClick={confirmImport}
                disabled={isBusy || nothingToDo}
              >
                {importState?.mode === IMPORT_MODES.REPLACE ? "Erase and restore" : nothingToDo ? "Nothing to import" : "Import"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setImportState(null)} data-autofocus>
                Cancel
              </button>
            </>
          )
        }
      >
        {importState?.errors ? (
          <div className="stack stack--md">
            <p className="text-secondary">
              <strong>{importState.fileName}</strong> was not imported, and nothing on this device was changed.
            </p>
            <ul className="stack stack--sm" aria-label="Problems found">
              {importState.errors.map((message) => (
                <li key={message} className="notice notice--danger">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>{message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : plan ? (
          <div className="stack">
            <p className="text-secondary">
              <strong>{importState.fileName}</strong>
              {importState.meta.exportedAt ? ` · exported ${formatDate(importState.meta.exportedAt)}` : ""}
              {plan.dateRange ? ` · entries from ${formatDate(plan.dateRange.from)} to ${formatDate(plan.dateRange.to)}` : ""}
            </p>

            <div className="field">
              <span className="field__label">How should it be imported?</span>
              <SegmentedControl label="Import mode" options={MODE_OPTIONS} value={importState.mode} onChange={changeMode} block />
              <p className="field__hint">
                {importState.mode === IMPORT_MODES.MERGE
                  ? "Adds what's missing. If the same record exists in both places, the most recently edited version is kept. Nothing on this device is deleted."
                  : "Erases everything on this device first, then restores exactly what is in the file."}
              </p>
            </div>

            <ul className="import-stats" aria-label="What will change">
              {STAT_ROWS.map((row) => (
                <li key={row.key}>
                  <span className="text-strong">{pluralize(plan.stats[row.key].inFile, row.singular, row.plural)} in file</span>
                  <span className="text-secondary">{describeStat(plan.stats[row.key], plan.mode)}</span>
                </li>
              ))}
            </ul>

            {plan.nameMatches.length > 0 ? (
              <p className="notice">
                <span>
                  Same name, treated as the same item: {plan.nameMatches.map((match) => `${match.name} (${match.kind})`).join(", ")}. Imported entries
                  will be attached to the one already on this device.
                </span>
              </p>
            ) : null}

            {importState.warnings.map((warning) => (
              <p key={warning} className="notice notice--warning">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>{warning}</span>
              </p>
            ))}

            {importState.mode === IMPORT_MODES.REPLACE ? (
              <p className="notice notice--danger">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>
                  Everything currently on this device will be permanently erased before the file is restored. Export a
                  backup first if you might want it back.
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
