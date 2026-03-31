import type { GameDefinition } from "./types";

export const downforceGame: GameDefinition = {
  id: "downforce",
  name: "Downforce",
  description: "Track your own checkpoint payouts minus auction spend.",
  minPlayers: 1,
  maxPlayers: 1,
  supportsTeams: false,
  roundName: "Checkpoint",
  color: "bg-red-600",
  emoji: "🏎️",

  winCondition: {
    type: "highest",
    description: "Did you end up with more money than you spent?",
  },

  scoreEntry: {
    type: "simple",
    label: "Payout ($)",
    allowNegative: false,
    textInput: true,
  },

  computeStandings: (players, scores, settings) => {
    const auctionSpend = (settings["auctionSpend"] as number) ?? 0;
    const total = scores.reduce((sum, s) => sum + s.score, 0) - auctionSpend;
    return players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      total,
      rank: 1,
      isWinning: false,
    }));
  },

  // auctionSpend is entered in-game via the settings gear, not on the new game screen
  settings: [
    {
      key: "auctionSpend",
      label: "Auction Spend ($)",
      description: "How much you spent buying cars at auction",
      type: "number",
      defaultValue: 0,
      inGameOnly: true,
    },
  ],
};
