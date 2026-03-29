"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Trophy, ChevronRight, Medal, Settings, User } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";

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
  players: Array<{ name: string; active: boolean }>;
}

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then(setGames);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: SessionSummary[]) => setRecentSessions(data.slice(0, 3)));
  }, []);

  const gameMap = new Map(games.map((g) => [g.id, g]));

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Scorecard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track any game, any time</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/admin"
              className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
            >
              <Settings size={22} />
            </Link>
            <Link
              href="/profile"
              className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
            >
              <User size={22} />
            </Link>
            <Link
              href="/players"
              className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
            >
              <Medal size={22} />
            </Link>
            <Link
              href="/history"
              className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
            >
              <Clock size={22} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-10 space-y-8">
        {/* Game selection */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            New Game
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => router.push(`/new?game=${game.id}`)}
              >
                <Card className="hover:border-accent/50 hover:bg-surface-elevated transition-all active:scale-[0.98] h-full">
                  <CardBody className="p-3 items-center text-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-2 bg-slate-200/30"
                    >
                      {game.emoji}
                    </div>
                    <div className="font-bold text-white text-sm leading-tight mb-0.5">
                      {game.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {game.minPlayers === game.maxPlayers
                        ? `${game.minPlayers}p`
                        : `${game.minPlayers}–${game.maxPlayers}p`}
                    </div>
                  </CardBody>
                </Card>
              </button>
            ))}
          </div>
        </section>

        {/* Recent completed sessions */}
        {recentSessions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Recent Games
              </h2>
              <Link href="/history" className="text-xs text-accent-light hover:text-accent">
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {recentSessions.map((s) => {
                const game = gameMap.get(s.gameId);
                const isActive = s.status === "active";
                const href = isActive ? `/game/${s.id}` : `/history/${s.id}`;
                return (
                  <Link key={s.id} href={href} className="block">
                    <Card className={cn(
                      "transition-all",
                      isActive ? "border-success/40 hover:border-success/70" : "hover:border-slate-600"
                    )}>
                      <CardBody>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-slate-200/30 shrink-0">{game?.emoji ?? "🎮"}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-200 text-sm">
                                {game?.name ?? s.gameId}
                              </span>
                              {isActive && <Badge variant="success">Active</Badge>}
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
        )}
      </main>
    </div>
  );
}
