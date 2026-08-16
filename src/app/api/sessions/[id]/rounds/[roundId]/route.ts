import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rounds, roundScores, sessionPlayers } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { requireRoundInSession } from "@/lib/authz";

// Update scores for an existing round (full replace)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; roundId: string } }
) {
  const actor = await requireRoundInSession(params.id, params.roundId);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = await req.json();
    const { entries } = body as {
      entries: Array<{ playerId: string; score: number; metadata?: Record<string, unknown> }>;
    };

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "entries is required" }, { status: 400 });
    }

    // Every score must belong to a player in this session
    const players = await db
      .select({ id: sessionPlayers.id })
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, params.id));
    const validIds = new Set(players.map((p) => p.id));
    for (const e of entries) {
      if (!validIds.has(e.playerId)) {
        return NextResponse.json(
          { error: `Player ${e.playerId} not in this session` },
          { status: 400 }
        );
      }
    }

    // Delete existing scores for this round then re-insert
    await db.delete(roundScores).where(eq(roundScores.roundId, params.roundId));

    const scoreRows = entries.map((e) => ({
      id: generateId(),
      roundId: params.roundId,
      playerId: e.playerId,
      score: e.score,
      metadata: JSON.stringify(e.metadata ?? {}),
    }));

    await db.insert(roundScores).values(scoreRows);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update round" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; roundId: string } }
) {
  const actor = await requireRoundInSession(params.id, params.roundId);
  if (actor instanceof NextResponse) return actor;

  try {
    await db.delete(rounds).where(eq(rounds.id, params.roundId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete round" }, { status: 500 });
  }
}
