import type { GameDefinition } from "./types";

export const customGame: GameDefinition = {
  id: "custom",
  name: "Custom",
  description: "Track scores for any game, round by round.",
  minPlayers: 2,
  maxPlayers: 16,
  supportsTeams: false,
  playerColumns: 2,
  roundName: "Round",
  color: "bg-slate-600",
  emoji: "🎲",

  winCondition: {
    type: "highest",
    description: "Highest score wins by default.",
  },

  scoreEntry: {
    type: "simple",
    label: "Score",
    allowNegative: true,
    textInput: true,
  },

  computeStandings: (players, scores, settings) => {
    const lowerWins = settings["lowerWins"] === true;
    const targetScore = typeof settings["targetScore"] === "number" && (settings["targetScore"] as number) > 0
      ? (settings["targetScore"] as number)
      : undefined;

    const totals = new Map<string, number>();
    for (const p of players) totals.set(p.id, 0);
    for (const s of scores) {
      totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.score);
    }

    const standings = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      total: totals.get(p.id) ?? 0,
      rank: 0,
      isWinning: false,
    }));

    standings.sort((a, b) => lowerWins ? a.total - b.total : b.total - a.total);

    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].total !== standings[i - 1].total) rank = i + 1;
      standings[i].rank = rank;
      standings[i].isWinning = rank === 1 && scores.length > 0 &&
        (targetScore === undefined || standings[i].total >= targetScore);
    }

    return standings;
  },

  settings: [
    {
      key: "targetScore",
      label: "Winning Score",
      description: "First to reach this score wins. Leave at 0 for no limit.",
      type: "number",
      defaultValue: 0,
    },
    {
      key: "lowerWins",
      label: "Lower score wins",
      type: "boolean",
      defaultValue: false,
    },
  ],
};
