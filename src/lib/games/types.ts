// ---------------------------------------------------------------------------
// Game Definition Types
// ---------------------------------------------------------------------------
// Each game is described by a GameDefinition. To add a new game, create a
// file in src/lib/games/ and register it in src/lib/games/index.ts.
// ---------------------------------------------------------------------------

export type WinCondition =
  | { type: "highest"; targetScore?: number; description?: string }
  | { type: "lowest"; targetScore?: number; description?: string }
  | {
      type: "target";
      targetScore: number;
      // 'first-to': first player to REACH the target wins
      // 'until-exceeded': play until someone EXCEEDS the target, then lowest wins
      direction: "first-to" | "until-exceeded";
      description?: string;
    };

// Describes a single numeric input field for score entry
export interface ScoreField {
  key: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  defaultValue?: number;
  // If true, the field is computed from others and should not be user-editable
  computed?: boolean;
  // Group this field into a numbered entry phase (e.g. 1=bids, 2=results)
  phase?: number;
  // "checkbox" renders a toggle; value stored as 0 (off) or 1 (on)
  fieldType?: "checkbox";
  // Only one target can have this field checked at a time; checking one clears all others
  exclusive?: boolean;
  // Like exclusive, but only enforced when the number of entry targets is even
  exclusiveWhenEven?: boolean;
  // Only render this field when another field in the same target equals a specific value
  showWhen?: { field: string; value: number };
  // Only render this field when a game setting equals a specific value
  showWhenSetting?: { setting: string; value: unknown };
  // Initial scroll position for number pickers (defaults to 5)
  homePosition?: number;
  // When true, the label above this picker is suppressed in the round entry modal
  hideLabel?: boolean;
}

// How score is entered each round
export type ScoreEntryConfig =
  | {
      // Simple: one number per player
      type: "simple";
      label?: string; // e.g. "Score", "Points"
      allowNegative: boolean;
      min?: number;
      max?: number;
      // Use a text input + negative checkbox instead of the bubble picker
      textInput?: boolean;
      // Show a "who triggered the end of round" selector; if selected player isn't lowest, apply triggerPenalty
      triggerPlayer?: boolean;
    }
  | {
      // Fields: multiple inputs per player that combine into a score
      // The game definition provides a calculate() function
      type: "fields";
      fields: ScoreField[];
      allowNegative: boolean;
      calculate: (fields: Record<string, number>) => number;
      // Optional: calculate using game settings for accurate previews (e.g. sweepPoints)
      calculateWithSettings?: (fields: Record<string, number>, settings: Record<string, unknown>) => number;
      // Optional: adjust all targets' fields before computing scores (e.g. tie resolution)
      normalizeFields?: (allTargetFields: Record<string, Record<string, number>>) => Record<string, Record<string, number>>;
    }
  | {
      // Team fields: inputs are per-team, not per-player
      // Scores are distributed to players based on team membership
      type: "team-fields";
      fields: ScoreField[];
      allowNegative: boolean;
      calculate: (fields: Record<string, number>) => number;
      // Optional: calculate using game settings for accurate previews (e.g. sweepPoints)
      calculateWithSettings?: (fields: Record<string, number>, settings: Record<string, unknown>) => number;
      // Optional: adjust all targets' fields before computing scores (e.g. tie resolution)
      normalizeFields?: (allTargetFields: Record<string, Record<string, number>>) => Record<string, Record<string, number>>;
    };

// A section of the scoring cheat sheet
export interface CheatSheetSection {
  title: string;
  // Each entry: label + value or description
  entries: Array<{
    label: string;
    value?: string | number;
    note?: string;
  }>;
}

// Game-configurable settings schema
// Each key maps to a setting that can be shown in the "settings" panel
export interface GameSetting {
  key: string;
  label: string;
  description?: string;
  type: "number" | "boolean" | "select";
  defaultValue: number | boolean | string;
  options?: Array<{ label: string; value: string | number }>;
  // When min and max are set, the UI renders a scrollable picker instead of a text input
  min?: number;
  max?: number;
  // Label to show when the value equals min (e.g. "Disabled" for 0)
  minLabel?: string;
  // Initial scroll position for picker (defaults to min)
  homePosition?: number;
  // Only show this setting when another setting equals a specific value
  showWhen?: { setting: string; value: unknown };
  // If true, only show in the in-game settings modal, not on the new game screen
  inGameOnly?: boolean;
}

// Full game definition — implement this interface to add a new game
export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;

  // Whether this game is played in teams
  supportsTeams: boolean;
  // If supportsTeams, how many players per team
  playersPerTeam?: number;
  // If set, automatically use team mode when exactly this many players are added
  teamsWhenPlayerCount?: number;
  // Number of player input columns in the new game form (default 1)
  playerColumns?: number;

  winCondition: WinCondition;

  // What to call each scoring period (Round, Hand, Lap, Leg...)
  roundName: string;

  scoreEntry: ScoreEntryConfig;

  // Optional: validate a completed round entry before saving
  // Return an error string if invalid, null if OK
  validateRound?: (
    entries: Array<{ playerId: string; fields: Record<string, number> }>,
    settings: Record<string, unknown>
  ) => string | null;

  // Optional: compute running totals with game-specific logic
  // Default behavior: sum all score deltas
  computeStandings?: (
    players: Array<{ id: string; name: string; team?: string | null }>,
    scores: Array<{ playerId: string; score: number; roundNumber: number; metadata?: string }>,
    settings: Record<string, unknown>
  ) => Standing[];

  // Optional: append a label to the round entry modal title (e.g. "Points Scored")
  // Return null to use the default title
  getRoundEntryLabel?: (settings: Record<string, unknown>) => string | null;

  // Optional cheat sheet content — static fallback
  cheatSheet?: CheatSheetSection[];
  // Optional dynamic cheat sheet computed from current game settings
  getCheatSheet?: (settings: Record<string, unknown>, context?: { playerCount?: number }) => CheatSheetSection[];

  // Configurable settings with defaults
  settings: GameSetting[];

  // Color / emoji for visual distinction on the home screen
  color: string; // Tailwind color class e.g. "bg-indigo-600"
  emoji: string;

  // When the win condition target is controlled by a game setting, name the setting key here.
  // The game page uses this to pull the live targetScore for the standings bar.
  targetScoreSettingKey?: string;
}

export interface Standing {
  playerId: string;
  playerName: string;
  team?: string | null;
  total: number;
  rank: number; // 1 = best
  isWinning: boolean;
  // Optional game-specific extras (e.g. bags for Spades)
  extras?: Record<string, unknown>;
}
