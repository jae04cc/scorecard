// How many completed games a player needs before the leaderboard ranks them.
//
// Win % is the sort key, and over one or two games it says almost nothing —
// a guest who won their only game would sit at 100% above everyone who has
// actually put the games in. Players under the threshold aren't dropped
// (their record still matters to them); they're listed separately, unranked.
export const DEFAULT_MIN_GAMES_TO_RANK = 5;

// Settings are stored as strings, and the value is admin-editable, so anything
// unparseable falls back to the default rather than ranking nobody. 0 and 1
// both effectively turn the split off, since a player only appears at all once
// they've played a game.
export function parseMinGamesToRank(value: string | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_MIN_GAMES_TO_RANK;
  return parsed;
}
