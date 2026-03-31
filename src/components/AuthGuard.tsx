"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

const PROTECTED = ["/new", "/game", "/history", "/players", "/admin"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading" || status === "authenticated") return;

    const isProtected = PROTECTED.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (!isProtected) return;

    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.authEnabled) router.replace("/");
      });
  }, [status, pathname, router]);

  return <>{children}</>;
}
