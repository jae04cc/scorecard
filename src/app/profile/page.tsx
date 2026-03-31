"use client";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, LogIn, LogOut, Shield, KeyRound, ChevronDown, Pencil, Check, Swords } from "lucide-react";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { GameIcon } from "@/components/ui/GameIcon";
import { cn } from "@/lib/utils";

interface GameBreakdown {
  gameId: string;
  gameName: string;
  gameEmoji: string;
  wins: number;
  losses: number;
  totalGames: number;
  avgScore: number | null;
}
interface H2HRecord { opponent: string; wins: number; losses: number; }
interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  totalGames: number;
  winPct: number;
  byGame: GameBreakdown[];
  h2h: H2HRecord[];
}

interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const isOidc = session?.user.id && session.user.id !== "local-admin";

  // Sign-in form state
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // Stats
  const [myStat, setMyStat] = useState<PlayerStat | null>(null);
  const [statsSection, setStatsSection] = useState<"games" | "h2h">("games");

  // Name editing state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (isOidc) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((data: UserProfile) => {
          setProfile(data);
          setFirstName(data.firstName ?? "");
          setLastName(data.lastName ?? "");
        });
    }
  }, [isOidc]);

  // Fetch player stats once session is known — match on session name only
  useEffect(() => {
    if (!session?.user.name) return;
    const target = session.user.name.toLowerCase();
    fetch("/api/players/stats")
      .then((r) => r.json())
      .then((all: PlayerStat[]) => {
        const found = all.find((p) => p.name.toLowerCase() === target);
        setMyStat(found ?? null);
      });
  }, [session?.user.name]);

  const handleLocalSignIn = async () => {
    setLocalError(null);
    setLocalLoading(true);
    try {
      const result = await signIn("local", { username, password, redirect: false });
      if (result?.error) {
        setLocalError("Invalid username or password.");
      } else {
        router.push("/");
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSaveName = async () => {
    setNameError(null);
    setNameSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setProfile((p) => p ? { ...p, firstName: firstName || null, lastName: lastName || null } : p);
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch {
      setNameError("Failed to save name.");
    } finally {
      setNameSaving(false);
    }
  };

  // Display name: prefer firstName+lastName, fall back to OIDC name
  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.name || "Unknown"
    : (session?.user.name ?? "Unknown");

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl text-slate-400 transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Profile</h1>
        <HeaderActions />
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
                  alt={displayName}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-surface-card flex items-center justify-center">
                  <User size={36} className="text-slate-500" />
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-bold text-lg">{displayName}</p>
                {session.user.email && (
                  <p className="text-slate-500 text-sm">{session.user.email}</p>
                )}
              </div>
              <Badge variant={session.user.role === "admin" ? "success" : "default"}>
                {session.user.role === "admin" ? (
                  <span className="flex items-center gap-1"><Shield size={11} />Admin</span>
                ) : "User"}
              </Badge>
            </div>

            {/* Name editing — only for OIDC users */}
            {isOidc && (
              <div className="bg-surface-card rounded-2xl px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Display Name
                  </div>
                  {!editingName && (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-600 text-xs text-slate-400 transition-colors"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  )}
                </div>

                {editingName ? (
                  <div className="space-y-3">
                    <Input
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                    />
                    <Input
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                    />
                    {nameError && (
                      <p className="text-danger text-xs">{nameError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => {
                        setEditingName(false);
                        setFirstName(profile?.firstName ?? "");
                        setLastName(profile?.lastName ?? "");
                      }}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1" onClick={handleSaveName} loading={nameSaving}>
                        <Check size={14} />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-slate-200 text-sm">
                      {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || (
                        <span className="text-slate-600 italic">Not set — using SSO name</span>
                      )}
                    </p>
                    {nameSaved && (
                      <p className="text-success text-xs flex items-center gap-1">
                        <Check size={11} />Saved
                      </p>
                    )}
                    <p className="text-slate-600 text-xs">
                      Once set, this overrides your SSO display name.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Player stats */}
            {myStat && (
              <div className="bg-surface-card rounded-2xl overflow-hidden">
                <div className="px-4 pt-4 pb-3 border-b border-slate-700/50">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Your Stats</div>
                  <div className="flex items-center gap-4">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-black text-success">{myStat.wins}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Wins</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-black text-danger">{myStat.losses}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Losses</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-black text-slate-200">{Math.round(myStat.winPct * 100)}%</div>
                      <div className="text-xs text-slate-500 mt-0.5">Win rate</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-black text-slate-200">{myStat.totalGames}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Games</div>
                    </div>
                  </div>
                </div>
                {/* Section tabs */}
                <div className="flex border-b border-slate-700/50">
                  <button
                    onClick={() => setStatsSection("games")}
                    className={cn("flex-1 py-2 text-xs font-semibold transition-colors", statsSection === "games" ? "text-accent border-b-2 border-accent" : "text-slate-500")}
                  >
                    By Game
                  </button>
                  {myStat.h2h.length > 0 && (
                    <button
                      onClick={() => setStatsSection("h2h")}
                      className={cn("flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1", statsSection === "h2h" ? "text-accent border-b-2 border-accent" : "text-slate-500")}
                    >
                      <Swords size={11} />
                      Head-to-Head
                    </button>
                  )}
                </div>
                {statsSection === "games" && (
                  <div className="px-4 py-3 space-y-2">
                    {myStat.byGame.map((g) => (
                      <div key={g.gameId} className="flex items-center gap-2">
                        <span className="w-6 flex items-center justify-center text-slate-400">
                          <GameIcon gameId={g.gameId} size={14} strokeWidth={1.5} fallback={g.gameEmoji} />
                        </span>
                        <span className="flex-1 text-sm text-slate-300">{g.gameName}</span>
                        <span className="font-mono text-sm text-success w-8 text-center">{g.wins}</span>
                        <span className="text-slate-600 text-xs">–</span>
                        <span className="font-mono text-sm text-danger w-8 text-center">{g.losses}</span>
                        <span className="font-mono text-xs text-slate-500 w-10 text-right">
                          {Math.round((g.wins / g.totalGames) * 100)}%
                        </span>
                        {g.avgScore !== null && (
                          <span className="font-mono text-xs text-slate-600 w-14 text-right">avg {g.avgScore}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {statsSection === "h2h" && (
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-600 mb-1">Games played directly against each opponent</p>
                    {myStat.h2h.map((r) => {
                      const total = r.wins + r.losses;
                      const pct = total > 0 ? r.wins / total : 0;
                      return (
                        <div key={r.opponent} className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-slate-300">{r.opponent}</span>
                          <span className="font-mono text-sm text-success w-8 text-center">{r.wins}</span>
                          <span className="text-slate-600 text-xs">–</span>
                          <span className="font-mono text-sm text-danger w-8 text-center">{r.losses}</span>
                          <span className="font-mono text-xs text-slate-500 w-10 text-right">{Math.round(pct * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button variant="secondary" size="lg" onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        ) : (
          // ── Not signed in ──
          <div className="flex flex-col gap-4 py-8 max-w-sm mx-auto w-full">
            <div className="flex flex-col items-center gap-3 pb-2 text-center">
              <div className="w-20 h-20 rounded-full bg-surface-card flex items-center justify-center">
                <User size={36} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-semibold text-lg">Sign in</p>
                <p className="text-slate-500 text-sm mt-1">Access your games and stats</p>
              </div>
            </div>

            <Button size="lg" onClick={() => signIn("oidc", { callbackUrl: "/" })}>
              <LogIn size={16} />
              Sign In with SSO
            </Button>

            <div>
              <button
                type="button"
                onClick={() => { setShowLocalForm((v) => !v); setLocalError(null); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-600 transition-colors"
              >
                <KeyRound size={12} />
                Local admin login
                <ChevronDown size={12} className={cn("transition-transform", showLocalForm && "rotate-180")} />
              </button>

              {showLocalForm && (
                <div className="mt-2 space-y-3 bg-surface-card rounded-2xl px-4 py-4">
                  <Input label="Username" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                  <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && handleLocalSignIn()} />
                  {localError && <p className="text-danger text-sm bg-danger/10 rounded-lg px-3 py-2">{localError}</p>}
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
