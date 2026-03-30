import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Sessions — one per game played
// ---------------------------------------------------------------------------
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  status: text("status", { enum: ["active", "completed", "abandoned"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  // JSON blob for game-specific settings (target score, team mode, etc.)
  settings: text("settings").default("{}"),
  notes: text("notes"),
  // Null for games created before auth was enabled, or when auth is disabled
  userId: text("user_id").references(() => users.id),
});

// ---------------------------------------------------------------------------
// Players within a session
// ---------------------------------------------------------------------------
export const sessionPlayers = sqliteTable("session_players", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Display order (0-indexed)
  position: integer("position").notNull(),
  // Optional: team name for team-based games like Spades
  team: text("team"),
  // Whether this player is still active (soft-delete for "remove player")
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ---------------------------------------------------------------------------
// Rounds — one per hand/round played
// ---------------------------------------------------------------------------
export const rounds = sqliteTable("rounds", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  // Optional label override (e.g. "Final" for last round)
  label: text("label"),
});

// ---------------------------------------------------------------------------
// Scores — one per player per round
// ---------------------------------------------------------------------------
export const roundScores = sqliteTable("round_scores", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  playerId: text("player_id")
    .notNull()
    .references(() => sessionPlayers.id, { onDelete: "cascade" }),
  // The final calculated score delta for this round (positive or negative)
  score: real("score").notNull(),
  // JSON blob for game-specific raw entry data (bids, tricks, card captures, etc.)
  metadata: text("metadata").default("{}"),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  players: many(sessionPlayers),
  rounds: many(rounds),
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const sessionPlayersRelations = relations(
  sessionPlayers,
  ({ one, many }) => ({
    session: one(sessions, {
      fields: [sessionPlayers.sessionId],
      references: [sessions.id],
    }),
    scores: many(roundScores),
  })
);

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  session: one(sessions, {
    fields: [rounds.sessionId],
    references: [sessions.id],
  }),
  scores: many(roundScores),
}));

export const roundScoresRelations = relations(roundScores, ({ one }) => ({
  round: one(rounds, {
    fields: [roundScores.roundId],
    references: [rounds.id],
  }),
  player: one(sessionPlayers, {
    fields: [roundScores.playerId],
    references: [sessionPlayers.id],
  }),
}));

// ---------------------------------------------------------------------------
// Users — created on first OIDC sign-in; first user gets role=admin
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  sub: text("sub").notNull().unique(), // OIDC subject claim (stable identifier)
  email: text("email"),
  name: text("name"),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
});

export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// App-wide settings — key/value store for admin-configured options
// e.g. oidc_enabled, oidc_issuer, oidc_client_id, stats_visibility, auth_secret
// ---------------------------------------------------------------------------
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionPlayer = typeof sessionPlayers.$inferSelect;
export type NewSessionPlayer = typeof sessionPlayers.$inferInsert;
export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type RoundScore = typeof roundScores.$inferSelect;
export type NewRoundScore = typeof roundScores.$inferInsert;
