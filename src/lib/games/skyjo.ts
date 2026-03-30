import type { GameDefinition } from "./types";

// ---------------------------------------------------------------------------
// Skyjo
// Players try to have the LOWEST total score. Cards range from -2 to 12.
// Game ends when one player flips their last card (trigger round).
// All other players get one more turn. The trigger player gets a penalty
// if they don't have the lowest score that round.
// Play until someone reaches the end score — lowest score at that point wins.
// ---------------------------------------------------------------------------

export const skyjoGame: GameDefinition = {
  id: "skyjo",
  name: "Skyjo",
  description: "Flip cards to get the lowest score. First to 100 ends it.",
  minPlayers: 2,
  maxPlayers: 8,
  supportsTeams: false,
  playerColumns: 2,
  roundName: "Round",
  color: "bg-sky-600",
  emoji: "🎴",
  targetScoreSettingKey: "endScore",

  winCondition: {
    type: "target",
    targetScore: 100,
    direction: "until-exceeded",
    description: "Play until any player reaches 100. Lowest total wins.",
  },

  scoreEntry: {
    type: "simple",
    label: "Round Score",
    allowNegative: true,
    textInput: true,
    triggerPlayer: true,
  },

  settings: [
    {
      key: "endScore",
      label: "End-Game Trigger Score",
      description: "Game ends when any player reaches this total.",
      type: "number",
      defaultValue: 100,
    },
    {
      key: "triggerPenalty",
      label: "Trigger Penalty Multiplier",
      description:
        "If the round-ender doesn't have the lowest round score, multiply their score by this.",
      type: "select",
      defaultValue: 2,
      options: [
        { label: "×2 (standard)", value: 2 },
        { label: "×1.5", value: 1.5 },
        { label: "None", value: 1 },
      ],
    },
  ],

  // Custom standings: respects the endScore setting rather than hardcoded 100
  computeStandings: (players, scores, settings) => {
    const endScore = (settings["endScore"] as number | undefined) ?? 100;

    const totals = new Map<string, number>();
    for (const p of players) totals.set(p.id, 0);
    for (const s of scores) {
      totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.score);
    }

    const standings = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      team: p.team ?? null,
      total: totals.get(p.id) ?? 0,
      rank: 0,
      isWinning: false,
    }));

    // Lowest wins
    standings.sort((a, b) => a.total - b.total);

    // Game over when any player has reached or exceeded the trigger score
    const gameOver = standings.some((s) => s.total >= endScore);

    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (i > 0 && standings[i].total !== standings[i - 1].total) rank = i + 1;
      standings[i].rank = rank;
      standings[i].isWinning = rank === 1 && gameOver;
    }

    return standings;
  },

  getCheatSheet: (settings) => {
    const endScore = (settings["endScore"] as number | undefined) ?? 100;
    const penaltyRaw = (settings["triggerPenalty"] as number | undefined) ?? 2;
    const penaltyLabel =
      penaltyRaw === 1 ? "None (disabled)" : `×${penaltyRaw}`;

    return [
      {
        title: "Card Values",
        entries: [
          { label: "Cards −2", value: "5 cards" },
          { label: "Cards 0", value: "15 cards" },
          { label: "Cards 1–12", value: "10 cards each" },
          { label: "Card range", value: "−2 to 12" },
        ],
      },
      {
        title: "Round End Rules",
        entries: [
          {
            label: "Trigger",
            note: "Flip your last card;\neveryone else gets one more turn",
          },
          {
            label: "Trigger penalty",
            note: `Didn't have the lowest round score?\nYour score ${penaltyLabel}`,
          },
          {
            label: "Column bonus",
            note: "3 identical cards in a column:\ndiscard them (score 0)",
          },
        ],
      },
      {
        title: "Winning",
        entries: [
          { label: "Game ends when", note: `Any player hits ${endScore}+ total` },
          { label: "Winner", note: "Lowest cumulative score wins" },
        ],
      },
    ];
  },
};
