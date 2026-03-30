"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreTable } from "@/components/game/ScoreTable";
import { computeStandings, getGame, type GameDefinition } from "@/lib/games";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SessionData {
  id: string;
  gameId: string;
  status: string;
  createdAt: number;
  completedAt: number | null;
  settings: string;
  players: Array<{
    id: string;
    name: string;
    team: string | null;
    position: number;
    active: boolean;
  }>;
  rounds: Array<{
    id: string;
    roundNumber: number;
    label: string | null;
    createdAt: number;
    scores: Array<{ playerId: string; score: number; metadata: string }>;
  }>;
}

export default function GameHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [game, setGame] = useState<GameDefinition | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((s: SessionData) => {
        setSession(s);
        setGame(getGame(s.gameId) ?? null);
      });
  }, [sessionId]);

  const handleReactivate = async () => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", completedAt: null }),
    });
    router.push(`/game/${sessionId}`);
  };

  if (!session || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const settings = JSON.parse(session.settings ?? "{}");
  const activePlayers = session.players.filter((p) => p.active);
  const allScores = session.rounds.flatMap((r) =>
    r.scores.map((s) => ({ ...s, roundNumber: r.roundNumber }))
  );
  const standings = computeStandings(game, activePlayers, allScores, settings);

  const winCondition = game.winCondition;
  const targetScore =
    (game.targetScoreSettingKey ? (settings[game.targetScoreSettingKey] as number | undefined) : undefined) ??
    (settings["targetScore"] as number | undefined) ??
    (winCondition.type === "target" || winCondition.type === "highest" || winCondition.type === "lowest"
      ? (winCondition as { targetScore?: number }).targetScore
      : undefined);

  const winners = standings.filter((s) => s.isWinning);
  const winningNames = winners.map((s) => s.playerName).join(" & ");
  // For rankings: deduplicate by team, show player names
  const rankingRows = standings.filter(
    (s, i, arr) => !s.team || arr.findIndex((a) => a.team === s.team) === i
  );

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 pt-8 pb-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push("/history")}
            className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-slate-200/30 shrink-0">{game.emoji}</div>
              <h1 className="text-xl font-black text-white">{game.name}</h1>
              <Badge variant={session.status === "completed" ? "accent" : "success"}>
                {session.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDateTime(session.createdAt)}
              {session.completedAt && ` — ended ${formatDateTime(session.completedAt)}`}
            </p>
          </div>
          <HeaderActions />
        </div>

        {/* Final standings podium */}
        {winners.length > 0 && (
          <div className="bg-success/20 border border-success/40 rounded-2xl px-4 py-4 mb-3 flex flex-col items-center gap-1 text-center">
            <span className="text-3xl">🏆</span>
            <div className="font-bold text-success text-lg">{winningNames} won!</div>
            <div className="text-sm text-slate-400">
              {session.rounds.length} {game.roundName.toLowerCase()}
              {session.rounds.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Final rankings */}
        <div className="space-y-1">
          {rankingRows.map((s) => {
            const displayName = s.team
              ? standings.filter((m) => m.team === s.team).map((m) => m.playerName).join(" & ")
              : s.playerName;
            return (
              <div
                key={s.team ?? s.playerId}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl",
                  s.isWinning ? "bg-success/10" : "bg-surface-card"
                )}
              >
                <span className="text-sm font-bold w-5 text-center">
                  {s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`}
                </span>
                <span className="flex-1 font-medium text-slate-200">{displayName}</span>
                <span className={cn(
                  "font-mono font-bold",
                  s.isWinning ? "text-success" : "text-slate-200"
                )}>
                  {s.total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Full score table */}
        {session.rounds.length > 0 && (
          <ScoreTable
            players={session.players}
            rounds={session.rounds}
            standings={standings}
            roundName={game.roundName}
            teamBubbleHeaders={game.supportsTeams}
            targetScore={targetScore}
          />
        )}
      </main>

      <footer className="px-4 pt-3 border-t border-slate-700/50" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push("/history")} className="flex-1">
            Back
          </Button>
          {session.status === "completed" && (
            <Button variant="ghost" onClick={handleReactivate}>
              <RotateCcw size={16} />
              Reopen
            </Button>
          )}
          <Button onClick={() => router.push("/new")} className="flex-1">
            New Game
          </Button>
        </div>
      </footer>
    </div>
  );
}
