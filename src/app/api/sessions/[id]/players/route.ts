import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionPlayers, sessions } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
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

    const body = await req.json();
    const { name, team } = body as { name: string; team?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Player name is required" }, { status: 400 });
    }

    const [maxRow] = await db
      .select({ value: max(sessionPlayers.position) })
      .from(sessionPlayers)
      .where(eq(sessionPlayers.sessionId, params.id));

    const newPlayer = {
      id: generateId(),
      sessionId: params.id,
      name: name.trim(),
      position: (maxRow?.value ?? -1) + 1,
      team: team ?? null,
      active: true,
    };

    await db.insert(sessionPlayers).values(newPlayer);
    return NextResponse.json(newPlayer, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add player" }, { status: 500 });
  }
}
