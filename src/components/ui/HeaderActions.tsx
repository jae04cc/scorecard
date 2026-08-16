"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, Settings } from "lucide-react";
import { useSession } from "next-auth/react";

/**
 * Placed in the top-right of every inner page header.
 * Shows a Home button always, and a Settings (admin) cog for admin users.
 * When auth is disabled app-wide there are no roles, so the cog is shown to
 * everyone — but a signed-out visitor on an auth-enabled instance must not
 * see it.
 */
export function HeaderActions() {
  const { data: session } = useSession();
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setAuthEnabled(Boolean(d.authEnabled)))
      .catch(() => setAuthEnabled(true));
  }, []);

  const isAdmin = authEnabled === false || session?.user.role === "admin";

  return (
    <div className="flex items-center gap-0.5 ml-auto">
      {isAdmin && (
        <Link
          href="/admin"
          className="p-2 rounded-xl text-slate-400 transition-colors"
        >
          <Settings size={20} />
        </Link>
      )}
      <Link
        href="/"
        className="p-2 rounded-xl text-slate-400 transition-colors"
      >
        <Home size={20} />
      </Link>
    </div>
  );
}
