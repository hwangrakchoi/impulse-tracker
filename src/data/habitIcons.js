/**
 * Icons a habit can use.
 *
 * A habit stores only the short key (e.g. "wine") in the database. This file
 * maps that key to the actual icon component from the lucide-react library.
 * Storing a key instead of a component keeps the saved data simple text, and
 * lets us swap icon libraries later without touching anyone's records.
 */
import {
  Banknote,
  Bed,
  Beer,
  Candy,
  Cigarette,
  CircleDot,
  Clock,
  CloudFog,
  Coffee,
  Cookie,
  CreditCard,
  Dices,
  EyeOff,
  Flame,
  Gamepad2,
  Heart,
  MessageCircle,
  Moon,
  Pill,
  Pizza,
  ShoppingBag,
  Smartphone,
  Star,
  Tv,
  Utensils,
  Wine,
  Zap,
} from "lucide-react";

export const HABIT_ICONS = [
  { key: "circle-dot", label: "Dot", Icon: CircleDot },
  { key: "wine", label: "Wine glass", Icon: Wine },
  { key: "beer", label: "Beer", Icon: Beer },
  { key: "cloud", label: "Vapor cloud", Icon: CloudFog },
  { key: "cigarette", label: "Cigarette", Icon: Cigarette },
  { key: "eye-off", label: "Hidden eye", Icon: EyeOff },
  { key: "smartphone", label: "Phone", Icon: Smartphone },
  { key: "message", label: "Message", Icon: MessageCircle },
  { key: "tv", label: "Screen", Icon: Tv },
  { key: "gamepad", label: "Game controller", Icon: Gamepad2 },
  { key: "dices", label: "Dice", Icon: Dices },
  { key: "banknote", label: "Cash", Icon: Banknote },
  { key: "shopping-bag", label: "Shopping bag", Icon: ShoppingBag },
  { key: "credit-card", label: "Credit card", Icon: CreditCard },
  { key: "cookie", label: "Cookie", Icon: Cookie },
  { key: "candy", label: "Candy", Icon: Candy },
  { key: "pizza", label: "Pizza", Icon: Pizza },
  { key: "utensils", label: "Cutlery", Icon: Utensils },
  { key: "coffee", label: "Coffee", Icon: Coffee },
  { key: "pill", label: "Pill", Icon: Pill },
  { key: "bed", label: "Bed", Icon: Bed },
  { key: "moon", label: "Moon", Icon: Moon },
  { key: "clock", label: "Clock", Icon: Clock },
  { key: "flame", label: "Flame", Icon: Flame },
  { key: "zap", label: "Lightning", Icon: Zap },
  { key: "heart", label: "Heart", Icon: Heart },
  { key: "star", label: "Star", Icon: Star },
];

const iconsByKey = new Map(HABIT_ICONS.map((entry) => [entry.key, entry]));

/** Returns the icon component for a key, falling back to a neutral dot. */
export function getHabitIconComponent(iconKey) {
  return (iconsByKey.get(iconKey) ?? iconsByKey.get("circle-dot")).Icon;
}

export function isValidHabitIcon(iconKey) {
  return iconsByKey.has(iconKey);
}
