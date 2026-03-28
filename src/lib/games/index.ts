import type { GameDefinition, Standing } from "./types";
import { spadesGame } from "./spades";
import { casinoGame } from "./casino";
import { skyjoGame } from "./skyjo";
import { catchFiveGame } from "./catch-five";
// ---------------------------------------------------------------------------
// Game Registry
// To add a new game: import its definition here and add it to this array.
// ---------------------------------------------------------------------------
const gameRegistry: GameDefinition[] = [
  spadesGame,
  casinoGame,
  skyjoGame,
  catchFiveGame,
];

export const games: ReadonlyMap<string, GameDefinition> = new Map(
  gameRegistry.map((g) => [g.id, g])
);

export function getGame(id: string): GameDefinition | undefined {
  return games.get(id);
}

export function getAllGames(): GameDefinition[] {
  return gameRegistry;
}

// Compute standings using the game's custom logic, or fall back to default
export function computeStandings(
  game: GameDefinition,
  players: Array<{ id: string; name: string; team?: string | null }>,
  scores: Array<{ playerId: string; score: number; roundNumber: number; metadata?: string }>,
  settings: Record<string, unknown>
): Standing[] {
  if (game.computeStandings) {
    return game.computeStandings(players, scores, settings);
  }

  // Default: sum all scores; rank by win condition direction
  const totals = new Map<string, number>();
  for (const p of players) totals.set(p.id, 0);
  for (const s of scores) {
    totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.score);
  }

  const standings: Standing[] = players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    team: p.team,
    total: totals.get(p.id) ?? 0,
    rank: 0,
    isWinning: false,
  }));

  const winCondition = game.winCondition;
  const isUntilExceeded = winCondition.type === "target" &&
    (winCondition as { direction?: string }).direction === "until-exceeded";
  // Lowest-wins: explicit "lowest" type, or "until-exceeded" target (play until someone hits target, lowest wins)
  const isLowest = winCondition.type === "lowest" || isUntilExceeded;
  const targetScore = (winCondition as { targetScore?: number }).targetScore;

  standings.sort((a, b) => (isLowest ? a.total - b.total : b.total - a.total));

  // For until-exceeded: game is over when any player has reached (or exceeded) the target
  const gameOver = isUntilExceeded && targetScore !== undefined &&
    standings.some((s) => s.total >= targetScore);

  let rank = 1;
  for (let i = 0; i < standings.length; i++) {
    if (i > 0 && standings[i].total !== standings[i - 1].total) rank = i + 1;
    standings[i].rank = rank;
    if (isUntilExceeded) {
      // Rank 1 (lowest) wins only once the game is over
      standings[i].isWinning = rank === 1 && gameOver;
    } else {
      standings[i].isWinning = rank === 1 && (targetScore === undefined || standings[i].total >= targetScore);
    }
  }

  return standings;
}

export type { GameDefinition, Standing };
export type { WinCondition, ScoreEntryConfig, CheatSheetSection, GameSetting } from "./types";
