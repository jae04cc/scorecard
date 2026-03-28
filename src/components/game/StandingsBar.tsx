"use client";
import { cn } from "@/lib/utils";
import type { Standing } from "@/lib/games/types";
import { Trophy } from "lucide-react";

interface StandingsBarProps {
  standings: Standing[];
  winConditionType: "highest" | "lowest" | "target";
  targetScore?: number;
  lowestWins?: boolean;
}

export function StandingsBar({ standings, winConditionType, targetScore, lowestWins }: StandingsBarProps) {
  if (standings.length === 0) return null;

  // Deduplicate by team; build display name from all members' playerNames
  const displayStandings = standings.reduce<Array<Standing & { displayName: string }>>((acc, s) => {
    if (s.team) {
      if (!acc.find((a) => a.team === s.team)) {
        const members = standings
          .filter((m) => m.team === s.team)
          .map((m) => m.playerName)
          .join(" & ");
        acc.push({ ...s, displayName: members });
      }
    } else {
      acc.push({ ...s, displayName: s.playerName });
    }
    return acc;
  }, []);

  // Use targetScore as the 100% mark; fall back to highest total
  const maxTotal = Math.max(...displayStandings.map((s) => s.total), 1);
  const denominator = targetScore ?? maxTotal;

  return (
    <div className="w-full max-w-[640px] space-y-2">
      {displayStandings.map((s) => {
        // Bar fills left-to-right based on score (for lowest-wins, shorter bar = better)
        const rawPct = Math.min(100, Math.max(0, (s.total / denominator) * 100));
        const isLeading = s.rank === 1;
        const remaining = targetScore !== undefined ? targetScore - s.total : null;
        // For lowest-wins: highlight "left" in danger color when close to the trigger (≤25% remaining)
        const isCloseToTrigger = lowestWins && targetScore !== undefined && s.total >= targetScore * 0.75;

        return (
          <div key={s.team ?? s.playerId} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-sm font-medium text-slate-200 truncate text-right">
              {s.displayName}
            </div>
            <div className="flex-1 relative h-8 bg-surface-elevated rounded-lg overflow-hidden">
              <div
                className={cn(
                  "absolute left-0 top-0 h-full rounded-lg transition-all duration-500",
                  isLeading ? "bg-accent/60" : "bg-slate-600/50"
                )}
                style={{ width: `${rawPct}%` }}
              />
              <div className="absolute inset-0 flex items-center px-2.5 gap-1.5">
                {isLeading && <Trophy size={12} className="text-warning shrink-0" />}
                <span
                  className={cn(
                    "font-mono text-sm font-bold",
                    isLeading ? "text-white" : "text-slate-300"
                  )}
                >
                  {s.total}
                </span>
              </div>
            </div>
            {targetScore !== undefined && remaining !== null && (
              <div className={cn(
                "w-12 text-xs text-right shrink-0",
                isCloseToTrigger ? "text-danger font-semibold" : "text-slate-500"
              )}>
                {remaining > 0 ? `${remaining} left` : "Done!"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
