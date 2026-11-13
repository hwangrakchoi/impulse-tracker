/**
 * Settings – appearance, logging preferences, tags & strategies, backups,
 * privacy, and information about the app.
 */
import { useEffect, useState } from "react";
import { Info, Smartphone } from "lucide-react";
import { SegmentedControl, Switch } from "../components/ui/controls.jsx";
import { PageHeader } from "../components/ui/display.jsx";
import { TAXONOMY_VERSION, TERTIARY_LEVEL_VERIFIED } from "../data/emotionTaxonomy.js";
import { CURRENT_SCHEMA_VERSION, isStoragePersistent } from "../db/database.js";
import { contextTagsRepository, copingStrategiesRepository } from "../db/namedListRepository.js";
import { updateSettings } from "../db/settingsRepository.js";
import BackupSection from "../features/settings/BackupSection.jsx";
import ManageNamedList from "../features/settings/ManageNamedList.jsx";
import PrivacySection from "../features/settings/PrivacySection.jsx";
import { useAppData, useSettings } from "../hooks/useAppData.js";
import { BACKUP_FORMAT_VERSION } from "../services/backup.js";

const THEME_OPTIONS = [
  { value: "system", label: "Automatic" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function SettingsSection({ title, description, children }) {
  return (
    <section className="card settings-section" aria-label={title}>
      <div className="stack stack--xs">
        <h2>{title}</h2>
        {description ? <p className="text-small text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** True when the app was opened from the Home Screen rather than in Safari. */
function isRunningInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const { entries, contextTags, copingStrategies, habitsById, tagsById, strategiesById, isLoading } = useAppData();
  const [isPersistent, setIsPersistent] = useState(null);

  useEffect(() => {
    isStoragePersistent().then(setIsPersistent);
  }, []);

  if (!settings || isLoading) return <div className="page" aria-busy="true" />;

  return (
    <div className="page">
      <PageHeader title="Settings" />

      <SettingsSection title="Appearance">
        <SegmentedControl
          label="Theme"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          block
        />
        <p className="text-xs text-muted">Automatic follows your phone's light or dark mode.</p>
      </SettingsSection>

      <SettingsSection title="Logging">
        <Switch
          label="Reflection prompt after saving"
          description="A short, skippable question after you log an urge."
          checked={settings.reflectionPromptsEnabled}
          onChange={(value) => updateSettings({ reflectionPromptsEnabled: value })}
        />
        <Switch
          label="Show optional details by default"
          description="Open intensity, context, outcome and notes on the Log screen."
          checked={settings.logDetailsExpanded}
          onChange={(value) => updateSettings({ logDetailsExpanded: value })}
        />
      </SettingsSection>

      <SettingsSection
        title="Context tags"
        description="Offered when you log an urge. Deleting a tag removes it from entries but keeps the entries."
      >
        <ManageNamedList items={contextTags} repository={contextTagsRepository} noun="tag" addPlaceholder="New tag, e.g. Commuting" />
      </SettingsSection>

      <SettingsSection
        title="Coping strategies"
        description="Things you might try when an urge comes up."
      >
        <ManageNamedList
          items={copingStrategies}
          repository={copingStrategiesRepository}
          noun="strategy"
          addPlaceholder="New strategy, e.g. Cold shower"
        />
      </SettingsSection>

      <SettingsSection title="Backup & restore">
        <BackupSection entries={entries} habitsById={habitsById} tagsById={tagsById} strategiesById={strategiesById} />
      </SettingsSection>

      <SettingsSection title="Privacy">
        <PrivacySection settings={settings} />
      </SettingsSection>

      <SettingsSection title="About">
        <div className="stack stack--md">
          {!isRunningInstalled() ? (
            <div className="notice">
              <Smartphone size={18} aria-hidden="true" />
              <span>
                <strong>Install on iPhone:</strong> open this page in Safari, tap the Share button, then “Add to Home
                Screen”. The installed app works offline and keeps its data more reliably than a browser tab.
              </span>
            </div>
          ) : null}

          <div className="notice">
            <Info size={18} aria-hidden="true" />
            <span>
              Emotional Trigger Tracker helps you notice patterns in what you record. It is not a medical device and
              does not diagnose or treat any condition. If you're struggling, please reach out to a doctor, therapist or
              a local support line.
            </span>
          </div>

          <ul className="settings-list text-small">
            <li className="settings-list__row">
              <span className="grow text-secondary">Storage</span>
              <span>
                {isPersistent === true
                  ? "Protected from automatic clean-up"
                  : isPersistent === false
                    ? "Browser may clear it if space runs low"
                    : "Status unavailable"}
              </span>
            </li>
            <li className="settings-list__row">
              <span className="grow text-secondary">Entries stored</span>
              <span>{entries.length}</span>
            </li>
            <li className="settings-list__row">
              <span className="grow text-secondary">Data versions</span>
              <span>
                database {CURRENT_SCHEMA_VERSION} · backup {BACKUP_FORMAT_VERSION} · emotions {TAXONOMY_VERSION}
              </span>
            </li>
            <li className="settings-list__row">
              <span className="grow text-secondary">Emotion wheel</span>
              <span>{TERTIARY_LEVEL_VERIFIED ? "Verified against reference" : "Outer ring awaiting review"}</span>
            </li>
          </ul>
        </div>
      </SettingsSection>
    </div>
  );
}
