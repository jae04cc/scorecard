import type { GameDefinition } from "./types";

const RACING_PAYOUTS = [12, 9, 6, 4, 2, 0]; // index 0 = 1st place
const BETTING_PAYOUTS = [
  [9, 6, 3, 0, 0, 0], // Bet 1
  [6, 4, 2, 0, 0, 0], // Bet 2
  [3, 2, 1, 0, 0, 0], // Bet 3
];

export const downforceGame: GameDefinition = {
  id: "downforce",
  name: "Downforce",
  description: "Personal scorecard — track your auction spend, bets, and racing payouts.",
  minPlayers: 1,
  maxPlayers: 1,
  supportsTeams: false,
  roundName: "Phase",
  color: "bg-red-600",
  emoji: "🏎️",

  winCondition: {
    type: "highest",
    description: "Earn the most after subtracting auction spend",
  },

  scoreEntry: {
    type: "simple",
    label: "Score",
    allowNegative: true,
  },

  // Reads from df_ settings keys written by DownforceScorecard
  computeStandings: (players, _scores, settings) => {
    const ownedCars: string[] = JSON.parse((settings["df_ownedCars"] as string) ?? "[]");
    const costs: Record<string, number> = JSON.parse((settings["df_costs"] as string) ?? "{}");
    const bets = [
      settings["df_bet1"] as string | undefined,
      settings["df_bet2"] as string | undefined,
      settings["df_bet3"] as string | undefined,
    ];
    const places: Record<string, number> = JSON.parse((settings["df_places"] as string) ?? "{}");

    const racingTotal = ownedCars.reduce((sum, car) => {
      const place = places[car];
      return sum + (place >= 1 && place <= 6 ? RACING_PAYOUTS[place - 1] : 0);
    }, 0);

    const bettingTotal = bets.reduce((sum, bet, i) => {
      if (!bet || !places[bet]) return sum;
      const place = places[bet];
      return sum + (place >= 1 && place <= 6 ? BETTING_PAYOUTS[i][place - 1] : 0);
    }, 0);

    const auctionTotal = Object.values(costs).reduce((s, c) => s + c, 0);
    const net = racingTotal + bettingTotal - auctionTotal;

    return players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      total: net,
      rank: 1,
      isWinning: net > 0,
    }));
  },

  settings: [],
};
