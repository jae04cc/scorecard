import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionPlayers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Soft-remove a player from an active session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    await db
      .update(sessionPlayers)
      .set({ active: false })
      .where(eq(sessionPlayers.id, params.playerId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to remove player" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  try {
    const body = await req.json();
    const { name, team, active } = body as {
      name?: string;
      team?: string | null;
      active?: boolean;
    };

    const updates: Partial<typeof sessionPlayers.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (team !== undefined) updates.team = team;
    if (active !== undefined) updates.active = active;

    await db
      .update(sessionPlayers)
      .set(updates)
      .where(eq(sessionPlayers.id, params.playerId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update player" }, { status: 500 });
  }
}
