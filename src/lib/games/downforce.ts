import type { GameDefinition } from "./types";

// ---------------------------------------------------------------------------
// Downforce (Board Game — Restoration Games)
// Players bid for cars, then play speed cards to move them.
// After checkpoints, payouts are made. Final payouts after race finishes.
// Score = total payouts received minus amount paid for cars at auction.
// Highest score wins.
//
// Scoring model here is simplified for score tracking:
// Each "round" represents a payout checkpoint (up to 3 checkpoints + final).
// Players enter their payout for each checkpoint.
// Net score = sum of payouts − auction spend (entered at game start).
// ---------------------------------------------------------------------------

export const downforceGame: GameDefinition = {
  id: "downforce",
  name: "Downforce",
  description:
    "Bid on racing cars, play speed cards, collect checkpoint payouts.",
  minPlayers: 2,
  maxPlayers: 6,
  supportsTeams: false,
  roundName: "Checkpoint",
  color: "bg-red-600",
  emoji: "🏎️",

  winCondition: {
    type: "highest",
    description: "Most money at the end wins.",
  },

  scoreEntry: {
    type: "fields",
    allowNegative: false,
    fields: [
      {
        key: "payout",
        label: "Payout Received ($)",
        description: "Total payout from betting cards at this checkpoint",
        min: 0,
        max: 99999,
        defaultValue: 0,
      },
    ],
    calculate: (fields) => fields["payout"] ?? 0,
  },

  // Note: auction spend is tracked in session settings as a per-player starting value
  // The computeStandings function subtracts it from running totals.
  computeStandings: (players, scores, settings) => {
    const auctionSpend: Record<string, number> =
      (settings["auctionSpend"] as Record<string, number>) ?? {};

    const totals = new Map<string, number>();
    for (const p of players) {
      totals.set(p.id, -(auctionSpend[p.id] ?? 0));
    }

    for (const score of scores) {
      totals.set(score.playerId, (totals.get(score.playerId) ?? 0) + score.score);
    }

    const standings = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team,
      total: totals.get(p.id) ?? 0,
      rank: 0,
      isWinning: false,
    }));

    standings.sort((a, b) => b.total - a.total);
    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].total !== standings[i - 1].total) rank = i + 1;
      standings[i].rank = rank;
      standings[i].isWinning = rank === 1;
    }

    return standings;
  },

  settings: [
    // auctionSpend is set per-player at the start of the game (not a global setting)
    // It's stored in session.settings as { auctionSpend: { [playerId]: number } }
    // TODO: Add a per-player setup step to enter auction spend at game start
  ],

  cheatSheet: [
    {
      title: "Game Flow",
      entries: [
        { label: "Auction", note: "Bid money to buy cars (2–3 per player)" },
        { label: "Race", note: "Play speed cards to advance your cars" },
        { label: "Checkpoints", value: "3 + final", note: "Payouts at each" },
        { label: "Payout cards", note: "Bet slips show value per finishing position" },
      ],
    },
    {
      title: "Scoring",
      entries: [
        { label: "Score", value: "Payouts − Auction spend" },
        { label: "Payouts", note: "Collected at 3 checkpoints + race end" },
        { label: "Highest score wins" },
      ],
    },
    {
      title: "Car Values by Position",
      entries: [
        { label: "1st place", value: "Highest payout" },
        { label: "2nd place", value: "Second highest" },
        { label: "Position matters", note: "Check your betting cards for exact amounts" },
      ],
    },
  ],
};
