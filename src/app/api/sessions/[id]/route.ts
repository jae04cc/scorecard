import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
      with: {
        players: { orderBy: (p, { asc }) => [asc(p.position)] },
        rounds: {
          orderBy: (r, { asc }) => [asc(r.roundNumber)],
          with: { scores: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const allowed: Array<keyof typeof sessions.$inferInsert> = [
      "status",
      "notes",
      "settings",
      "completedAt",
    ];

    const updates: Partial<typeof sessions.$inferInsert> = {};
    for (const key of allowed) {
      if (key in body) {
        // completedAt is a timestamp_ms column — Drizzle needs a Date object, not a number
        if (key === "completedAt" && typeof body[key] === "number") {
          updates.completedAt = new Date(body[key]);
        } else {
          // @ts-expect-error — dynamic key assignment
          updates[key] = body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await db.update(sessions).set(updates).where(eq(sessions.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.delete(sessions).where(eq(sessions.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
