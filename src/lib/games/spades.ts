import type { GameDefinition, Standing } from "./types";

// ---------------------------------------------------------------------------
// Spades
// Played in 2 teams of 2. Each round: both teams bid, then play tricks.
// Scoring: made bid = bid * 10 + overtricks (bags).
// Nil bid (0) = +100 if successful, -100 if failed.
// Bags accumulate; every 10 bags = -100 penalty (configurable).
// First team to reach target score (default 500) wins.
// TODO: Blind nil (bid before seeing cards) = +200/-200 — stub for later
// ---------------------------------------------------------------------------

export const spadesGame: GameDefinition = {
  id: "spades",
  name: "Spades",
  description: "Classic trick-taking card game played in two teams.",
  minPlayers: 4,
  maxPlayers: 4,
  supportsTeams: true,
  playersPerTeam: 2,
  roundName: "Hand",
  color: "bg-indigo-600",
  emoji: "♠️",

  winCondition: {
    type: "target",
    targetScore: 500,
    direction: "first-to",
    description: "First team to 500 points wins.",
  },

  // Score entry is per-team: bid + optional nil + tricks taken
  scoreEntry: {
    type: "team-fields",
    allowNegative: true,
    fields: [
      {
        key: "bid",
        label: "Bid",
        description: "Number of tricks the non-nil player bid",
        min: 0,
        max: 13,
        defaultValue: 0,
        phase: 1,
      },
      {
        key: "nilBid",
        label: "Nil Bid",
        fieldType: "checkbox",
        defaultValue: 0,
        phase: 1,
      },
      {
        key: "tricks",
        label: "Tricks Taken",
        description: "Total tricks taken by the team",
        min: 0,
        max: 13,
        defaultValue: 0,
        phase: 2,
        hideLabel: true,
      },
      {
        key: "nilSuccess",
        label: "Nil ✓",
        fieldType: "checkbox",
        defaultValue: 0,
        phase: 2,
        showWhen: { field: "nilBid", value: 1 },
      },
    ],
    calculate: (fields) => {
      // NOTE: computeStandings fully recalculates from metadata using actual settings.
      // This calculate() is only used for the live preview in the modal (uses default nilBidValue=30).
      const bid = fields["bid"] ?? 0;
      const tricks = fields["tricks"] ?? 0;
      const nilBid = fields["nilBid"] ?? 0;
      const nilSuccess = fields["nilSuccess"] ?? 0;

      let score = 0;

      // Main bid scoring
      if (bid > 0) {
        if (tricks >= bid) {
          score += bid * 10 + (tricks - bid);
        } else {
          score -= bid * 10;
        }
      }

      // Nil scoring — independent of bid/tricks (default nilBidValue = 30)
      if (nilBid === 1) {
        score += nilSuccess === 1 ? 30 : -30;
      }

      return score;
    },
  },

  validateRound: (entries) => {
    // Teams together must have bid between 0–13 tricks and taken exactly 13 tricks total
    // (In a 4-player game there are always 13 tricks per hand)
    const totalTricks = entries.reduce(
      (sum, e) => sum + (e.fields["tricks"] ?? 0),
      0
    );
    if (totalTricks !== 13) {
      return `Total tricks taken must equal 13 (got ${totalTricks}).`;
    }
    return null;
  },

  computeStandings: (players, scores, settings) => {
    const targetScore = (settings["targetScore"] as number) ?? 500;
    const bagPenaltyAt = (settings["bagPenaltyAt"] as number) ?? 10;
    const nilBidValue = (settings["nilBidValue"] as number) ?? 30;

    // Group players by team
    const teams = new Map<string, string[]>();
    for (const p of players) {
      const team = p.team ?? p.id;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team)!.push(p.id);
    }

    const teamTotals = new Map<string, { score: number; bags: number }>();
    for (const [team] of teams) {
      teamTotals.set(team, { score: 0, bags: 0 });
    }

    // Accumulate team scores — count only ONE score per team per round
    // (all team members store the same score, so summing all would double-count)
    const seenTeamRounds = new Set<string>();
    const sortedScores = [...scores].sort((a, b) => a.roundNumber - b.roundNumber);

    for (const score of sortedScores) {
      const player = players.find((p) => p.id === score.playerId);
      if (!player) continue;
      const team = player.team ?? player.id;
      const roundKey = `${team}:${score.roundNumber}`;
      if (seenTeamRounds.has(roundKey)) continue;
      seenTeamRounds.add(roundKey);

      const t = teamTotals.get(team);
      if (!t) continue;

      // Parse metadata for bid/tricks/nil
      let bid = 0, tricks = 0, nilBid = 0, nilSuccess = 0;
      if (score.metadata) {
        try {
          const meta = JSON.parse(score.metadata) as Record<string, number>;
          bid = meta["bid"] ?? 0;
          tricks = meta["tricks"] ?? 0;
          nilBid = meta["nilBid"] ?? 0;
          nilSuccess = meta["nilSuccess"] ?? 0;
        } catch { /* skip malformed */ }
      }

      // Main bid scoring — fully recalculated from metadata
      if (bid > 0) {
        if (tricks >= bid) {
          const overtricks = tricks - bid;
          t.score += bid * 10 + overtricks;
          // Bag tracking
          if (overtricks > 0) {
            const bagsBefore = t.bags;
            t.bags += overtricks;
            if (bagPenaltyAt > 0) {
              const penaltiesBefore = Math.floor(bagsBefore / bagPenaltyAt);
              const penaltiesAfter = Math.floor(t.bags / bagPenaltyAt);
              if (penaltiesAfter > penaltiesBefore) {
                t.score -= (penaltiesAfter - penaltiesBefore) * 100;
              }
            }
          }
        } else {
          t.score -= bid * 10;
        }
      }

      // Nil scoring — independent of main bid/tricks
      if (nilBid === 1) {
        t.score += nilSuccess === 1 ? nilBidValue : -nilBidValue;
      }
    }

    const standings: Standing[] = [];
    for (const p of players) {
      const team = p.team ?? p.id;
      const t = teamTotals.get(team) ?? { score: 0, bags: 0 };
      standings.push({
        playerId: p.id,
        playerName: p.name,
        team: p.team,
        total: t.score,
        rank: 0,
        isWinning: false,
        extras: {
          bags: t.bags,
          bagPenalty: bagPenaltyAt > 0 ? Math.floor(t.bags / bagPenaltyAt) * 100 : 0,
        },
      });
    }

    // Rank: highest score wins (first-to-target)
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
      label: "Target Score",
      description: "First team to reach this score wins.",
      type: "number",
      defaultValue: 500,
    },
    {
      key: "nilBidValue",
      label: "Nil Bid Value",
      description: "Points awarded for a successful nil bid (same amount deducted on failure).",
      type: "number",
      defaultValue: 30,
    },
    {
      key: "bagPenaltyAt",
      label: "Bag Penalty Threshold",
      description: "Lose 100 points after accumulating this many bags.",
      type: "number",
      defaultValue: 10,
      min: 0,
      max: 20,
      minLabel: "Disabled",
      homePosition: 10,
    },
  ],

  getCheatSheet: (settings) => {
    const nilBidValue = (settings["nilBidValue"] as number) ?? 30;
    const targetScore = (settings["targetScore"] as number) ?? 500;
    const bagPenaltyAt = (settings["bagPenaltyAt"] as number) ?? 10;
    return [
      {
        title: "Scoring",
        entries: [
          { label: "Made bid", value: "Bid × 10 + overtricks" },
          { label: "Set (failed bid)", value: "−(Bid × 10)" },
          { label: "Nil bid (succeeded)", value: `+${nilBidValue}` },
          { label: "Nil bid (failed)", value: `−${nilBidValue}` },
          { label: "Bags (overtricks)", note: bagPenaltyAt > 0 ? `${bagPenaltyAt} bags = −100 penalty` : "Penalty disabled" },
        ],
      },
      {
        title: "Rules",
        entries: [
          { label: "Tricks per hand", value: "13" },
          { label: "Teams", value: "2 teams of 2" },
          { label: "Target score", value: `${targetScore} points` },
          { label: "Spades", value: "Spades always trump", note: "Cannot be led until broken" },
        ],
      },
    ];
  },

  cheatSheet: [
    {
      title: "Scoring",
      entries: [
        { label: "Made bid", value: "Bid × 10 + overtricks" },
        { label: "Set (failed bid)", value: "−(Bid × 10)" },
        { label: "Nil bid (0 tricks taken)", value: "+30" },
        { label: "Nil bid (tricks taken)", value: "−30" },
        { label: "Bags (overtricks)", note: "10 bags = −100 penalty" },
      ],
    },
    {
      title: "Rules",
      entries: [
        { label: "Tricks per hand", value: "13" },
        { label: "Teams", value: "2 teams of 2" },
        { label: "Target score", value: "500 points" },
        { label: "Spades", value: "Spades always trump", note: "Cannot be led until broken" },
      ],
    },
  ],
};
