import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getActor } from "@/lib/authz";
import { getCustomName } from "@/lib/gameLabel";

// Reads the database per-request — must never be prerendered at build time.
export const dynamic = "force-dynamic";

// Distinct custom game names previously used, to offer as suggestions on the
// New Game screen so "Mahjong" gets reused instead of retyped as "mah jong".
// Scoped to what the caller can see, mirroring GET /api/sessions.
export async function GET() {
  try {
    const { authEnabled, userId, isAdmin } = await getActor();

    const customFilter = eq(sessions.gameId, "custom");
    // Regular users only see their own games' names; admins and the open
    // (auth-disabled) mode see everything.
    const scoped = authEnabled && !isAdmin;
    if (scoped && !userId) return NextResponse.json([]);
    const where =
      scoped && userId
        ? and(customFilter, eq(sessions.userId, userId))
        : customFilter;

    const rows = await db.query.sessions.findMany({
      columns: { settings: true },
      where,
    });

    // Case-insensitive dedupe, keeping the first-seen spelling.
    const byKey = new Map<string, string>();
    for (const row of rows) {
      const name = getCustomName(row.settings);
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, name);
    }

    const names = Array.from(byKey.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    return NextResponse.json(names);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch custom names" }, { status: 500 });
  }
}
