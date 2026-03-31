"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, RotateCcw, Play, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { GameIcon, gameIconStyle } from "@/components/ui/GameIcon";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreTable } from "@/components/game/ScoreTable";
import { computeStandings, getGame, type GameDefinition } from "@/lib/games";
import { formatDateTimeRange } from "@/lib/utils";
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
  const [showSettings, setShowSettings] = useState(false);
  const [sharing, setSharing] = useState(false);

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

  const handlePlayAgain = async () => {
    if (!session || !game) return;
    const activePlayers = session.players.filter((p) => p.active);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: session.gameId,
        playerNames: activePlayers.map((p) => p.name),
        settings: JSON.parse(session.settings ?? "{}"),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/game/${data.id}`);
    }
  };

  const handleShare = async () => {
    if (!session || !game) return;
    setSharing(true);
    try {
      const activePlayers = session.players.filter((p) => p.active);
      const allScores = session.rounds.flatMap((r) =>
        r.scores.map((s) => ({ ...s, roundNumber: r.roundNumber }))
      );
      const parsedSettings = JSON.parse(session.settings ?? "{}");
      let stndgs = computeStandings(game, activePlayers, allScores, parsedSettings);
      const manualWinnerId = parsedSettings.manualWinnerId as string | undefined;
      if (manualWinnerId) {
        stndgs = stndgs.map((s) => ({
          ...s,
          isWinning: s.playerId === manualWinnerId,
          rank: s.playerId === manualWinnerId ? 1 : s.rank === 1 ? 2 : s.rank,
        }));
      }
      // For team games deduplicate by team, show all players in that team
      const seen = new Set<string>();
      const shareRows = stndgs.filter((s) => {
        const key = s.team ?? s.playerId;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const lines = [
        `${game.name} — ${new Date(session.createdAt).toLocaleDateString()}`,
        "",
        ...shareRows.map((s) => {
          const medal = s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`;
          const displayName = s.team
            ? stndgs.filter((m) => m.team === s.team).map((m) => m.playerName).join(" & ")
            : s.playerName;
          return `${medal} ${displayName}: ${s.total}`;
        }),
        "",
        `${session.rounds.length} ${game.roundName.toLowerCase()}${session.rounds.length !== 1 ? "s" : ""}`,
      ];
      const text = lines.join("\n");
      if (navigator.share) {
        await navigator.share({ title: `${game.name} Results`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Results copied to clipboard!");
      }
    } finally {
      setSharing(false);
    }
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
  let standings = computeStandings(game, activePlayers, allScores, settings);

  // Apply manual winner override if set
  const manualWinnerId = settings.manualWinnerId as string | undefined;
  if (manualWinnerId) {
    standings = standings.map((s) => ({
      ...s,
      isWinning: s.playerId === manualWinnerId,
      rank: s.playerId === manualWinnerId ? 1 : s.rank === 1 ? 2 : s.rank,
    }));
  }

  const winCondition = game.winCondition;
  const targetScore =
    (game.targetScoreSettingKey ? (settings[game.targetScoreSettingKey] as number | undefined) : undefined) ??
    (settings["targetScore"] as number | undefined) ??
    (winCondition.type === "target" || winCondition.type === "highest" || winCondition.type === "lowest"
      ? (winCondition as { targetScore?: number }).targetScore
      : undefined);

  const winners = standings.filter((s) => s.isWinning);
  const winningNames = winners.map((s) => s.playerName).join(" & ");
  const rankingRows = standings.filter(
    (s, i, arr) => !s.team || arr.findIndex((a) => a.team === s.team) === i
  );

  // Non-default settings to display
  const nonDefaultSettings = game.settings.filter((gs) => {
    const current = settings[gs.key];
    return current !== undefined && current !== gs.defaultValue;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 pt-8 pb-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.push("/history")}
            className="p-2 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={gameIconStyle(game.id)}
              >
                <GameIcon gameId={game.id} size={16} strokeWidth={1.5} fallback={game.emoji} />
              </div>
              <h1 className="text-xl font-black text-white">{game.name}</h1>
              <Badge variant={session.status === "completed" ? "accent" : "success"}>
                {session.status}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              {formatDateTimeRange(session.createdAt, session.completedAt)}
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
              {manualWinnerId && <span className="text-slate-500 text-xs ml-1">(early end)</span>}
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
                <span className={cn("font-mono font-bold", s.isWinning ? "text-success" : "text-slate-200")}>
                  {s.total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Settings used (non-default only, collapsible) */}
        {nonDefaultSettings.length > 0 && (
          <div className="bg-surface-card rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Settings Used</span>
              {showSettings ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>
            {showSettings && (
              <div className="px-4 pb-3 space-y-1.5 border-t border-slate-700/50">
                {nonDefaultSettings.map((gs) => {
                  const val = settings[gs.key];
                  let displayVal = String(val);
                  if (gs.type === "boolean") displayVal = val ? "On" : "Off";
                  if (gs.options) {
                    const opt = gs.options.find((o) => o.value === val);
                    if (opt) displayVal = opt.label;
                  }
                  return (
                    <div key={gs.key} className="flex items-center justify-between py-1">
                      <span className="text-sm text-slate-400">{gs.label}</span>
                      <span className="text-sm font-medium text-slate-200">{displayVal}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/history")} size="sm" className="shrink-0">
            <ArrowLeft size={14} />
            Back
          </Button>
          {session.status === "completed" && (
            <Button variant="ghost" size="sm" onClick={handleReactivate} className="shrink-0">
              <RotateCcw size={14} />
              Reopen
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleShare} loading={sharing} className="shrink-0">
            <Share2 size={14} />
            Share
          </Button>
          <Button onClick={handlePlayAgain} size="sm" className="flex-1">
            <Play size={14} />
            Again
          </Button>
        </div>
      </footer>
    </div>
  );
}
