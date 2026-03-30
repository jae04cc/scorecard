import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings, sessions, sessionPlayers } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { getGame } from "@/lib/games";
import { auth } from "@/auth";
import { and, desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    // Check if auth is enabled
    const oidcRow = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "oidc_enabled"),
    });
    const authEnabled = oidcRow?.value === "true";

    const statusFilter = status
      ? eq(sessions.status, status as "active" | "completed" | "abandoned")
      : undefined;

    if (!authEnabled) {
      // Auth off — return everything
      const rows = await db.query.sessions.findMany({
        with: { players: true },
        orderBy: [desc(sessions.createdAt)],
        where: statusFilter,
      });
      return NextResponse.json(rows);
    }

    // Auth is enabled — check who's asking
    const session = await auth();
    const userId = session?.user.id ?? null;
    const isAdmin = session?.user.role === "admin";

    if (!userId) {
      // Not logged in with auth enabled — return nothing
      return NextResponse.json([]);
    }

    if (isAdmin) {
      // Admins see everything
      const rows = await db.query.sessions.findMany({
        with: { players: true },
        orderBy: [desc(sessions.createdAt)],
        where: statusFilter,
      });
      return NextResponse.json(rows);
    }

    // Regular user — own sessions only
    const ownerFilter = eq(sessions.userId, userId);
    const where = statusFilter ? and(ownerFilter, statusFilter) : ownerFilter;

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
        { error: `${game.name} requires ${game.minPlayers}–${game.maxPlayers} players. Got ${playerNames.length}.` },
        { status: 400 }
      );
    }

    const authSession = await auth();
    const userId = authSession?.user.id ?? null;

    const sessionId = generateId();
    const now = Date.now();

    const defaultSettings: Record<string, unknown> = {};
    for (const s of game.settings) {
      defaultSettings[s.key] = s.defaultValue;
    }
    const mergedSettings = { ...defaultSettings, ...settings };

    await db.insert(sessions).values({
      id: sessionId,
      gameId,
      status: "active",
      createdAt: new Date(now),
      settings: JSON.stringify(mergedSettings),
      userId,
    });

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
