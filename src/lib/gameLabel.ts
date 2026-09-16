import { getGame } from "@/lib/games";

// ---------------------------------------------------------------------------
// Resolves how a session should be labelled and grouped.
//
// Custom games carry a user-supplied `customName` in their settings blob (e.g.
// "Mahjong", "Smash Up"). Everywhere a game name, emoji, or leaderboard group
// is shown, a named custom game should behave as if it were its own built-in
// game rather than lumping in with every other "Custom" session.
//
// `groupKey` is what the leaderboard groups by. For custom games it is derived
// from the lower-cased name so "Mahjong" / "mahjong" / "MAHJONG" merge into one
// group; the built-in games just group by their id.
// ---------------------------------------------------------------------------

export interface ResolvedGameLabel {
  name: string;
  emoji: string;
  groupKey: string;
}

// Settings reach us as a parsed object in some places and a JSON string in
// others — accept either and never throw on malformed input.
function readCustomName(settings: unknown): string | null {
  let obj: unknown = settings;
  if (typeof settings === "string") {
    try {
      obj = JSON.parse(settings || "{}");
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const value = (obj as Record<string, unknown>).customName;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getCustomName(settings: unknown): string | null {
  return readCustomName(settings);
}

export function gameLabel(gameId: string, settings: unknown): ResolvedGameLabel {
  const game = getGame(gameId);
  const emoji = game?.emoji ?? "🎮";

  if (gameId === "custom") {
    const custom = readCustomName(settings);
    if (custom) {
      return { name: custom, emoji, groupKey: `custom:${custom.toLowerCase()}` };
    }
  }

  return { name: game?.name ?? gameId, emoji, groupKey: gameId };
}
