import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { appSettings, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";

// ---------------------------------------------------------------------------
// Type augmentation — adds `id` and `role` to the session user object
// ---------------------------------------------------------------------------
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
    } & DefaultSession["user"];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loadSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

async function getOrCreateSecret(map: Record<string, string>): Promise<string> {
  if (map.auth_secret) return map.auth_secret;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Buffer.from(bytes).toString("base64url");
  await db.insert(appSettings)
    .values({ key: "auth_secret", value: secret })
    .onConflictDoNothing();
  return secret;
}

// ---------------------------------------------------------------------------
// NextAuth config — loaded from DB on each auth request
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const settings = await loadSettings();
  const secret = await getOrCreateSecret(settings);

  const oidcEnabled = settings.oidc_enabled === "true";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = [];

  if (
    oidcEnabled &&
    settings.oidc_issuer &&
    settings.oidc_client_id &&
    settings.oidc_client_secret
  ) {
    providers.push({
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      issuer: settings.oidc_issuer,
      clientId: settings.oidc_client_id,
      clientSecret: settings.oidc_client_secret,
    });
  }

  // Break-glass local admin — always available when auth is enabled and credentials are configured
  if (oidcEnabled && settings.local_admin_username && settings.local_admin_password_hash) {
    providers.push(
      Credentials({
        id: "local",
        name: "Local Admin",
        credentials: {
          username: { label: "Username", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const username = credentials?.username as string | undefined;
          const password = credentials?.password as string | undefined;
          if (!username || !password) return null;
          if (username !== settings.local_admin_username) return null;
          const valid = await verifyPassword(password, settings.local_admin_password_hash!);
          if (!valid) return null;
          return { id: "local-admin", name: "Local Admin", email: null };
        },
      })
    );
  }

  return {
    secret,
    providers,
    callbacks: {
      async jwt({ token, account, profile }) {
        // `account` is only present on initial sign-in
        if (!account) return token;

        // Local break-glass admin — not stored in the users table
        if (account.provider === "local") {
          token.role = "admin";
          token.userId = "local-admin";
          return token;
        }

        // OIDC sign-in
        if (profile) {
          const sub = (profile.sub ?? account.providerAccountId) as string;
          const now = new Date();

          const existing = await db.query.users.findFirst({
            where: eq(users.sub, sub),
          });

          if (existing) {
            await db
              .update(users)
              .set({
                name: (profile.name as string | null) ?? existing.name,
                email: (profile.email as string | null) ?? existing.email,
                lastLoginAt: now,
              })
              .where(eq(users.sub, sub));
            token.role = existing.role;
            token.userId = existing.id;
          } else {
            // First OIDC user becomes admin
            const count = await db.select().from(users);
            const role: "admin" | "user" = count.length === 0 ? "admin" : "user";
            const id = crypto.randomUUID();
            await db.insert(users).values({
              id,
              sub,
              email: (profile.email as string | null) ?? null,
              name: (profile.name as string | null) ?? null,
              role,
              createdAt: now,
              lastLoginAt: now,
            });
            token.role = role;
            token.userId = id;
          }
        }
        return token;
      },

      async session({ session, token }) {
        session.user.id = (token.userId as string | undefined) ?? "";
        session.user.role = ((token.role as string | undefined) ?? "user") as "admin" | "user";
        return session;
      },
    },

    pages: {
      signIn: "/profile",
    },
  };
});
