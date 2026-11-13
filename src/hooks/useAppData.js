/**
 * Data hooks – how components read from the database
 * ==================================================
 * A React "hook" is a function whose name starts with `use` and that lets a
 * component remember or subscribe to something.
 *
 * `useLiveQuery` (from dexie-react-hooks) runs a database query and then
 * RE-RUNS it automatically whenever the underlying data changes. So when a
 * new urge is saved on the Log page, the History and Dashboard pages update
 * by themselves – no manual refreshing or global state library needed.
 *
 * While the first read is in progress `useLiveQuery` returns `undefined`,
 * which is how we know the data is still loading.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { listHabits } from "../db/habitsRepository.js";
import { listEntries } from "../db/entriesRepository.js";
import { contextTagsRepository, copingStrategiesRepository } from "../db/namedListRepository.js";
import { getSettings } from "../db/settingsRepository.js";

export function useHabits() {
  return useLiveQuery(() => listHabits(), []);
}

export function useEntries() {
  return useLiveQuery(() => listEntries(), []);
}

export function useContextTags() {
  return useLiveQuery(() => contextTagsRepository.list(), []);
}

export function useCopingStrategies() {
  return useLiveQuery(() => copingStrategiesRepository.list(), []);
}

/** Settings with defaults filled in; `undefined` while loading. */
export function useSettings() {
  return useLiveQuery(() => getSettings(), []);
}

const toMapById = (items) => new Map((items ?? []).map((item) => [item.id, item]));

/**
 * Everything most pages need, in one call:
 *   const { habits, entries, habitsById, isLoading } = useAppData();
 *
 * The `…ById` Maps make it cheap to look up, say, a habit's name from an
 * entry's `habitId`. `useMemo` rebuilds them only when the lists change.
 */
export function useAppData() {
  const habits = useHabits();
  const entries = useEntries();
  const contextTags = useContextTags();
  const copingStrategies = useCopingStrategies();

  const habitsById = useMemo(() => toMapById(habits), [habits]);
  const tagsById = useMemo(() => toMapById(contextTags), [contextTags]);
  const strategiesById = useMemo(() => toMapById(copingStrategies), [copingStrategies]);

  const isLoading =
    habits === undefined || entries === undefined || contextTags === undefined || copingStrategies === undefined;

  return {
    isLoading,
    habits: habits ?? EMPTY,
    entries: entries ?? EMPTY,
    contextTags: contextTags ?? EMPTY,
    copingStrategies: copingStrategies ?? EMPTY,
    habitsById,
    tagsById,
    strategiesById,
  };
}

// One shared empty array, so "no data yet" does not look like a change on every render.
const EMPTY = Object.freeze([]);
