import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

// Keys returned to the client (never expose hashes or internal secrets)
const READABLE_KEYS = [
  "app_url",
  "oidc_enabled",
  "oidc_issuer",
  "oidc_client_id",
  "oidc_client_secret",
  "stats_visibility",
  "local_admin_username",
  "has_local_admin", // synthetic: "true" if password hash exists
] as const;

const WRITABLE_KEYS = [
  "app_url",
  "oidc_enabled",
  "oidc_issuer",
  "oidc_client_id",
  "oidc_client_secret",
  "stats_visibility",
  "local_admin_username",
] as const;

export async function GET() {
  try {
    const rows = await db.select().from(appSettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const result: Record<string, string> = {};
    for (const key of READABLE_KEYS) {
      if (key === "has_local_admin") {
        result[key] = map.local_admin_password_hash ? "true" : "false";
      } else if (map[key] !== undefined) {
        result[key] = map[key];
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string>;

    // Upsert standard writable keys
    for (const key of WRITABLE_KEYS) {
      if (body[key] === undefined) continue;
      await db
        .insert(appSettings)
        .values({ key, value: body[key] })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: body[key] } });
    }

    // Hash and store the break-glass password if provided
    if (body.local_admin_password) {
      const hash = await hashPassword(body.local_admin_password);
      await db
        .insert(appSettings)
        .values({ key: "local_admin_password_hash", value: hash })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: hash } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
