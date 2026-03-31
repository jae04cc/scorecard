"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  UserPlus,
  RotateCcw,
  CheckCircle,
  Trash2,
  Undo2,
  Settings2,
  Crown,
} from "lucide-react";
import { GameIcon, gameIconStyle } from "@/components/ui/GameIcon";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { SettingPicker } from "@/components/ui/SettingPicker";
import { ScoreTable } from "@/components/game/ScoreTable";
import { StandingsBar } from "@/components/game/StandingsBar";
import { RoundEntryModal } from "@/components/game/RoundEntryModal";
import { CheatSheet } from "@/components/game/CheatSheet";
import { computeStandings, getGame, type GameDefinition } from "@/lib/games";
import { cn, formatDateTime, toProperCase, liveProperCase, findDuplicateName } from "@/lib/utils";

interface SessionData {
  id: string;
  gameId: string;
  status: string;
  createdAt: number;
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

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [game, setGame] = useState<GameDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [roundEntryOpen, setRoundEntryOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [endGameOpen, setEndGameOpen] = useState(false);
  const [endWinnerId, setEndWinnerId] = useState<string | null>(null);
  const [endWonGame, setEndWonGame] = useState<boolean | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) setSession(await res.json());
  }, [sessionId]);

  useEffect(() => {
    const init = async () => {
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      if (!sessionRes.ok) {
        router.push("/");
        return;
      }
      const sessionData: SessionData = await sessionRes.json();
      setSession(sessionData);
      setGame(getGame(sessionData.gameId) ?? null);
      setLoading(false);
    };
    init();
  }, [sessionId, router]);

  if (loading || !session || !game) {
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

  const hasWinner = standings.some((s) => s.isWinning);

  // --- Handlers ---

  const handleAddRound = async (
    entries: Array<{ playerId: string; score: number; metadata: Record<string, number> }>
  ) => {
    const res = await fetch(`/api/sessions/${sessionId}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    // 202 means the SW queued it for offline sync — treat as success
    if (!res.ok && res.status !== 202) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to save round");
    }
    haptic();
    if (res.status !== 202) await refresh();
  };

  const handleEditRound = (roundId: string) => {
    setEditingRoundId(roundId);
    setRoundEntryOpen(true);
  };

  const handleDeleteRound = async (roundId: string) => {
    if (!confirm("Delete this round?")) return;
    await fetch(`/api/sessions/${sessionId}/rounds/${roundId}`, { method: "DELETE" });
    await refresh();
  };

  const handleUndoRound = async () => {
    if (session.rounds.length === 0) return;
    const lastRound = session.rounds[session.rounds.length - 1];
    await fetch(`/api/sessions/${sessionId}/rounds/${lastRound.id}`, { method: "DELETE" });
    await refresh();
  };

  const handleAddPlayer = async () => {
    const normalizedName = toProperCase(newPlayerName);
    if (!normalizedName) return;
    const existingNames = session.players.filter((p) => p.active).map((p) => p.name);
    const dup = findDuplicateName([...existingNames, normalizedName]);
    if (dup) {
      setActionError(`A player named "${dup}" is already in this game.`);
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewPlayerName("");
      setAddPlayerOpen(false);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId: string, name: string) => {
    if (!confirm(`Remove ${name} from this game?`)) return;
    await fetch(`/api/sessions/${sessionId}/players/${playerId}`, { method: "DELETE" });
    await refresh();
  };

  const handleSaveSettings = async () => {
    setActionLoading(true);
    try {
      const merged = { ...settings, ...localSettings };
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: JSON.stringify(merged) }),
      });
      setSettingsOpen(false);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndGame = async () => {
    setActionLoading(true);
    try {
      const isSinglePlayer = activePlayers.length === 1;
      const updatedSettings = isSinglePlayer
        ? JSON.stringify({ ...settings, wonGame: endWonGame ?? false })
        : endWinnerId
          ? JSON.stringify({ ...settings, manualWinnerId: endWinnerId })
          : session.settings;
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: Date.now(),
          settings: updatedSettings,
        }),
      });
      setEndGameOpen(false);
      router.push(`/history/${sessionId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async (redirect: "/" | "/new" = "/") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", completedAt: Date.now() }),
      });
      if (!res.ok) throw new Error("Failed to save game");
      router.refresh();
      router.push(redirect);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save game");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this game? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      router.refresh();
      router.push("/");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      for (const r of session.rounds) {
        await fetch(`/api/sessions/${sessionId}/rounds/${r.id}`, { method: "DELETE" });
      }
      setResetOpen(false);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const editingRound = editingRoundId
    ? session.rounds.find((r) => r.id === editingRoundId)
    : null;

  const editingInitialValues = editingRound
    ? Object.fromEntries(
        editingRound.scores.map((s) => {
          const player = session.players.find((p) => p.id === s.playerId);
          const key = player?.team ?? s.playerId;
          return [key, JSON.parse(s.metadata ?? "{}")];
        })
      )
    : undefined;

  const nextRoundNumber = (session.rounds[session.rounds.length - 1]?.roundNumber ?? 0) + 1;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 pt-8 pb-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl text-slate-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={gameIconStyle(game.id)}
              >
                <GameIcon gameId={game.id} size={16} strokeWidth={1.5} fallback={game.emoji} />
              </div>
              <h1 className="text-xl font-black text-white">{game.name}</h1>
              <Badge variant={session.status === "active" ? "success" : "default"}>
                {session.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Started {formatDateTime(session.createdAt)}
            </p>
          </div>
          {/* Settings button — only when active and game has settings */}
          {session.status === "active" && game.settings.length > 0 && (
            <button
              onClick={() => {
                setLocalSettings({ ...settings });
                setSettingsOpen(true);
              }}
              className="p-2 rounded-xl text-slate-400 transition-colors"
            >
              <Settings2 size={18} />
            </button>
          )}
          <HeaderActions />
        </div>

        {/* Standings bar */}
        <StandingsBar
          standings={standings}
          winConditionType={winCondition.type}
          targetScore={targetScore}
          lowestWins={winCondition.type === "lowest" || (winCondition.type === "target" && winCondition.direction === "until-exceeded")}
        />
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 space-y-4 overflow-x-hidden">
        {/* Win notification */}
        {hasWinner && session.status === "active" && (() => {
          const winningNames = standings
            .filter((s) => s.isWinning)
            .map((s) => s.playerName)
            .join(" & ");
          return (
            <div className="bg-success/20 border border-success/40 rounded-2xl px-4 py-4 flex flex-col items-center gap-1 text-center">
              <span className="text-3xl">🏆</span>
              <div className="font-bold text-success text-lg">{winningNames} won!</div>
            </div>
          );
        })()}

        {/* Score table */}
        {(() => {
          const countSweeps = (settings["countSweeps"] as boolean) ?? false;
          const sweepPoints = (settings["sweepPoints"] as number) ?? 1;
          const getScoreBreakdown = game.id === "casino" && countSweeps
            ? (score: number, metadata?: string) => {
                if (!metadata) return null;
                try {
                  const meta = JSON.parse(metadata) as Record<string, number>;
                  const sweepCount = meta["sweeps"] ?? 0;
                  if (sweepCount === 0) return null;
                  const extra = sweepCount * sweepPoints;
                  return { base: score - extra, extra };
                } catch { return null; }
              }
            : undefined;

          const lowestWins = winCondition.type === "lowest" ||
            (winCondition.type === "target" && winCondition.direction === "until-exceeded");
          const bagPenaltyAt = settings["bagPenaltyAt"] as number | undefined;
          const showBags = bagPenaltyAt === undefined ? true : bagPenaltyAt > 0;
          return (
            <ScoreTable
              players={session.players}
              rounds={session.rounds}
              standings={standings}
              roundName={game.roundName}
              teamBubbleHeaders={activePlayers.some((p) => p.team)}
              targetScore={targetScore}
              onEditRound={session.status === "active" ? handleEditRound : undefined}
              onDeleteRound={session.status === "active" ? handleDeleteRound : undefined}
              getScoreBreakdown={getScoreBreakdown}
              lowestWins={lowestWins}
              showBags={showBags}
            />
          );
        })()}

        {/* Downforce single-player info card */}
        {game.id === "downforce" && (
          <div className="bg-surface-card rounded-2xl px-4 py-4 space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              This is a personal scorecard for tracking your own Downforce payouts — it's not intended to track everyone's scores simultaneously. Enter your auction spend via the{" "}
              <span className="text-slate-400">⚙ settings</span> icon, add a checkpoint after each payout, then mark whether you won at the end. Win/loss results count toward your stats.
            </p>
            {/* Simplified Downforce scorecard illustration */}
            <svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" className="w-full opacity-40">
              {/* Column headers */}
              <line x1="10" y1="20" x2="270" y2="20" stroke="#94a3b8" strokeWidth="1"/>
              <text x="15" y="15" fontSize="7" fill="#94a3b8" fontFamily="monospace">CAR #</text>
              {[1,2,3,4,5].map((c, i) => (
                <text key={c} x={70 + i * 40} y="15" fontSize="7" fill="#94a3b8" fontFamily="monospace" textAnchor="middle">#{c}</text>
              ))}
              {/* Betting card rows */}
              {["BET A","BET B","BET C"].map((label, row) => (
                <g key={label}>
                  <line x1="10" y1={20 + (row+1)*22} x2="270" y2={20 + (row+1)*22} stroke="#334155" strokeWidth="0.5"/>
                  <text x="15" y={20 + (row+1)*22 - 7} fontSize="6" fill="#64748b" fontFamily="monospace">{label}</text>
                  {[1,2,3,4,5].map((c, i) => (
                    <line key={c} x1={50 + i * 40} y1={20 + row*22 + 4} x2={90 + i * 40} y2={20 + row*22 + 4} stroke="#334155" strokeWidth="0.5"/>
                  ))}
                </g>
              ))}
              {/* Checkpoint rows */}
              {["CP 1","CP 2","CP 3","FINAL"].map((label, row) => (
                <g key={label}>
                  <line x1="10" y1={86 + (row+1)*18} x2="270" y2={86 + (row+1)*18} stroke="#334155" strokeWidth="0.5"/>
                  <text x="15" y={86 + (row+1)*18 - 5} fontSize="6" fill="#64748b" fontFamily="monospace">{label}</text>
                  {[1,2,3,4,5].map((c, i) => (
                    <rect key={c} x={50 + i * 40} y={86 + row*18 + 2} width="38" height="10" rx="1" fill="none" stroke="#334155" strokeWidth="0.5"/>
                  ))}
                </g>
              ))}
              {/* Net row */}
              <line x1="10" y1="158" x2="270" y2="158" stroke="#94a3b8" strokeWidth="1"/>
              <text x="15" y="155" fontSize="6" fill="#94a3b8" fontFamily="monospace" fontWeight="bold">NET</text>
              {[1,2,3,4,5].map((c, i) => (
                <rect key={c} x={50 + i * 40} y="145" width="38" height="11" rx="1" fill="none" stroke="#64748b" strokeWidth="0.75"/>
              ))}
            </svg>
          </div>
        )}

        {/* Cheat sheet */}
        {(() => {
          const sections = game.getCheatSheet
            ? game.getCheatSheet(settings, { playerCount: activePlayers.length })
            : (game.cheatSheet ?? []);
          return sections.length > 0
            ? <CheatSheet sections={sections} gameName={game.name} />
            : null;
        })()}
      </main>

      {/* Bottom action bar */}
      {session.status === "active" && (
        <footer className="px-4 pt-3 pb-8 border-t border-slate-700/50" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}>
          {hasWinner ? (
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={handleDelete} loading={actionLoading} className="shrink-0">
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleSave("/new")} loading={actionLoading} className="shrink-0">
                New Game
              </Button>
              <Button size="md" className="flex-1" onClick={() => handleSave("/")} loading={actionLoading}>
                <CheckCircle size={16} />
                Save
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetOpen(true)}
                className="shrink-0"
                title="Reset all scores"
              >
                <RotateCcw size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoRound}
                disabled={session.rounds.length === 0}
                className="shrink-0"
                title={`Undo last ${game.roundName.toLowerCase()}`}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEndWinnerId(null);
                  setEndWonGame(null);
                  setEndGameOpen(true);
                }}
                className="shrink-0"
              >
                <CheckCircle size={16} />
                End
              </Button>
              <Button
                size="md"
                className="flex-1"
                onClick={() => {
                  setEditingRoundId(null);
                  setRoundEntryOpen(true);
                }}
              >
                <Plus size={18} />
                Add {game.roundName}
              </Button>
            </div>
          )}
        </footer>
      )}

      {/* --- Modals --- */}

      {/* Round entry */}
      <RoundEntryModal
        open={roundEntryOpen}
        onClose={() => {
          setRoundEntryOpen(false);
          setEditingRoundId(null);
        }}
        game={game}
        players={session.players}
        settings={settings}
        roundNumber={editingRoundId ? editingRound?.roundNumber : nextRoundNumber}
        initialValues={editingInitialValues}
        onSubmit={
          editingRoundId
            ? async (entries) => {
                const res = await fetch(
                  `/api/sessions/${sessionId}/rounds/${editingRoundId}`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ entries }),
                  }
                );
                if (!res.ok) throw new Error((await res.json()).error);
                haptic();
                await refresh();
              }
            : handleAddRound
        }
      />

      {/* Add player */}
      <Modal open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} title="Add Player">
        <div className="space-y-4">
          <Input
            label="Player Name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(liveProperCase(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
            autoFocus
            placeholder="Enter name"
          />
          {actionError && <p className="text-danger text-sm">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setAddPlayerOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddPlayer} loading={actionLoading} className="flex-1">Add Player</Button>
          </div>
        </div>
      </Modal>

      {/* End game — single-player: did you win? / multi-player: optional winner override */}
      <Modal open={endGameOpen} onClose={() => setEndGameOpen(false)} title="End Game">
        <div className="space-y-4">
          {activePlayers.length === 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Did you win?</p>
              <div className="flex gap-2">
                {([true, false] as const).map((won) => (
                  <button
                    key={String(won)}
                    type="button"
                    onClick={() => setEndWonGame(endWonGame === won ? null : won)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                      endWonGame === won
                        ? won ? "border-success bg-success/15 text-success" : "border-danger bg-danger/15 text-danger"
                        : "border-slate-700 bg-surface-elevated text-slate-400"
                    )}
                  >
                    {won ? "🏆 Yes" : "Not this time"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            !hasWinner && standings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Mark Winner <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </p>
                <div className="space-y-1">
                  {standings.map((s) => (
                    <button
                      key={s.playerId}
                      type="button"
                      onClick={() => setEndWinnerId(endWinnerId === s.playerId ? null : s.playerId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all text-left",
                        endWinnerId === s.playerId
                          ? "border-accent bg-accent/10 text-white"
                          : "border-slate-700 bg-surface-elevated text-slate-300"
                      )}
                    >
                      <Crown size={14} className={endWinnerId === s.playerId ? "text-accent" : "text-slate-600"} />
                      <span className="flex-1 text-sm font-medium">{s.team ? `${s.team} (${s.playerName})` : s.playerName}</span>
                      <span className="font-mono text-xs text-slate-500">{s.total}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
          <Button variant="secondary" onClick={() => setEndGameOpen(false)} className="w-full">
            Keep Playing
          </Button>
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleDelete} loading={actionLoading} className="flex-1">
              Discard
            </Button>
            <Button onClick={handleEndGame} loading={actionLoading} className="flex-1">
              <CheckCircle size={16} />
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset confirmation */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Scores?">
        <div className="space-y-4">
          <p className="text-slate-300">
            This will permanently delete all rounds and scores for this game. Players will remain.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setResetOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleReset} loading={actionLoading} className="flex-1">Reset Scores</Button>
          </div>
        </div>
      </Modal>

      {/* Settings edit modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Game Settings">
        <div className="space-y-5">
          {game.settings.map((s) => {
            const showWhen = s.showWhen;
            if (showWhen) {
              const watchVal = localSettings[showWhen.setting] ?? settings[showWhen.setting];
              if (watchVal !== showWhen.value) return null;
            }
            const currentVal = localSettings[s.key] ?? settings[s.key] ?? s.defaultValue;
            return (
              <div key={s.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-200">{s.label}</label>
                  {s.description && (
                    <span className="text-xs text-slate-500">{s.description}</span>
                  )}
                </div>
                {s.type === "number" && s.min !== undefined && s.max !== undefined ? (
                  <SettingPicker
                    value={currentVal as number}
                    onChange={(v) => setLocalSettings((prev) => ({ ...prev, [s.key]: v }))}
                    min={s.min}
                    max={s.max}
                    minLabel={s.minLabel}
                    homePosition={s.homePosition}
                  />
                ) : s.type === "boolean" ? (
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setLocalSettings((prev) => ({ ...prev, [s.key]: v }))}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                          currentVal === v
                            ? "bg-accent text-white border-accent"
                            : "bg-surface-elevated border-slate-600 text-slate-300"
                        )}
                      >
                        {v ? "On" : "Off"}
                      </button>
                    ))}
                  </div>
                ) : s.type === "select" && s.options ? (
                  <div className="flex gap-2 flex-wrap">
                    {s.options.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setLocalSettings((prev) => ({ ...prev, [s.key]: opt.value }))}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors",
                          currentVal === opt.value
                            ? "bg-accent text-white border-accent"
                            : "bg-surface-elevated border-slate-600 text-slate-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveSettings} loading={actionLoading} className="flex-1">Save Settings</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
