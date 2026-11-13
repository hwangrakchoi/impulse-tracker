/**
 * One icon per primary emotion category. Together with the text label, the
 * icon means a category is never identified by color alone.
 */
import { Annoyed, CircleHelp, CloudRain, Flame, ShieldAlert, Sun, Zap } from "lucide-react";

const CATEGORY_ICONS = {
  anger: Flame,
  disgust: Annoyed,
  sad: CloudRain,
  happy: Sun,
  surprise: Zap,
  fear: ShieldAlert,
};

export function getCategoryIcon(categoryId) {
  return CATEGORY_ICONS[categoryId] ?? CircleHelp;
}
