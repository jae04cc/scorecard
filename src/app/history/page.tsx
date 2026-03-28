"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Clock, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDuration } from "@/lib/utils";

interface GameInfo {
  id: string;
  name: string;
  emoji: string;
}

interface SessionSummary {
  id: string;
  gameId: string;
  status: "active" | "completed" | "abandoned";
  createdAt: number;
  completedAt: number | null;
  players: Array<{ name: string; active: boolean }>;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const refresh = async () => {
    const [sessionsRes, gamesRes] = await Promise.all([
      fetch("/api/sessions"),
      fetch("/api/games"),
    ]);
    setSessions(await sessionsRes.json());
    setGames(await gamesRes.json());
  };

  useEffect(() => { refresh(); }, []);

  const gameMap = new Map(games.map((g) => [g.id, g]));

  const filtered = sessions.filter(
    (s) => filter === "all" || s.status === filter
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this game record? This cannot be undone.")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-5 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-black text-white">Game History</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-surface-card rounded-xl p-1">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f
                  ? "bg-accent text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 pb-10">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p>No games found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const game = gameMap.get(s.gameId);
              const playerList = s.players
                .filter((p) => p.active)
                .map((p) => p.name)
                .join(", ");

              return (
                <Link
                  key={s.id}
                  href={s.status === "active" ? `/game/${s.id}` : `/history/${s.id}`}
                  className="block"
                >
                  <Card className={`hover:border-slate-600 transition-all active:scale-[0.99] cursor-pointer group ${s.status === "active" ? "border-success/40" : ""}`}>
                    <CardBody>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl shrink-0">{game?.emoji ?? "🎮"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm">
                              {game?.name ?? s.gameId}
                            </span>
                            <Badge
                              variant={
                                s.status === "active"
                                  ? "success"
                                  : s.status === "completed"
                                  ? "accent"
                                  : "default"
                              }
                            >
                              {s.status}
                            </Badge>
                            <span className="text-xs text-slate-500 bg-surface-elevated rounded-full px-2 py-0.5">
                              {formatDuration(s.createdAt, s.completedAt ?? Date.now())}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{playerList}</p>
                          <p className="text-xs text-slate-600">
                            {formatDateTime(s.createdAt)}
                            {s.completedAt && <> → {formatDateTime(s.completedAt)}</>}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-danger/10 text-slate-600 hover:text-danger"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
