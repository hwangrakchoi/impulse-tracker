/**
 * Context tags and coping strategies are both simple "named lists":
 * { id, name }. Instead of writing the same code twice, this file has one
 * factory function that builds a repository for either table.
 */
import { db } from "./database.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/dates.js";
import { cleanName, nameKey } from "../utils/text.js";

export const NAMED_ITEM_MAX_LENGTH = 40;

/**
 * @param {"contextTags"|"copingStrategies"} tableName   table holding the items
 * @param {"contextTagIds"|"copingStrategyIds"} entryField  entry field that references them
 * @param {string} noun  word used in error messages ("tag" / "strategy")
 */
function createNamedListRepository(tableName, entryField, noun) {
  const table = () => db.table(tableName);

  function validateName(rawName) {
    const name = cleanName(rawName);
    if (!name) throw new ValidationError(`Enter a name for the ${noun}.`, { name: `Enter a name for the ${noun}.` });
    if (name.length > NAMED_ITEM_MAX_LENGTH) {
      const message = `Keep the name under ${NAMED_ITEM_MAX_LENGTH} characters.`;
      throw new ValidationError(message, { name: message });
    }
    return name;
  }

  async function findByName(name) {
    const items = await table().toArray();
    return items.find((item) => nameKey(item.name) === nameKey(name));
  }

  return {
    /** All items, alphabetically. */
    async list() {
      const items = await table().toArray();
      return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    },

    /**
     * Adds an item. If one with the same name already exists (ignoring
     * capitals), that existing item is returned instead of a duplicate.
     */
    async create(rawName) {
      const name = validateName(rawName);
      const existing = await findByName(name);
      if (existing) return existing;
      const timestamp = nowIso();
      const item = { id: createId(), name, createdAt: timestamp, updatedAt: timestamp };
      await table().add(item);
      return item;
    },

    async rename(itemId, rawName) {
      const name = validateName(rawName);
      const clash = await findByName(name);
      if (clash && clash.id !== itemId) {
        const message = `You already have a ${noun} called "${clash.name}".`;
        throw new ValidationError(message, { name: message });
      }
      const changed = await table().update(itemId, { name, updatedAt: nowIso() });
      if (changed === 0) throw new NotFoundError(`That ${noun} no longer exists.`);
      return table().get(itemId);
    },

    /** How many entries use this item – shown before deleting it. */
    async countUsage(itemId) {
      return db.entries.where(entryField).equals(itemId).count();
    },

    /**
     * Deletes the item and removes it from every entry that used it. The
     * entries themselves are kept. Runs as one all-or-nothing transaction.
     */
    async remove(itemId) {
      return db.transaction("rw", table(), db.entries, async () => {
        const timestamp = nowIso();
        const affectedEntryCount = await db.entries
          .where(entryField)
          .equals(itemId)
          .modify((entry) => {
            entry[entryField] = entry[entryField].filter((id) => id !== itemId);
            entry.updatedAt = timestamp;
          });
        await table().delete(itemId);
        return { affectedEntryCount };
      });
    },
  };
}

export const contextTagsRepository = createNamedListRepository("contextTags", "contextTagIds", "tag");
export const copingStrategiesRepository = createNamedListRepository(
  "copingStrategies",
  "copingStrategyIds",
  "strategy",
);
