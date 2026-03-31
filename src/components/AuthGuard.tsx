"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

const PROTECTED = ["/new", "/game", "/history", "/players", "/admin"];

function isProtectedPath(path: string) {
  return PROTECTED.some((p) => path === p || path.startsWith(p + "/"));
}

interface CheckState {
  path: string;
  allowed: boolean | null; // null = still checking
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [check, setCheck] = useState<CheckState>(() => ({
    path: pathname,
    allowed: isProtectedPath(pathname) ? null : true,
  }));

  useEffect(() => {
    if (!isProtectedPath(pathname)) {
      setCheck({ path: pathname, allowed: true });
      return;
    }

    // Mark this path as pending while we verify
    setCheck({ path: pathname, allowed: null });

    if (status === "loading") return;

    if (status === "authenticated") {
      setCheck({ path: pathname, allowed: true });
      return;
    }

    // Unauthenticated on a protected path — check if auth is on
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.authEnabled) {
          router.replace("/");
          // leave allowed as null — spinner shows while redirect completes
        } else {
          setCheck({ path: pathname, allowed: true });
        }
      })
      .catch(() => setCheck({ path: pathname, allowed: true }));
  }, [pathname, status, router]);

  // Show spinner if: still checking OR the checked path doesn't match current path
  const ready = check.allowed === true && check.path === pathname;

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
