"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Trophy, ChevronRight, Medal, Settings, User, LogIn, Unlink } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GameIcon, gameIconStyle } from "@/components/ui/GameIcon";
import { cn, formatDate } from "@/lib/utils";
import { useSession, signIn } from "next-auth/react";

interface GameInfo {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  minPlayers: number;
  maxPlayers: number;
}

interface SessionSummary {
  id: string;
  gameId: string;
  status: string;
  createdAt: number;
  userId: string | null;
  players: Array<{ name: string; active: boolean }>;
}

export default function HomePage() {
  const router = useRouter();
  const { data: authSession, status: sessionStatus } = useSession();
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [showLoginHint, setShowLoginHint] = useState(false);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((d) => setAuthEnabled(d.authEnabled));
    fetch("/api/games").then((r) => r.json()).then(setGames);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: SessionSummary[]) => {
        if (Array.isArray(data)) setRecentSessions(data.slice(0, 3));
      });
  }, []);

  const configLoading = authEnabled === null || sessionStatus === "loading";
  const isLoggedIn = sessionStatus === "authenticated";
  const isWalled = authEnabled && !isLoggedIn;
  const isAdmin = !authEnabled || authSession?.user.role === "admin";

  const gameMap = new Map(games.map((g) => [g.id, g]));

  const handleGameClick = (gameId: string) => {
    if (isWalled) {
      setShowLoginHint(true);
    } else {
      router.push(`/new?game=${gameId}`);
    }
  };

  // Don't render anything until we know if we're walled (avoids flash)
  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Scorecard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track any game, any time</p>
          </div>
          {!isWalled && (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="p-2 rounded-xl text-slate-400 transition-colors"
                >
                  <Settings size={22} />
                </Link>
              )}
              <Link
                href="/profile"
                className="p-2 rounded-xl text-slate-400 transition-colors"
              >
                <User size={22} />
              </Link>
              <Link
                href="/players"
                className="p-2 rounded-xl text-slate-400 transition-colors"
              >
                <Medal size={22} />
              </Link>
              <Link
                href="/history"
                className="p-2 rounded-xl text-slate-400 transition-colors"
              >
                <Clock size={22} />
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-5 pb-10 space-y-8">
        {/* Game selection */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            New Game
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameClick(game.id)}
              >
                <Card className={cn(
                  "transition-all active:scale-[0.98]",
                  isWalled ? "opacity-50" : ""
                )}>
                  <div className="flex flex-col items-center text-center p-3 gap-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={gameIconStyle(game.id)}
                    >
                      <GameIcon gameId={game.id} size={22} strokeWidth={1.5} fallback={game.emoji} />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm leading-tight">{game.name}</div>
                      <div className="text-xs text-slate-500">
                        {game.minPlayers === game.maxPlayers ? `${game.minPlayers}p` : `${game.minPlayers}–${game.maxPlayers}p`}
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </section>

        {/* Recent games or sign-in prompt */}
        {isWalled ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Recent Games
            </h2>
            {showLoginHint && (
              <p className="text-center text-sm text-slate-400">
                Sign in to start tracking games
              </p>
            )}
            <button
              onClick={() => signIn("oidc", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white font-bold text-sm"
            >
              <LogIn size={16} />
              Sign In to Play
            </button>
          </section>
        ) : recentSessions.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Recent Games
              </h2>
              <Link href="/history" className="text-xs text-accent-light">
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {recentSessions.map((s) => {
                const game = gameMap.get(s.gameId);
                const isActive = s.status === "active";
                const isOrphaned = s.userId === null;
                const href = isActive ? `/game/${s.id}` : `/history/${s.id}`;
                return (
                  <Link key={s.id} href={href} className="block">
                    <Card className={cn(
                      "transition-all",
                      isActive ? "ring-1 ring-success/40" : ""
                    )}>
                      <CardBody>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={gameIconStyle(s.gameId)}
                          >
                            <GameIcon gameId={s.gameId} size={16} strokeWidth={1.5} fallback={game?.emoji ?? "🎮"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-200 text-sm">
                                {game?.name ?? s.gameId}
                              </span>
                              {isActive && <Badge variant="success">Active</Badge>}
                              {authEnabled && isAdmin && isOrphaned && (
                                <Badge variant="default">
                                  <span className="flex items-center gap-0.5">
                                    <Unlink size={9} />
                                    Orphaned
                                  </span>
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatDate(s.createdAt)} ·{" "}
                              {s.players
                                .filter((p) => p.active)
                                .map((p) => p.name)
                                .join(", ")}
                            </p>
                          </div>
                          {isActive
                            ? <ChevronRight size={14} className="text-success/60 shrink-0" />
                            : <Trophy size={14} className="text-slate-600 shrink-0" />}
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
