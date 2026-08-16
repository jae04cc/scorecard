import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSessionAccess } from "@/lib/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSessionAccess(params.id);
  if (actor instanceof NextResponse) return actor;

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
  const actor = await requireSessionAccess(params.id);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = (await req.json()) as Partial<{
      status: typeof sessions.$inferInsert.status;
      notes: typeof sessions.$inferInsert.notes;
      settings: typeof sessions.$inferInsert.settings;
      completedAt: number | Date | null;
      userId: string | null;
    }>;

    const updates: Partial<typeof sessions.$inferInsert> = {};

    if ("status" in body) {
      updates.status = body.status;
    }

    if ("notes" in body) {
      updates.notes = body.notes;
    }

    if ("settings" in body) {
      updates.settings = body.settings;
    }

    if ("completedAt" in body) {
      updates.completedAt =
        typeof body.completedAt === "number"
          ? new Date(body.completedAt)
          : body.completedAt;
    }

    // Reassigning ownership is an admin action (used by the orphaned-session
    // picker in /history) — a regular owner must not hand their game away.
    if ("userId" in body) {
      if (actor.authEnabled && !actor.isAdmin) {
        return NextResponse.json(
          { error: "Only an admin can reassign a game." },
          { status: 403 }
        );
      }
      updates.userId = body.userId;
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
  const actor = await requireSessionAccess(params.id);
  if (actor instanceof NextResponse) return actor;

  try {
    await db.delete(sessions).where(eq(sessions.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
