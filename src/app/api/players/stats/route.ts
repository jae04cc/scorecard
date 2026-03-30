import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings, sessions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { computeStandings, getGame } from "@/lib/games";
import { auth } from "@/auth";

export async function GET() {
  try {
    const authSession = await auth();
    const userId = authSession?.user.id ?? null;
    const isAdmin = authSession?.user.role === "admin";

    // Read stats_visibility setting
    const visibilityRow = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "stats_visibility"),
    });
    const statsVisibility = visibilityRow?.value ?? "global";

    // When scoped: regular users only see sessions they own
    const ownershipFilter =
      statsVisibility === "scoped" && userId && !isAdmin
        ? eq(sessions.userId, userId)
        : undefined;

    const completedFilter = eq(sessions.status, "completed");
    const where = ownershipFilter
      ? and(completedFilter, ownershipFilter)
      : completedFilter;

    const completedSessions = await db.query.sessions.findMany({
      where,
      with: {
        players: { orderBy: (p, { asc }) => [asc(p.position)] },
        rounds: {
          orderBy: (r, { asc }) => [asc(r.roundNumber)],
          with: { scores: true },
        },
      },
    });

    const playerStats = new Map<string, {
      name: string;
      wins: number;
      losses: number;
      byGame: Map<string, { gameId: string; gameName: string; gameEmoji: string; wins: number; losses: number }>;
    }>();

    for (const session of completedSessions) {
      const game = getGame(session.gameId);
      if (!game) continue;

      const settings = JSON.parse(session.settings ?? "{}");
      const activePlayers = session.players.filter((p) => p.active);
      const allScores = session.rounds.flatMap((r) =>
        r.scores.map((s) => ({ ...s, roundNumber: r.roundNumber, metadata: s.metadata ?? undefined }))
      );

      const standings = computeStandings(game, activePlayers, allScores, settings);

      const seenNames = new Set<string>();
      for (const player of activePlayers) {
        if (seenNames.has(player.name)) continue;
        seenNames.add(player.name);

        const standing = standings.find((s) => s.playerId === player.id);
        if (!standing) continue;

        const isWin = standing.rank === 1;

        if (!playerStats.has(player.name)) {
          playerStats.set(player.name, { name: player.name, wins: 0, losses: 0, byGame: new Map() });
        }

        const stat = playerStats.get(player.name)!;
        if (isWin) stat.wins++; else stat.losses++;

        if (!stat.byGame.has(session.gameId)) {
          stat.byGame.set(session.gameId, {
            gameId: session.gameId,
            gameName: game.name,
            gameEmoji: game.emoji,
            wins: 0,
            losses: 0,
          });
        }
        const gameStat = stat.byGame.get(session.gameId)!;
        if (isWin) gameStat.wins++; else gameStat.losses++;
      }
    }

    const result = Array.from(playerStats.values()).map((s) => ({
      name: s.name,
      wins: s.wins,
      losses: s.losses,
      totalGames: s.wins + s.losses,
      winPct: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      byGame: Array.from(s.byGame.values()).map((g) => ({
        ...g,
        totalGames: g.wins + g.losses,
      })),
    }));

    result.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500 });
  }
}
