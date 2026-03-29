"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, LogIn, LogOut, Shield, KeyRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === "loading";

  const [showLocalForm, setShowLocalForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const handleLocalSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    try {
      const result = await signIn("local", {
        username,
        password,
        redirect: false,
      });
      if (result?.error) {
        setLocalError("Invalid username or password.");
      } else {
        router.push("/");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Profile</h1>
      </header>

      <main className="flex-1 px-5 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
          </div>
        ) : session ? (
          // ── Signed in ──
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  className="w-20 h-20 rounded-full border border-slate-700/50"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-surface-card border border-slate-700/50 flex items-center justify-center">
                  <User size={36} className="text-slate-500" />
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-bold text-lg">{session.user.name ?? "Unknown"}</p>
                {session.user.email && (
                  <p className="text-slate-500 text-sm">{session.user.email}</p>
                )}
              </div>
              <Badge variant={session.user.role === "admin" ? "success" : "default"}>
                {session.user.role === "admin" ? (
                  <span className="flex items-center gap-1">
                    <Shield size={11} />
                    Admin
                  </span>
                ) : "User"}
              </Badge>
            </div>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        ) : (
          // ── Not signed in ──
          <div className="flex flex-col gap-4 py-8 max-w-sm mx-auto w-full">
            <div className="flex flex-col items-center gap-3 pb-2 text-center">
              <div className="w-20 h-20 rounded-full bg-surface-card border border-slate-700/50 flex items-center justify-center">
                <User size={36} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-semibold text-lg">Sign in</p>
                <p className="text-slate-500 text-sm mt-1">
                  Access your games and stats
                </p>
              </div>
            </div>

            {/* SSO button */}
            <Button size="lg" onClick={() => signIn("oidc", { callbackUrl: "/" })}>
              <LogIn size={16} />
              Sign In with SSO
            </Button>

            {/* Break-glass local login */}
            <div>
              <button
                type="button"
                onClick={() => { setShowLocalForm((v) => !v); setLocalError(null); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                <KeyRound size={12} />
                Local admin login
                <ChevronDown
                  size={12}
                  className={cn("transition-transform", showLocalForm && "rotate-180")}
                />
              </button>

              {showLocalForm && (
                <div className="mt-2 space-y-3 bg-surface-card rounded-2xl px-4 py-4">
                  <Input
                    label="Username"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && handleLocalSignIn()}
                  />
                  {localError && (
                    <p className="text-danger text-sm bg-danger/10 rounded-lg px-3 py-2">
                      {localError}
                    </p>
                  )}
                  <Button size="md" onClick={handleLocalSignIn} loading={localLoading} className="w-full">
                    <KeyRound size={15} />
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
