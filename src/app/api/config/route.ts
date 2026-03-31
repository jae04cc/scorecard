import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, "oidc_enabled"),
    });
    return NextResponse.json({ authEnabled: row?.value === "true" });
  } catch {
    return NextResponse.json({ authEnabled: false });
  }
}
