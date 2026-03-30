import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Short, URL-safe IDs (no nanoid dep — use crypto)
export function generateId(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

// Accepts number (ms), Date, or ISO string — JSON deserializes Date to string
type DateLike = Date | number | string | null | undefined;

function toDate(date: DateLike): Date | null {
  if (!date) return null;
  const d = new Date(date as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: DateLike): string {
  const d = toDate(date);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: DateLike): string {
  const d = toDate(date);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(date: DateLike): string {
  const d = toDate(date);
  if (!d) return "—";
  return `${formatDate(d)} - ${formatTime(d)}`;
}

export function formatDuration(start: DateLike, end: DateLike): string {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return "—";
  const totalMinutes = Math.round((e.getTime() - s.getTime()) / 60000);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function pluralize(count: number, word: string, plural?: string): string {
  return count === 1 ? `1 ${word}` : `${count} ${plural ?? word + "s"}`;
}

// Convert a name to Proper Case (trims and collapses internal spaces)
export function toProperCase(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

// Capitalize each word's first letter live while typing (no trim, preserves trailing space)
export function liveProperCase(value: string): string {
  return value
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

// Check for duplicate names (case-insensitive, trimmed) — returns the duplicate name or null
export function findDuplicateName(names: string[]): string | null {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return name.trim();
    seen.add(key);
  }
  return null;
}
