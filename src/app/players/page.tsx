"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Swords, Trophy } from "lucide-react";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { GameIcon } from "@/components/ui/GameIcon";

interface GameBreakdown {
  groupKey: string;
  gameId: string;
  gameName: string;
  gameEmoji: string;
  wins: number;
  losses: number;
  totalGames: number;
  avgScore: number | null;
}

interface H2HRecord {
  opponent: string;
  wins: number;
  losses: number;
}

interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  totalGames: number;
  winPct: number;
  qualified: boolean;
  byGame: GameBreakdown[];
  h2h: H2HRecord[];
}

type ExpandSection = "games" | "h2h";

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

// One player's row plus its expandable breakdown. `rank` is null for players
// short of the games threshold — they still get their full record, just no
// standing implied by a position on the board.
function PlayerRow({
  player,
  rank,
  isExpanded,
  onToggle,
  section,
  onSection,
}: {
  player: PlayerStat;
  rank: number | null;
  isExpanded: boolean;
  onToggle: () => void;
  section: ExpandSection;
  onSection: (section: ExpandSection) => void;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div className="rounded-2xl bg-surface-card overflow-hidden">
      {/* Main row */}
      <button className="w-full flex items-center px-4 py-3 transition-colors" onClick={onToggle}>
        <span className="w-6 text-sm">
          {medal ?? (
            <span className="text-slate-500 font-mono text-xs">{rank === null ? "–" : `#${rank}`}</span>
          )}
        </span>
        <span className="flex-1 text-left font-semibold text-slate-100 text-sm">{player.name}</span>
        <span className="w-12 text-center font-mono text-sm text-success">{player.wins}</span>
        <span className="w-12 text-center font-mono text-sm text-danger">{player.losses}</span>
        <div className="w-20 flex flex-col items-end gap-1">
          <span className="font-mono text-sm text-slate-200">{Math.round(player.winPct * 100)}%</span>
          <WinBar pct={player.winPct} />
        </div>
        <span className="ml-2 text-slate-500">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded breakdown */}
      {isExpanded && (
        <div className="border-t border-slate-700/50">
          {/* Section tabs */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => onSection("games")}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                section === "games" ? "text-accent border-b-2 border-accent" : "text-slate-500"
              }`}
            >
              By Game · {player.totalGames}
            </button>
            {player.h2h.length > 0 && (
              <button
                onClick={() => onSection("h2h")}
                className={`flex-1 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                  section === "h2h" ? "text-accent border-b-2 border-accent" : "text-slate-500"
                }`}
              >
                <Swords size={11} />
                Head-to-Head
              </button>
            )}
          </div>

          {section === "games" && (
            <div className="px-4 py-3 space-y-2">
              {player.byGame.map((g) => (
                <div key={g.groupKey} className="flex items-center gap-2">
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
                    <span className="font-mono text-xs text-slate-600 w-14 text-right">
                      avg {g.avgScore}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {section === "h2h" && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-600 mb-1">Games played directly against each opponent</p>
              {player.h2h.map((r) => {
                const total = r.wins + r.losses;
                const pct = total > 0 ? r.wins / total : 0;
                return (
                  <div key={r.opponent} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-slate-300">{r.opponent}</span>
                    <span className="font-mono text-sm text-success w-8 text-center">{r.wins}</span>
                    <span className="text-slate-600 text-xs">–</span>
                    <span className="font-mono text-sm text-danger w-8 text-center">{r.losses}</span>
                    <span className="font-mono text-xs text-slate-500 w-10 text-right">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [minGames, setMinGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandSection, setExpandSection] = useState<Record<string, ExpandSection>>({});

  useEffect(() => {
    fetch("/api/players/stats")
      .then((r) => r.json())
      .then((data) => {
        setPlayers(data.players ?? []);
        setMinGames(data.minGames ?? 0);
        setLoading(false);
      });
  }, []);

  const toggleSection = (playerName: string, section: ExpandSection) => {
    setExpandSection((prev) => ({
      ...prev,
      [playerName]: prev[playerName] === section ? "games" : section,
    }));
  };

  // The API sorts ranked players by record and the rest alphabetically; all
  // this has to do is find the seam.
  const ranked = players.filter((p) => p.qualified);
  const unranked = players.filter((p) => !p.qualified);

  const rowProps = (player: PlayerStat) => ({
    player,
    isExpanded: expanded === player.name,
    onToggle: () => setExpanded(expanded === player.name ? null : player.name),
    section: expandSection[player.name] ?? ("games" as ExpandSection),
    onSection: (section: ExpandSection) => toggleSection(player.name, section),
  });

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl text-slate-400 transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Leaderboard</h1>
        <HeaderActions />
      </header>

      <main className="flex-1 px-5 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-20 px-8">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-surface-card flex items-center justify-center">
              <Trophy size={28} className="text-slate-500" />
            </div>
            <p className="text-slate-300 font-semibold">No stats yet</p>
            <p className="text-slate-600 text-sm mt-1">Complete a game to see the leaderboard</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.length > 0 ? (
              <>
                {/* Header row */}
                <div className="flex items-center px-4 pb-1">
                  <span className="w-6 text-xs text-slate-600 font-bold">#</span>
                  <span className="flex-1 text-xs text-slate-600 font-bold uppercase tracking-widest">Player</span>
                  <span className="w-12 text-xs text-slate-600 font-bold text-center">W</span>
                  <span className="w-12 text-xs text-slate-600 font-bold text-center">L</span>
                  <span className="w-20 text-xs text-slate-600 font-bold text-right">Win %</span>
                </div>

                {ranked.map((player, idx) => (
                  <PlayerRow key={player.name} rank={idx + 1} {...rowProps(player)} />
                ))}
              </>
            ) : (
              // Everyone is still short of the threshold — say so, rather than
              // leaving an empty table sitting above the unranked list.
              <p className="px-4 py-3 text-sm text-slate-500">
                No one has {minGames} games in yet, so there&apos;s nothing to rank.
              </p>
            )}

            {unranked.length > 0 && (
              <section className="pt-6">
                <div className="flex items-baseline justify-between px-4 pb-1">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">Unranked</span>
                  <span className="text-xs text-slate-600">
                    Under {minGames} game{minGames === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2">
                  {unranked.map((player) => (
                    <PlayerRow key={player.name} rank={null} {...rowProps(player)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
