import type { GameDefinition } from "./types";

// ---------------------------------------------------------------------------
// Catch Five (Trump/Bid card game)
// 4 players on 2 teams. Bid for trump, score points from trump cards.
// ---------------------------------------------------------------------------

export const catchFiveGame: GameDefinition = {
  id: "catch-five",
  name: "Catch Five",
  description: "Bid for trump and score points from trump cards.",
  minPlayers: 4,
  maxPlayers: 4,
  supportsTeams: true,
  playersPerTeam: 2,
  roundName: "Round",
  color: "bg-amber-600",
  emoji: "🖐️",

  winCondition: {
    type: "target",
    targetScore: 100,
    direction: "first-to",
    description: "First team to reach the target score wins.",
  },

  scoreEntry: {
    type: "team-fields",
    allowNegative: true,
    fields: [
      {
        key: "wonBid",
        label: "Won Bid",
        description: "This team won the bidding",
        fieldType: "checkbox",
        exclusive: true,
        defaultValue: 0,
      },
      {
        key: "bid",
        label: "Bid",
        description: "Points bid by this team",
        min: 3,
        max: 9,
        defaultValue: 3,
        homePosition: 3,
        showWhen: { field: "wonBid", value: 1 },
      },
      {
        key: "pointsTaken",
        label: "Points Taken",
        description: "Points captured this round",
        min: 0,
        max: 9,
        defaultValue: 0,
        homePosition: 0,
        hideLabel: true,
      },
    ],
    calculate: (fields) => {
      const wonBid = fields["wonBid"] ?? 0;
      const bid = fields["bid"] ?? 3;
      const pointsTaken = fields["pointsTaken"] ?? 0;
      if (wonBid === 1) {
        return pointsTaken >= bid ? pointsTaken : -bid;
      }
      return pointsTaken;
    },
  },

  validateRound: (entries) => {
    const bidWinners = entries.filter((e) => (e.fields["wonBid"] ?? 0) === 1);
    if (bidWinners.length === 0) return "Select which team won the bid.";
    if (bidWinners.length > 1) return "Only one team can win the bid.";
    const bid = bidWinners[0].fields["bid"] ?? 3;
    if (bid < 3) return "Minimum bid is 3.";
    const totalPoints = entries.reduce((s, e) => s + (e.fields["pointsTaken"] ?? 0), 0);
    if (totalPoints > 9) return `Total points taken cannot exceed 9 (currently ${totalPoints}).`;
    return null;
  },

  computeStandings: (players, scores, settings) => {
    const targetScore = (settings["targetScore"] as number) ?? 100;

    const totals = new Map<string, number>();
    for (const p of players) totals.set(p.id, 0);

    const roundNums = [...new Set(scores.map((s) => s.roundNumber))].sort((a, b) => a - b);

    for (const roundNum of roundNums) {
      const roundScores = scores.filter((s) => s.roundNumber === roundNum);

      // Deduplicate by team
      const metaByTeam = new Map<string, { meta: Record<string, number>; playerIds: string[] }>();
      for (const s of roundScores) {
        if (!totals.has(s.playerId)) continue;
        let meta: Record<string, number> = {};
        try { meta = JSON.parse(s.metadata ?? "{}") as Record<string, number>; } catch { /* skip */ }
        const player = players.find((p) => p.id === s.playerId);
        const teamKey = player?.team ?? s.playerId;
        if (!metaByTeam.has(teamKey)) {
          metaByTeam.set(teamKey, { meta, playerIds: [] });
        }
        metaByTeam.get(teamKey)!.playerIds.push(s.playerId);
      }

      for (const { meta, playerIds } of metaByTeam.values()) {
        const wonBid = meta["wonBid"] ?? 0;
        const bid = meta["bid"] ?? 3;
        const pointsTaken = meta["pointsTaken"] ?? 0;
        const roundScore = wonBid === 1
          ? (pointsTaken >= bid ? pointsTaken : -bid)
          : pointsTaken;
        for (const pid of playerIds) {
          totals.set(pid, (totals.get(pid) ?? 0) + roundScore);
        }
      }
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
      standings[i].isWinning = standings[i].total >= targetScore && rank === 1;
    }

    return standings;
  },

  settings: [
    {
      key: "targetScore",
      label: "Score to Win",
      description: "First team to reach this score wins.",
      type: "number",
      defaultValue: 100,
    },
  ],

  cheatSheet: [
    {
      title: "Trump Scoring (9 pts available)",
      entries: [
        { label: "High (highest trump out)", value: "1 pt" },
        { label: "Low (lowest trump out)", value: "1 pt" },
        { label: "Jack of trump", value: "1 pt" },
        { label: "Five of trump", value: "5 pts" },
        { label: "Game (most game pts)", value: "1 pt" },
      ],
    },
    {
      title: "Game Point Values",
      entries: [
        { label: "Each 10", value: "10 pts" },
        { label: "Each Jack", value: "1 pt" },
        { label: "Each Queen", value: "2 pts" },
        { label: "Each King", value: "3 pts" },
        { label: "Each Ace", value: "4 pts" },
      ],
    },
    {
      title: "Bidding Rules",
      entries: [
        { label: "Minimum bid", value: "3" },
        { label: "To raise", note: "Must go at least 1 higher than current bid" },
        { label: "Dealer", note: "Must take bid if everyone else passes;\nmay take at current bid" },
      ],
    },
    {
      title: "Scoring",
      entries: [
        { label: "Bid team makes bid", note: "Score points taken" },
        { label: "Bid team fails bid", note: "Lose bid amount (go down)" },
        { label: "Non-bid team", note: "Score points taken" },
      ],
    },
  ],
};
