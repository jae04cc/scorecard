"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

interface GameBreakdown {
  gameId: string;
  gameName: string;
  gameEmoji: string;
  wins: number;
  losses: number;
  totalGames: number;
}

interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  totalGames: number;
  winPct: number;
  byGame: GameBreakdown[];
}

function WinBar({ pct }: { pct: number }) {
  return (
    <div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
      <div
        className="h-full bg-accent rounded-full"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
}

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/players/stats")
      .then((r) => r.json())
      .then((data) => { setPlayers(data); setLoading(false); });
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Leaderboard</h1>
      </header>

      <main className="flex-1 px-5 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🏆</div>
            <p>No completed games yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex items-center px-4 pb-1">
              <span className="w-6 text-xs text-slate-600 font-bold">#</span>
              <span className="flex-1 text-xs text-slate-600 font-bold uppercase tracking-widest">Player</span>
              <span className="w-12 text-xs text-slate-600 font-bold text-center">W</span>
              <span className="w-12 text-xs text-slate-600 font-bold text-center">L</span>
              <span className="w-20 text-xs text-slate-600 font-bold text-right">Win %</span>
            </div>

            {players.map((player, idx) => {
              const isExpanded = expanded === player.name;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

              return (
                <div
                  key={player.name}
                  className="rounded-2xl bg-surface-card border border-slate-700/50 overflow-hidden"
                >
                  {/* Main row */}
                  <button
                    className="w-full flex items-center px-4 py-3 hover:bg-surface-elevated transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : player.name)}
                  >
                    <span className="w-6 text-sm">
                      {medal ?? <span className="text-slate-500 font-mono text-xs">#{idx + 1}</span>}
                    </span>
                    <span className="flex-1 text-left font-semibold text-slate-100 text-sm">
                      {player.name}
                    </span>
                    <span className="w-12 text-center font-mono text-sm text-success">{player.wins}</span>
                    <span className="w-12 text-center font-mono text-sm text-danger">{player.losses}</span>
                    <div className="w-20 flex flex-col items-end gap-1">
                      <span className="font-mono text-sm text-slate-200">
                        {Math.round(player.winPct * 100)}%
                      </span>
                      <WinBar pct={player.winPct} />
                    </div>
                    <span className="ml-2 text-slate-500">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {/* Expanded breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/50 px-4 py-3 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                        By Game · {player.totalGames} total
                      </p>
                      {player.byGame.map((g) => (
                        <div key={g.gameId} className="flex items-center gap-2">
                          <span className="text-base w-6 text-center">{g.gameEmoji}</span>
                          <span className="flex-1 text-sm text-slate-300">{g.gameName}</span>
                          <span className="font-mono text-sm text-success w-8 text-center">{g.wins}</span>
                          <span className="text-slate-600 text-xs">–</span>
                          <span className="font-mono text-sm text-danger w-8 text-center">{g.losses}</span>
                          <span className="font-mono text-xs text-slate-500 w-10 text-right">
                            {Math.round((g.wins / g.totalGames) * 100)}%
                          </span>
                        </div>
                      ))}
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
