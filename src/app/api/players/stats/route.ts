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

    const visibilityRow = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "stats_visibility"),
    });
    const statsVisibility = visibilityRow?.value ?? "global";

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

    // Per-player stats
    const playerStats = new Map<string, {
      name: string;
      wins: number;
      losses: number;
      byGame: Map<string, {
        gameId: string;
        gameName: string;
        gameEmoji: string;
        wins: number;
        losses: number;
        totalScore: number;
        scoredGames: number; // sessions where this player had rounds
      }>;
      // head-to-head: opponent name -> { wins, losses }
      h2h: Map<string, { wins: number; losses: number }>;
    }>();

    for (const session of completedSessions) {
      const game = getGame(session.gameId);
      if (!game) continue;

      const settings = JSON.parse(session.settings ?? "{}");
      const activePlayers = session.players.filter((p) => p.active);
      const allScores = session.rounds.flatMap((r) =>
        r.scores.map((s) => ({ ...s, roundNumber: r.roundNumber, metadata: s.metadata ?? undefined }))
      );

      let standings = computeStandings(game, activePlayers, allScores, settings);

      // Respect manual winner override
      const manualWinnerId = settings.manualWinnerId as string | undefined;
      if (manualWinnerId) {
        standings = standings.map((s) => ({
          ...s,
          isWinning: s.playerId === manualWinnerId,
          rank: s.playerId === manualWinnerId ? 1 : s.rank === 1 ? 2 : s.rank,
        }));
      }

      const seenNames = new Set<string>();
      for (const player of activePlayers) {
        if (seenNames.has(player.name)) continue;
        seenNames.add(player.name);

        const standing = standings.find((s) => s.playerId === player.id);
        if (!standing) continue;

        const isWin = standing.isWinning;

        if (!playerStats.has(player.name)) {
          playerStats.set(player.name, {
            name: player.name,
            wins: 0,
            losses: 0,
            byGame: new Map(),
            h2h: new Map(),
          });
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
            totalScore: 0,
            scoredGames: 0,
          });
        }
        const gameStat = stat.byGame.get(session.gameId)!;
        if (isWin) gameStat.wins++; else gameStat.losses++;
        if (allScores.length > 0) {
          gameStat.totalScore += standing.total;
          gameStat.scoredGames++;
        }

        // Head-to-head: compare against all other active players in same session
        for (const opponent of activePlayers) {
          if (opponent.name === player.name || seenNames.has(opponent.name)) continue;
          const oppStanding = standings.find((s) => s.playerId === opponent.id);
          if (!oppStanding) continue;

          if (!stat.h2h.has(opponent.name)) {
            stat.h2h.set(opponent.name, { wins: 0, losses: 0 });
          }
          const h2hStat = stat.h2h.get(opponent.name)!;
          if (standing.rank < oppStanding.rank) h2hStat.wins++;
          else if (standing.rank > oppStanding.rank) h2hStat.losses++;
        }
      }
    }

    const result = Array.from(playerStats.values()).map((s) => ({
      name: s.name,
      wins: s.wins,
      losses: s.losses,
      totalGames: s.wins + s.losses,
      winPct: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      byGame: Array.from(s.byGame.values()).map((g) => ({
        gameId: g.gameId,
        gameName: g.gameName,
        gameEmoji: g.gameEmoji,
        wins: g.wins,
        losses: g.losses,
        totalGames: g.wins + g.losses,
        avgScore: g.scoredGames > 0 ? Math.round(g.totalScore / g.scoredGames) : null,
      })),
      h2h: Array.from(s.h2h.entries()).map(([opponent, record]) => ({
        opponent,
        wins: record.wins,
        losses: record.losses,
      })).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)),
    }));

    result.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500 });
  }
}
