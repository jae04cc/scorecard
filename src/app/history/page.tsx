"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Clock, Trash2, Unlink, Download, Search, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GameIcon, gameIconStyle } from "@/components/ui/GameIcon";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { HeaderActions } from "@/components/ui/HeaderActions";

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
  userId: string | null;
  ownerName?: string | null;
  authEnabled?: boolean;
  players: Array<{ name: string; active: boolean }>;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const { data: authSession } = useSession();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState<boolean>(true);

  const isAdmin = authSession?.user.role === "admin";

  const refresh = async () => {
    const [sessionsRes, gamesRes] = await Promise.all([
      fetch("/api/sessions"),
      fetch("/api/games"),
    ]);
    setSessions(await sessionsRes.json());
    setGames(await gamesRes.json());
  };

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((d) => setAuthEnabled(d.authEnabled));
    refresh();
    if (isAdmin) {
      fetch("/api/admin/users").then((r) => r.json()).then(setUsers);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleAssign = async (sessionId: string, userId: string | null) => {
    setAssigningId(sessionId);
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await refresh();
    setAssigningId(null);
  };

  const gameMap = new Map(games.map((g) => [g.id, g]));

  const searchLower = search.toLowerCase().trim();
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

  const filtered = sessions.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (searchLower) {
      const gameName = (gameMap.get(s.gameId)?.name ?? s.gameId).toLowerCase();
      const playerNames = s.players.filter((p) => p.active).map((p) => p.name.toLowerCase());
      const matchesGame = gameName.includes(searchLower);
      const matchesPlayer = playerNames.some((n) => n.includes(searchLower));
      if (!matchesGame && !matchesPlayer) return false;
    }
    if (fromMs && s.createdAt < fromMs) return false;
    if (toMs && s.createdAt > toMs) return false;
    return true;
  });

  const handleExportCsv = () => {
    const rows = [
      ["ID", "Game", "Status", "Players", "Started", "Completed"],
      ...sessions.map((s) => {
        const game = gameMap.get(s.gameId);
        const players = s.players.filter((p) => p.active).map((p) => p.name).join("; ");
        const started = new Date(s.createdAt).toLocaleString();
        const completed = s.completedAt ? new Date(s.completedAt).toLocaleString() : "";
        return [s.id, game?.name ?? s.gameId, s.status, players, started, completed];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scorecard-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            className="p-2 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-black text-white">Game History</h1>
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => setShowSearch((v) => !v)}
              title="Search"
              className="p-2 rounded-xl text-slate-400 transition-colors"
            >
              <Search size={18} />
            </button>
            <button
              onClick={handleExportCsv}
              title="Export CSV"
              className="p-2 rounded-xl text-slate-400 transition-colors"
            >
              <Download size={18} />
            </button>
            <HeaderActions />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-surface-card rounded-xl p-1 mb-2">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f
                  ? "bg-accent text-white"
                  : "text-slate-400"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search / date filter panel */}
        {showSearch && (
          <div className="space-y-2 pt-1 pb-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by game or player…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-card border border-slate-700 rounded-xl pl-8 pr-8 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 bg-surface-card border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent [color-scheme:dark]"
              />
              <span className="text-slate-600 text-xs self-center">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 bg-surface-card border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-accent [color-scheme:dark]"
              />
            </div>
          </div>
        )}
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
              const isOrphaned = s.userId === null;

              return (
                <div key={s.id}>
                <Link
                  href={s.status === "active" ? `/game/${s.id}` : `/history/${s.id}`}
                  className="block"
                >
                  <Card className={`transition-all active:scale-[0.99] cursor-pointer ${s.status === "active" ? "border-success/40" : ""}`}>
                    <CardBody>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={gameIconStyle(s.gameId)}
                        >
                          <GameIcon gameId={s.gameId} size={18} strokeWidth={1.5} fallback={game?.emoji ?? "🎮"} />
                        </div>
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
                            {authEnabled && isAdmin && isOrphaned && (
                              <Badge variant="default">
                                <span className="flex items-center gap-0.5">
                                  <Unlink size={9} />
                                  Orphaned
                                </span>
                              </Badge>
                            )}
                            <span className="text-xs text-slate-500 bg-surface-elevated rounded-full px-2 py-0.5">
                              {formatDuration(s.createdAt, s.completedAt ?? Date.now())}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{playerList}</p>
                          {authEnabled && isAdmin && s.ownerName && (
                            <p className="text-xs text-slate-500 mt-0.5">{s.ownerName}</p>
                          )}
                          <p className="text-[10px] text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">
                            {formatDateTime(s.createdAt)}
                            {s.completedAt && <> → {formatDateTime(s.completedAt)}</>}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          className="p-2 rounded-lg text-slate-700 active:text-danger shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
                {authEnabled && isAdmin && isOrphaned && (
                  <div className="mt-1 px-1 flex items-center gap-2">
                    <Unlink size={11} className="text-slate-600 shrink-0" />
                    <span className="text-xs text-slate-600">Assign to:</span>
                    <select
                      className="flex-1 text-xs bg-surface-card border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-accent disabled:opacity-50"
                      defaultValue=""
                      disabled={assigningId === s.id}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleAssign(s.id, val);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>Select user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email ?? u.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
