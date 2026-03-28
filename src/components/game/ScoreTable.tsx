"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Standing } from "@/lib/games/types";
import { Trophy, Minus } from "lucide-react";

interface Player {
  id: string;
  name: string;
  team?: string | null;
  active: boolean;
}

interface RoundScore {
  playerId: string;
  score: number;
  metadata?: string;
}

interface Round {
  id: string;
  roundNumber: number;
  label?: string | null;
  scores: RoundScore[];
}

interface ScoreTableProps {
  players: Player[];
  rounds: Round[];
  standings: Standing[];
  roundName: string;
  // When true, renders team bubbles as column headers (guarantees alignment)
  teamBubbleHeaders?: boolean;
  targetScore?: number;
  onEditRound?: (roundId: string) => void;
  onDeleteRound?: (roundId: string) => void;
  // Optional: return {base, extra} to render "base+extra" in score cells
  getScoreBreakdown?: (score: number, metadata?: string) => { base: number; extra: number } | null;
  // When true, negative scores are colored green (good) and positive are neutral
  lowestWins?: boolean;
  // When false, hide bag count in column headers (e.g. Spades with bags disabled)
  showBags?: boolean;
}

interface Column {
  key: string;
  label: string;        // team name or player name
  sublabel?: string;    // player names for team column
  playerIds: string[];
}

export function ScoreTable({
  players,
  rounds,
  standings,
  roundName,
  teamBubbleHeaders = false,
  targetScore,
  onEditRound,
  onDeleteRound,
  getScoreBreakdown,
  lowestWins = false,
  showBags = true,
}: ScoreTableProps) {
  const activePlayers = players.filter((p) => p.active);
  const isTeamGame = activePlayers.some((p) => p.team);

  // Track window width to switch between compact and normal header mode
  const [windowWidth, setWindowWidth] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 768)
  );
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Compact mode when 5+ players AND screen too narrow for normal bubble headers (~80px per column)
  const isCompact = !isTeamGame && activePlayers.length > 4 && windowWidth < activePlayers.length * 80;

  // Truncate a name to at most 5 visible characters for compact bubble display
  const truncate = (name: string) => name.length > 5 ? `${name.slice(0, 5)}\u2026` : name;

  // Get the label to display inside a bubble (first player name for teams, player name for individuals)
  const getBubbleLabel = (col: Column): string => {
    const text = col.sublabel ?? col.label;
    const name = text.includes(" & ") ? text.split(" & ")[0] : text;
    return truncate(name);
  };

  const columns: Column[] = isTeamGame
    ? Array.from(
        new Map(activePlayers.map((p) => [p.team ?? p.id, p])).entries()
      ).map(([teamKey, rep]) => {
        const members = activePlayers.filter((p) => p.team === rep.team);
        return {
          key: teamKey,
          label: rep.team ?? rep.name,
          sublabel: members.map((p) => p.name).join(" & "),
          playerIds: members.map((p) => p.id),
        };
      })
    : activePlayers.map((p) => ({
        key: p.id,
        label: p.name,
        playerIds: [p.id],
      }));

  const getColumnScore = (round: Round, col: Column): number | null => {
    for (const pid of col.playerIds) {
      const s = round.scores.find((s) => s.playerId === pid);
      if (s !== undefined) return s.score;
    }
    return null;
  };

  const getStanding = (col: Column): Standing | undefined =>
    standings.find((s) => col.playerIds.includes(s.playerId));

  // Show bag penalty row if any column has accumulated penalties
  const hasBagPenalties = columns.some(
    (col) => ((getStanding(col)?.extras?.["bagPenalty"] as number) ?? 0) > 0
  );

  return (
    <div className="w-full">
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr>
            {columns.map((col) => {
              const standing = getStanding(col);
              const winning = standing?.isWinning ?? false;
              const bags = standing?.extras?.["bags"] as number | undefined;
              if (isCompact) {
                return (
                  <th key={col.key} className="px-0.5 pb-1 pt-2" style={{ width: `${100 / columns.length}%` }}>
                    <div className={cn(
                      "flex flex-col items-center gap-0.5",
                      winning && "text-success"
                    )}>
                      {winning && <Trophy size={10} className="text-warning" />}
                      <span
                        className={cn(
                          "text-xs font-semibold text-center",
                          winning ? "text-slate-100" : "text-slate-400"
                        )}
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: 72, overflow: "hidden" }}
                      >
                        {truncate(col.label)}
                      </span>
                    </div>
                  </th>
                );
              }
              return (
                <th key={col.key} className="px-2 py-2" style={{ width: `${100 / columns.length}%` }}>
                  <div className={cn(
                    "flex flex-col items-center rounded-2xl px-2 py-4 bg-surface-card",
                    winning && "ring-1 ring-success/50"
                  )}>
                    {winning && <Trophy size={14} className="text-warning mb-1" />}
                    <span className="font-semibold text-slate-100 text-base text-center truncate w-full">
                      {col.sublabel ?? col.label}
                    </span>
                    {showBags && bags !== undefined && bags > 0 && (() => {
                      const pos = ((bags - 1) % 10) + 1;
                      const bagColor = pos >= 8 ? "text-danger" : pos >= 5 ? "text-warning" : "text-slate-500";
                      return (
                        <span className={cn("text-xs mt-1.5 font-medium", bagColor)}>
                          🎒 {bags}
                        </span>
                      );
                    })()}
                  </div>
                </th>
              );
            })}
          </tr>

          {/* Thin divider under headers */}
          <tr className="border-b border-slate-700/50">
            {columns.map((col) => <td key={col.key} />)}
          </tr>
        </thead>

        <tbody>
          {rounds.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-600 text-sm"
              >
                No {roundName.toLowerCase()}s recorded yet
              </td>
            </tr>
          ) : (
            rounds.map((round) => (
              <tr
                key={round.id}
                className={cn(
                  "border-b border-slate-700/30 select-none [-webkit-tap-highlight-color:transparent]",
                  onEditRound && "cursor-pointer"
                )}
                onClick={() => {
                  if (!onEditRound) return;
                  if (window.confirm(`Edit this ${roundName.toLowerCase()}?`)) {
                    onEditRound(round.id);
                  }
                }}
              >
                {columns.map((col) => {
                  const score = getColumnScore(round, col);
                  const metadata = (() => {
                    for (const pid of col.playerIds) {
                      const s = round.scores.find((s) => s.playerId === pid);
                      if (s?.metadata) return s.metadata;
                    }
                    return undefined;
                  })();
                  const breakdown = score !== null && getScoreBreakdown
                    ? getScoreBreakdown(score, metadata)
                    : null;
                  return (
                    <td key={col.key} className={cn("text-center font-mono", isCompact ? "px-0.5 py-1.5" : "px-3 py-2.5")}>
                      {score === null ? (
                        <Minus size={12} className="mx-auto text-slate-600" />
                      ) : breakdown ? (
                        <span className="text-slate-200">
                          {breakdown.base}
                          <span className="text-slate-400">+</span>
                          <span className="text-accent">{breakdown.extra}</span>
                        </span>
                      ) : (
                        <span className={cn(
                          isCompact ? "text-xs" : "text-sm",
                          lowestWins
                            ? score < 0 ? "text-success" : score > 0 ? "text-slate-200" : "text-slate-500"
                            : score < 0 ? "text-danger" : score > 0 ? "text-slate-200" : "text-slate-500"
                        )}>
                          {score}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>

        <tfoot>
          {/* Bag penalty row — shown only when bags have triggered a penalty */}
          {hasBagPenalties && (
            <tr className="border-t border-danger/20 bg-danger/5">
              {columns.map((col) => {
                const penalty = (getStanding(col)?.extras?.["bagPenalty"] as number) ?? 0;
                return (
                  <td key={col.key} className="px-3 py-1 text-center">
                    {penalty > 0 && (
                      <span className="font-mono text-danger/70 inline-flex items-center gap-1">
                        −{penalty} 🎒
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          )}

          <tr className="border-t-2 border-slate-600 bg-surface-elevated">
            {columns.map((col) => {
              const standing = getStanding(col);
              const total = standing?.total ?? 0;
              const rank = standing?.rank ?? 0;
              const winning = standing?.isWinning ?? false;
              return (
                <td key={col.key} className={cn("text-center", isCompact ? "px-0.5 py-2" : "px-3 py-3")}>
                  <span className={cn(
                    "font-bold font-mono",
                    isCompact ? "text-sm" : "text-lg",
                    winning ? "text-success" : rank === 2 ? "text-slate-300" : "text-slate-400"
                  )}>
                    {total}
                  </span>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
