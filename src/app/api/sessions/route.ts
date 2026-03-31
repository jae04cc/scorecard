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
      // Auth off — return everything, no owner info needed
      const rows = await db.query.sessions.findMany({
        with: { players: true },
        orderBy: [desc(sessions.createdAt)],
        where: statusFilter,
      });
      return NextResponse.json(rows.map((r) => ({ ...r, authEnabled: false })));
    }

    // Auth is enabled — check who's asking
    const session = await auth();
    const userId = session?.user.id ?? null;
    const isAdmin = session?.user.role === "admin";

    if (!userId) {
      return NextResponse.json([]);
    }

    if (isAdmin) {
      // Admins see everything + owner info
      const rows = await db.query.sessions.findMany({
        with: { players: true, user: true },
        orderBy: [desc(sessions.createdAt)],
        where: statusFilter,
      });
      return NextResponse.json(rows.map((r) => ({
        ...r,
        authEnabled: true,
        ownerName: r.user
          ? (r.user.firstName ?? r.user.name?.split(" ")[0] ?? null)
          : null,
        user: undefined,
      })));
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

    // Compute team assignments: either from game definition or custom team sizes
    const customTeamSizes = mergedSettings.customTeamSizes as number[] | undefined;
    const teamForIndex = (idx: number): string | null => {
      if (customTeamSizes && customTeamSizes.length > 0) {
        let cursor = 0;
        for (let t = 0; t < customTeamSizes.length; t++) {
          if (idx < cursor + customTeamSizes[t]) return `Team ${t + 1}`;
          cursor += customTeamSizes[t];
        }
        return null;
      }
      if ((game.supportsTeams || (game.teamsWhenPlayerCount && playerNames.length === game.teamsWhenPlayerCount)) && game.playersPerTeam) {
        return `Team ${Math.floor(idx / game.playersPerTeam) + 1}`;
      }
      return null;
    };

    const players = playerNames.map((name, idx) => ({
      id: generateId(),
      sessionId,
      name: name.trim(),
      position: idx,
      team: teamForIndex(idx),
      active: true,
    }));

    await db.insert(sessionPlayers).values(players);

    return NextResponse.json({ id: sessionId, players }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
