import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, sessionPlayers } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { getGame } from "@/lib/games";
import { auth } from "@/auth";
import { and, desc, eq, isNull, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // 'active' | 'completed' | all

  try {
    const session = await auth();
    const userId = session?.user.id ?? null;
    const isAdmin = session?.user.role === "admin";

    // Build where clause:
    // - No session (auth disabled or not logged in): return all
    // - Admin: return all
    // - Regular user: return only their own sessions
    const ownershipFilter =
      !userId || isAdmin
        ? undefined
        : or(eq(sessions.userId, userId), isNull(sessions.userId));

    const statusFilter = status
      ? eq(sessions.status, status as "active" | "completed" | "abandoned")
      : undefined;

    const where =
      ownershipFilter && statusFilter
        ? and(ownershipFilter, statusFilter)
        : ownershipFilter ?? statusFilter;

    const rows = await db.query.sessions.findMany({
      with: { players: true },
      orderBy: [desc(sessions.createdAt)],
      where,
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameId, playerNames, settings = {} } = body as {
      gameId: string;
      playerNames: string[];
      settings?: Record<string, unknown>;
    };

    const game = getGame(gameId);
    if (!game) {
      return NextResponse.json({ error: `Unknown game: ${gameId}` }, { status: 400 });
    }

    if (playerNames.length < game.minPlayers || playerNames.length > game.maxPlayers) {
      return NextResponse.json(
        {
          error: `${game.name} requires ${game.minPlayers}–${game.maxPlayers} players. Got ${playerNames.length}.`,
        },
        { status: 400 }
      );
    }

    const authSession = await auth();
    const userId = authSession?.user.id ?? null;

    const sessionId = generateId();
    const now = Date.now();

    // Apply default settings from game definition
    const defaultSettings: Record<string, unknown> = {};
    for (const s of game.settings) {
      defaultSettings[s.key] = s.defaultValue;
    }
    const mergedSettings = { ...defaultSettings, ...settings };

    // Insert session
    await db.insert(sessions).values({
      id: sessionId,
      gameId,
      status: "active",
      createdAt: new Date(now),
      settings: JSON.stringify(mergedSettings),
      userId,
    });

    // Insert players
    const players = playerNames.map((name, idx) => ({
      id: generateId(),
      sessionId,
      name: name.trim(),
      position: idx,
      team: (game.supportsTeams || (game.teamsWhenPlayerCount && playerNames.length === game.teamsWhenPlayerCount)) && game.playersPerTeam
        ? `Team ${Math.floor(idx / game.playersPerTeam) + 1}`
        : null,
      active: true,
    }));

    await db.insert(sessionPlayers).values(players);

    return NextResponse.json({ id: sessionId, players }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
