import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rounds, roundScores } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { eq } from "drizzle-orm";

// Update scores for an existing round (full replace)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; roundId: string } }
) {
  try {
    const body = await req.json();
    const { entries } = body as {
      entries: Array<{ playerId: string; score: number; metadata?: Record<string, unknown> }>;
    };

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
  try {
    await db.delete(rounds).where(eq(rounds.id, params.roundId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete round" }, { status: 500 });
  }
}
