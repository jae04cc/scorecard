import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rounds, roundScores, sessions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { getGame } from "@/lib/games";
import { eq, max } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
      with: { players: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    const game = getGame(session.gameId);
    if (!game) {
      return NextResponse.json({ error: "Unknown game" }, { status: 500 });
    }

    const body = await req.json();
    // entries: Array<{ playerId: string; score: number; metadata?: object }>
    const { entries } = body as {
      entries: Array<{ playerId: string; score: number; metadata?: Record<string, unknown> }>;
    };

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "entries is required" }, { status: 400 });
    }

    // Validate all player IDs belong to this session
    const activePlayers = session.players.filter((p) => p.active);
    const validIds = new Set(activePlayers.map((p) => p.id));
    for (const e of entries) {
      if (!validIds.has(e.playerId)) {
        return NextResponse.json(
          { error: `Player ${e.playerId} not in this session` },
          { status: 400 }
        );
      }
    }

    // Determine next round number
    const [maxRow] = await db
      .select({ value: max(rounds.roundNumber) })
      .from(rounds)
      .where(eq(rounds.sessionId, params.id));
    const nextRound = (maxRow?.value ?? 0) + 1;

    const roundId = generateId();
    await db.insert(rounds).values({
      id: roundId,
      sessionId: params.id,
      roundNumber: nextRound,
      createdAt: new Date(),
    });

    const scoreRows = entries.map((e) => ({
      id: generateId(),
      roundId,
      playerId: e.playerId,
      score: e.score,
      metadata: JSON.stringify(e.metadata ?? {}),
    }));

    await db.insert(roundScores).values(scoreRows);

    return NextResponse.json({ roundId, roundNumber: nextRound }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add round" }, { status: 500 });
  }
}
