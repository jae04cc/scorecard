import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings, rounds, sessionPlayers, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

// ---------------------------------------------------------------------------
// Authorization helpers for API route handlers.
//
// Every guard returns either an Actor (caller may proceed) or a NextResponse
// the handler should return immediately:
//
//   const actor = await requireAdmin();
//   if (actor instanceof NextResponse) return actor;
//
// When authentication is disabled app-wide every guard passes — the app is
// intentionally open in that mode, and this is also the bootstrap path that
// lets an operator reach /admin to turn authentication on in the first place.
// ---------------------------------------------------------------------------

export interface Actor {
  userId: string | null;
  isAdmin: boolean;
  authEnabled: boolean;
}

export async function isAuthEnabled(): Promise<boolean> {
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, "oidc_enabled"),
  });
  return row?.value === "true";
}

export async function getActor(): Promise<Actor> {
  const authEnabled = await isAuthEnabled();
  if (!authEnabled) {
    return { userId: null, isAdmin: false, authEnabled: false };
  }
  const session = await auth();
  return {
    userId: session?.user.id || null,
    isAdmin: session?.user.role === "admin",
    authEnabled: true,
  };
}

export const unauthorized = () =>
  NextResponse.json({ error: "Not authenticated" }, { status: 401 });

export const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const notFound = (what = "Session") =>
  NextResponse.json({ error: `${what} not found` }, { status: 404 });

/** Any signed-in user. */
export async function requireUser(): Promise<Actor | NextResponse> {
  const actor = await getActor();
  if (!actor.authEnabled) return actor;
  if (!actor.userId) return unauthorized();
  return actor;
}

/** Signed-in user with role=admin. */
export async function requireAdmin(): Promise<Actor | NextResponse> {
  const actor = await getActor();
  if (!actor.authEnabled) return actor;
  if (!actor.userId) return unauthorized();
  if (!actor.isAdmin) return forbidden();
  return actor;
}

/**
 * The caller owns this session, or is an admin.
 *
 * Non-owners get 404 rather than 403 so session IDs can't be probed for
 * existence. Sessions with a null userId (created before auth was enabled)
 * are admin-only, which matches how GET /api/sessions already scopes them.
 */
export async function requireSessionAccess(
  sessionId: string
): Promise<Actor | NextResponse> {
  const actor = await getActor();
  const row = await db.query.sessions.findFirst({
    columns: { id: true, userId: true },
    where: eq(sessions.id, sessionId),
  });
  if (!row) return notFound();
  if (!actor.authEnabled) return actor;
  if (!actor.userId) return unauthorized();
  if (actor.isAdmin) return actor;
  if (row.userId !== actor.userId) return notFound();
  return actor;
}

/** Session access, plus: this round actually belongs to that session. */
export async function requireRoundInSession(
  sessionId: string,
  roundId: string
): Promise<Actor | NextResponse> {
  const actor = await requireSessionAccess(sessionId);
  if (actor instanceof NextResponse) return actor;

  const round = await db.query.rounds.findFirst({
    columns: { id: true, sessionId: true },
    where: eq(rounds.id, roundId),
  });
  if (!round || round.sessionId !== sessionId) return notFound("Round");
  return actor;
}

/** Session access, plus: this player actually belongs to that session. */
export async function requirePlayerInSession(
  sessionId: string,
  playerId: string
): Promise<Actor | NextResponse> {
  const actor = await requireSessionAccess(sessionId);
  if (actor instanceof NextResponse) return actor;

  const player = await db.query.sessionPlayers.findFirst({
    columns: { id: true, sessionId: true },
    where: eq(sessionPlayers.id, playerId),
  });
  if (!player || player.sessionId !== sessionId) return notFound("Player");
  return actor;
}
