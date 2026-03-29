import type { GameDefinition } from "./types";

// ---------------------------------------------------------------------------
// Casino (Card game)
// Players capture cards from a center layout by matching or building.
// Points scored from captured cards at end of play.
// ---------------------------------------------------------------------------

export const casinoGame: GameDefinition = {
  id: "casino",
  name: "Casino",
  description: "Capture cards from the table to score points.",
  minPlayers: 2,
  maxPlayers: 4,
  supportsTeams: false,
  playersPerTeam: 2,
  teamsWhenPlayerCount: 4,
  playerColumns: 2,
  roundName: "Hand",
  color: "bg-emerald-600",
  emoji: "🃏",

  winCondition: {
    type: "target",
    targetScore: 21,
    direction: "first-to",
    description: "First player to 21 points wins.",
  },

  scoreEntry: {
    type: "team-fields",
    allowNegative: false,
    fields: [
      // Simple scoring mode: one picker for total points
      {
        key: "pointsScored",
        label: "Points Scored",
        description: "Total points captured this hand",
        min: 0,
        max: 11,
        defaultValue: 0,
        homePosition: 0,
        showWhenSetting: { setting: "simpleScoring", value: true },
      },
      // Normal scoring mode: individual card bonuses
      {
        key: "mostCards",
        label: "Most Cards",
        description: "Captured the most cards (+3 pts)",
        fieldType: "checkbox",
        defaultValue: 0,
        showWhenSetting: { setting: "simpleScoring", value: false },
      },
      {
        key: "mostSpades",
        label: "Most Spades",
        description: "Captured the most spades (+1 pt)",
        fieldType: "checkbox",
        defaultValue: 0,
        showWhenSetting: { setting: "simpleScoring", value: false },
      },
      {
        key: "bigCasino",
        label: "Big Casino",
        description: "10 of Diamonds (+2 pts)",
        fieldType: "checkbox",
        exclusive: true,
        defaultValue: 0,
        showWhenSetting: { setting: "simpleScoring", value: false },
      },
      {
        key: "littleCasino",
        label: "Little Casino",
        description: "2 of Spades (+1 pt)",
        fieldType: "checkbox",
        exclusive: true,
        defaultValue: 0,
        showWhenSetting: { setting: "simpleScoring", value: false },
      },
      {
        key: "aces",
        label: "Aces",
        description: "Each ace = 1 point",
        min: 0,
        max: 4,
        defaultValue: 0,
        homePosition: 0,
        showWhenSetting: { setting: "simpleScoring", value: false },
      },
      // Sweeps: shown in both modes when countSweeps is enabled
      {
        key: "sweeps",
        label: "Sweeps",
        description: "Each sweep (clearing the table)",
        min: 0,
        max: 26,
        defaultValue: 0,
        homePosition: 0,
        showWhenSetting: { setting: "countSweeps", value: true },
      },
    ],
    calculate: (fields) => {
      // Fallback (no settings context): sum all known fields
      let score = 0;
      score += fields["pointsScored"] ?? 0;
      score += (fields["mostCards"] ?? 0) * 3;
      score += (fields["mostSpades"] ?? 0) * 1;
      score += (fields["bigCasino"] ?? 0) * 2;
      score += (fields["littleCasino"] ?? 0) * 1;
      score += fields["aces"] ?? 0;
      score += fields["sweeps"] ?? 0;
      return score;
    },
    calculateWithSettings: (fields, settings) => {
      const simpleScoring = (settings["simpleScoring"] as boolean) ?? true;
      const countSweeps = (settings["countSweeps"] as boolean) ?? false;
      const sweepPoints = (settings["sweepPoints"] as number) ?? 1;
      let score = 0;
      if (simpleScoring) {
        score += fields["pointsScored"] ?? 0;
      } else {
        score += (fields["mostCards"] ?? 0) * 3;
        score += (fields["mostSpades"] ?? 0) * 1;
        score += (fields["bigCasino"] ?? 0) * 2;
        score += (fields["littleCasino"] ?? 0) * 1;
        score += fields["aces"] ?? 0;
      }
      if (countSweeps) score += (fields["sweeps"] ?? 0) * sweepPoints;
      return score;
    },
    normalizeFields: (allTargetFields) => {
      // Only applies in normal scoring mode (simple mode has no mostCards/mostSpades)
      const vals = Object.values(allTargetFields);
      const mostCardsChecked = vals.filter((f) => f["mostCards"]).length;
      const mostSpadesChecked = vals.filter((f) => f["mostSpades"]).length;
      if (mostCardsChecked <= 1 && mostSpadesChecked <= 1) return allTargetFields;
      const result: Record<string, Record<string, number>> = {};
      for (const [key, fields] of Object.entries(allTargetFields)) {
        result[key] = {
          ...fields,
          mostCards: mostCardsChecked > 1 ? 0 : fields["mostCards"] ?? 0,
          mostSpades: mostSpadesChecked > 1 ? 0 : fields["mostSpades"] ?? 0,
        };
      }
      return result;
    },
  },

  validateRound: (entries, settings) => {
    const simpleScoring = (settings["simpleScoring"] as boolean) ?? true;

    if (simpleScoring) {
      return null;
    }

    // Normal scoring: require exactly one Big Casino, one Little Casino, exactly 4 aces
    const bigCount = entries.reduce((s, e) => s + (e.fields["bigCasino"] ?? 0), 0);
    const littleCount = entries.reduce((s, e) => s + (e.fields["littleCasino"] ?? 0), 0);
    const aceCount = entries.reduce((s, e) => s + (e.fields["aces"] ?? 0), 0);

    if (bigCount === 0) return "Someone must have the Big Casino (10♦).";
    if (bigCount > 1) return "Only one player can have the Big Casino (10♦).";
    if (littleCount === 0) return "Someone must have the Little Casino (2♠).";
    if (littleCount > 1) return "Only one player can have the Little Casino (2♠).";
    if (aceCount !== 4) return `Aces must total exactly 4 (currently ${aceCount}).`;

    return null;
  },

  computeStandings: (players, scores, settings) => {
    const targetScore = (settings["targetScore"] as number) ?? 21;
    const simpleScoring = (settings["simpleScoring"] as boolean) ?? true;
    const countSweeps = (settings["countSweeps"] as boolean) ?? false;
    const sweepPoints = (settings["sweepPoints"] as number) ?? 1;

    const totals = new Map<string, number>();
    for (const p of players) totals.set(p.id, 0);

    const roundNums = Array.from(new Set(scores.map((s) => s.roundNumber))).sort((a, b) => a - b);

    for (const roundNum of roundNums) {
      const roundScores = scores.filter((s) => s.roundNumber === roundNum);

      // Parse metadata per player, deduplicate by team to avoid double-counting
      const metaByPlayer = new Map<string, Record<string, number>>();
      for (const s of roundScores) {
        if (!totals.has(s.playerId)) continue;
        try {
          metaByPlayer.set(s.playerId, JSON.parse(s.metadata ?? "{}") as Record<string, number>);
        } catch { /* skip */ }
      }

      const metaByTeam = new Map<string, { meta: Record<string, number>; playerIds: string[] }>();
      for (const [playerId, meta] of metaByPlayer) {
        const player = players.find((p) => p.id === playerId);
        const teamKey = player?.team ?? playerId;
        if (!metaByTeam.has(teamKey)) {
          metaByTeam.set(teamKey, { meta, playerIds: [] });
        }
        metaByTeam.get(teamKey)!.playerIds.push(playerId);
      }

      // Tie detection only matters in normal scoring mode
      const mostCardsChecked = simpleScoring ? 0
        : [...metaByTeam.values()].filter((t) => t.meta["mostCards"]).length;
      const mostSpadesChecked = simpleScoring ? 0
        : [...metaByTeam.values()].filter((t) => t.meta["mostSpades"]).length;

      for (const { meta, playerIds } of metaByTeam.values()) {
        let handScore = 0;
        if (simpleScoring) {
          handScore += meta["pointsScored"] ?? 0;
        } else {
          if (mostCardsChecked === 1) handScore += (meta["mostCards"] ?? 0) * 3;
          if (mostSpadesChecked === 1) handScore += (meta["mostSpades"] ?? 0) * 1;
          handScore += (meta["bigCasino"] ?? 0) * 2;
          handScore += (meta["littleCasino"] ?? 0) * 1;
          handScore += meta["aces"] ?? 0;
        }
        if (countSweeps) handScore += (meta["sweeps"] ?? 0) * sweepPoints;
        for (const pid of playerIds) {
          totals.set(pid, (totals.get(pid) ?? 0) + handScore);
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
      label: "Target Score",
      description: "First player to reach this score wins.",
      type: "number",
      defaultValue: 21,
    },
    {
      key: "simpleScoring",
      label: "Simple Scoring",
      description: "Enter total points captured per hand.",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "countSweeps",
      label: "Count Sweeps",
      description: "Award points per sweep (clearing the table).",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "sweepPoints",
      label: "Points per Sweep",
      description: "How many points each sweep is worth.",
      type: "number",
      defaultValue: 1,
      showWhen: { setting: "countSweeps", value: true },
    },
  ],

  getRoundEntryLabel: (settings) => {
    const simpleScoring = (settings["simpleScoring"] as boolean) !== false;
    return simpleScoring ? "Points Scored" : null;
  },

  getCheatSheet: (settings, context) => {
    const simpleScoring = (settings["simpleScoring"] as boolean) ?? true;
    const countSweeps = (settings["countSweeps"] as boolean) ?? false;
    const sweepPoints = (settings["sweepPoints"] as number) ?? 1;
    const targetScore = (settings["targetScore"] as number) ?? 21;
    const scoringEntries: Array<{ label: string; value?: string | number; note?: string }> = [
      { label: "Most cards", value: "3 pts" },
      { label: "Most spades", value: "1 pt" },
      { label: "Big Casino (10♦)", value: "2 pts" },
      { label: "Little Casino (2♠)", value: "1 pt" },
      { label: "Each ace", value: "1 pt" },
    ];
    if (countSweeps) {
      scoringEntries.push({ label: "Each sweep", value: `${sweepPoints} pt${sweepPoints !== 1 ? "s" : ""}` });
    }

    const notesEntries: Array<{ label: string; value?: string | number; note?: string }> = [
      { label: "Total points available", value: countSweeps ? "11 (+ sweeps)" : "11" },
      { label: "Most cards/spades tied", note: "No points awarded" },
      { label: "Target to win", value: `${targetScore} pts` },
    ];

    return [
      { title: "Scoring", entries: scoringEntries },
      { title: "Notes", entries: notesEntries },
    ];
  },
};
