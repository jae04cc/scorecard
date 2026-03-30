import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user.id || session.user.id === "local-admin") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id || session.user.id === "local-admin") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { firstName, lastName } = await req.json() as { firstName?: string; lastName?: string };

  const updates: Partial<typeof users.$inferInsert> = {};
  if (firstName !== undefined) updates.firstName = firstName.trim() || null;
  if (lastName !== undefined) updates.lastName = lastName.trim() || null;

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
