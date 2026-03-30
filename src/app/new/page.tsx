"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ArrowLeft, ChevronDown } from "lucide-react";
import { HeaderActions } from "@/components/ui/HeaderActions";
import { GameIcon } from "@/components/ui/GameIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, toProperCase, liveProperCase, findDuplicateName } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface GameInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  minPlayers: number;
  maxPlayers: number;
  supportsTeams: boolean;
  playersPerTeam?: number;
  teamsWhenPlayerCount?: number;
  playerColumns?: number;
  settings: Array<{
    key: string;
    label: string;
    description?: string;
    type: string;
    defaultValue: unknown;
    options?: Array<{ label: string; value: unknown }>;
    min?: number;
    max?: number;
    minLabel?: string;
    homePosition?: number;
    showWhen?: { setting: string; value: unknown };
  }>;
}

function SettingPicker({
  value,
  onChange,
  min,
  max,
  minLabel,
  homePosition,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  minLabel?: string;
  homePosition?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || homePosition === undefined) return;
    const itemSize = 52; // min-w-[2.75rem] = 44px + gap 1.5 = 6px ≈ 50px, close enough
    const target = (homePosition - min) * itemSize - el.clientWidth / 2 + itemSize / 2;
    el.scrollLeft = Math.max(0, target);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "shrink-0 min-w-[2.75rem] h-9 rounded-full text-xs font-semibold transition-colors px-2",
            n === value
              ? "bg-accent text-white"
              : "bg-surface-elevated border border-slate-600 text-slate-300 hover:border-accent hover:text-white"
          )}
        >
          {n === min && minLabel ? minLabel : n}
        </button>
      ))}
    </div>
  );
}

function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGameId = searchParams.get("game");
  const { data: authSession } = useSession();

  const [games, setGames] = useState<GameInfo[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>(preselectedGameId ?? "");
  const [playerNames, setPlayerNames] = useState<string[]>(["", ""]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // User's first name for Player 1 prefill — fetch if session exists but firstName not yet in token
  const [userFirstName, setUserFirstName] = useState<string>(() => authSession?.user.firstName ?? "");
  useEffect(() => {
    if (authSession?.user.firstName) {
      setUserFirstName(authSession.user.firstName);
    } else if (authSession?.user.id && authSession.user.id !== "local-admin") {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d: { firstName?: string | null }) => {
          if (d.firstName) setUserFirstName(d.firstName);
        });
    }
  }, [authSession]);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then((data: GameInfo[]) => {
      setGames(data);
      const game = data.find((g) => g.id === preselectedGameId) ?? data[0];
      if (game) {
        setSelectedGameId(game.id);
        // Set default settings
        const defaults: Record<string, unknown> = {};
        for (const s of game.settings) {
          // Plain number inputs start blank — default applied at submit time
          if (s.type === "number" && s.min === undefined) continue;
          defaults[s.key] = s.defaultValue;
        }
        setSettings(defaults);
        // Pre-fill player count to min
        setPlayerNames(Array(game.minPlayers).fill(""));
      }
    });
  }, [preselectedGameId]);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  const handleGameChange = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    setSelectedGameId(gameId);
    const defaults: Record<string, unknown> = {};
    for (const s of game.settings) {
      // Plain number inputs start blank — default applied at submit time
      if (s.type === "number" && s.min === undefined) continue;
      defaults[s.key] = s.defaultValue;
    }
    setSettings(defaults);
    setPlayerNames(Array(game.minPlayers).fill(""));
  };

  const addPlayer = () => {
    if (!selectedGame || playerNames.length >= selectedGame.maxPlayers) return;
    setPlayerNames([...playerNames, ""]);
  };

  const removePlayer = (idx: number) => {
    if (!selectedGame || playerNames.length <= selectedGame.minPlayers) return;
    setPlayerNames(playerNames.filter((_, i) => i !== idx));
  };

  const setPlayerName = (idx: number, name: string) => {
    const next = [...playerNames];
    next[idx] = liveProperCase(name);
    setPlayerNames(next);
  };

  const handleStart = async () => {
    setError(null);
    if (!selectedGame) {
      setError("Please select a game.");
      return;
    }

    const filled = playerNames.map((n, i) => toProperCase(n) || (i === 0 && userFirstName ? userFirstName : `Player ${i + 1}`));

    const dup = findDuplicateName(filled);
    if (dup) {
      setError(`Two players can't have the same name ("${dup}"). Please use unique names.`);
      return;
    }

    setLoading(true);
    try {
      // Fill in defaults for any number settings left blank
      const resolvedSettings: Record<string, unknown> = { ...settings };
      for (const s of selectedGame.settings) {
        if (s.type === "number" && resolvedSettings[s.key] === undefined) {
          resolvedSettings[s.key] = s.defaultValue;
        }
      }

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: selectedGame.id,
          playerNames: filled,
          settings: resolvedSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start game");
      }

      const data = await res.json();
      router.push(`/game/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">New Game</h1>
        <HeaderActions />
      </header>

      <main className="flex-1 px-5 pb-10 space-y-6">
        {/* Game picker */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-3">
            Choose Game
          </label>
          <div className="grid grid-cols-4 gap-2">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameChange(game.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 rounded-2xl border transition-all active:scale-[0.97]",
                  selectedGameId === game.id
                    ? "border-accent bg-accent/10"
                    : "border-slate-700/50 bg-surface-card hover:border-slate-600"
                )}
              >
                <span className="text-slate-300"><GameIcon gameId={game.id} size={18} strokeWidth={1.5} fallback={game.emoji} /></span>
                <span className="font-semibold text-xs text-white leading-tight text-center">{game.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Players */}
        {selectedGame && (
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-3">
              Players ({playerNames.length}/{selectedGame.maxPlayers})
            </label>

            {(() => {
              const isTeamMode = selectedGame.playersPerTeam && (
                selectedGame.supportsTeams ||
                (selectedGame.teamsWhenPlayerCount !== undefined && playerNames.length === selectedGame.teamsWhenPlayerCount)
              );
              return isTeamMode ? (
              // Team game: group inputs by team with a clear header per team
              <div className="space-y-3">
                {Array.from(
                  { length: Math.ceil(playerNames.length / selectedGame.playersPerTeam!) },
                  (_, teamIdx) => {
                    const teamNumber = teamIdx + 1;
                    const start = teamIdx * selectedGame.playersPerTeam!;
                    const members = playerNames.slice(start, start + selectedGame.playersPerTeam!);
                    return (
                      <div key={teamIdx} className="rounded-2xl border border-slate-700/50 bg-surface-card overflow-hidden">
                        <div className="px-4 py-2 bg-surface-elevated border-b border-slate-700/50">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Team {teamNumber}
                          </span>
                        </div>
                        <div className="p-3 flex gap-2">
                          {members.map((name, memberIdx) => {
                            const idx = start + memberIdx;
                            return (
                              <Input
                                key={idx}
                                placeholder={idx === 0 && userFirstName ? userFirstName : `Player ${idx + 1}`}
                                value={name}
                                onChange={(e) => setPlayerName(idx, e.target.value)}
                                className="flex-1"
                                autoComplete="off"
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
                {playerNames.length > selectedGame.minPlayers && (
                  <button
                    onClick={() => removePlayer(playerNames.length - 1)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-danger text-slate-500 hover:text-danger transition-colors text-sm"
                  >
                    <Trash2 size={14} />
                    Remove Player
                  </button>
                )}
              </div>
            ) : selectedGame.playerColumns === 2 ? (
              // 2-column grid: when odd player count, buttons go in the empty grid slot
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {playerNames.map((name, idx) => (
                    <Input
                      key={idx}
                      placeholder={idx === 0 && userFirstName ? userFirstName : `Player ${idx + 1}`}
                      value={name}
                      onChange={(e) => setPlayerName(idx, e.target.value)}
                      className="w-full"
                      autoComplete="off"
                    />
                  ))}
                  {/* Odd player count: fill the empty grid slot with action buttons */}
                  {playerNames.length % 2 !== 0 && (
                    <div className="flex gap-2">
                      {playerNames.length > selectedGame.minPlayers && (
                        <button
                          onClick={() => removePlayer(playerNames.length - 1)}
                          className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-700 hover:border-danger text-slate-500 hover:text-danger transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      {playerNames.length < selectedGame.maxPlayers && (
                        <button
                          onClick={addPlayer}
                          className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-600 hover:border-accent text-slate-500 hover:text-accent transition-colors"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Even player count: buttons go full width below */}
                {playerNames.length % 2 === 0 && (
                  playerNames.length > selectedGame.minPlayers || playerNames.length < selectedGame.maxPlayers
                ) && (
                  <div className="flex gap-2">
                    {playerNames.length > selectedGame.minPlayers && (
                      <button
                        onClick={() => removePlayer(playerNames.length - 1)}
                        className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-slate-700 hover:border-danger text-slate-500 hover:text-danger transition-colors py-3"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    {playerNames.length < selectedGame.maxPlayers && (
                      <button
                        onClick={addPlayer}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 hover:border-accent text-slate-500 hover:text-accent transition-colors text-sm"
                      >
                        <Plus size={16} />
                        Add Player
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Single-column list with inline trash per row
              <div className="space-y-2">
                {playerNames.map((name, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder={idx === 0 && userFirstName ? userFirstName : `Player ${idx + 1}`}
                      value={name}
                      onChange={(e) => setPlayerName(idx, e.target.value)}
                      className="flex-1"
                      autoComplete="off"
                    />
                    {playerNames.length > selectedGame.minPlayers && (
                      <button
                        onClick={() => removePlayer(idx)}
                        className="p-3 rounded-xl bg-surface-card hover:bg-danger/10 text-slate-500 hover:text-danger transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                {playerNames.length < selectedGame.maxPlayers && (
                  <button
                    onClick={addPlayer}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 hover:border-accent text-slate-500 hover:text-accent transition-colors text-sm"
                  >
                    <Plus size={16} />
                    Add Player
                  </button>
                )}
              </div>
            );
            })()}
          </div>
        )}

        {/* Game settings */}
        {selectedGame && selectedGame.settings.length > 0 && (
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-3">
              Settings
            </label>
            <div className="space-y-3">
              {selectedGame.settings.filter((s) =>
                !s.showWhen || settings[s.showWhen.setting] === s.showWhen.value
              ).map((s) => {
                const isPicker = s.type === "number" && s.min !== undefined && s.max !== undefined;
                return (
                  <div key={s.key} className="bg-surface-card rounded-xl px-4 py-3">
                    <div className={cn("flex gap-4", isPicker ? "flex-col" : "items-center justify-between")}>
                      <div>
                        <div className="font-medium text-slate-200 text-sm">{s.label}</div>
                        {s.description && (
                          <div className="text-xs text-slate-500">{s.description}</div>
                        )}
                      </div>
                      {isPicker && (
                        <SettingPicker
                          value={(settings[s.key] as number) ?? (s.defaultValue as number)}
                          onChange={(v) => setSettings((prev) => ({ ...prev, [s.key]: v }))}
                          min={s.min!}
                          max={s.max!}
                          minLabel={s.minLabel}
                          homePosition={s.homePosition}
                        />
                      )}
                      {s.type === "number" && !isPicker && (
                        <input
                          type="number"
                          inputMode="numeric"
                          className="w-24 text-center rounded-lg bg-surface-elevated border border-slate-600 px-2 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          placeholder={String(s.defaultValue)}
                          value={settings[s.key] !== undefined ? String(settings[s.key]) : ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setSettings((prev) => ({
                              ...prev,
                              [s.key]: isNaN(val) ? undefined : val,
                            }));
                          }}
                        />
                      )}
                      {s.type === "boolean" && (() => {
                        const isEnabled = Boolean(settings[s.key]);
                        return (
                          <button
                            onClick={() =>
                              setSettings((prev) => ({ ...prev, [s.key]: !isEnabled }))
                            }
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors shrink-0",
                              isEnabled
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                              isEnabled ? "border-accent bg-accent" : "border-slate-500"
                            )}>
                              {isEnabled && (
                                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                  <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            {isEnabled ? "On" : "Off"}
                          </button>
                        );
                      })()}
                      {s.type === "select" && (
                        <select
                          className="rounded-lg bg-surface-elevated border border-slate-600 px-2 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                          value={String(settings[s.key] ?? s.defaultValue)}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, [s.key]: e.target.value }))
                          }
                        >
                          {s.options?.map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
            {error}
          </div>
        )}
      </main>

      <footer className="px-5 pb-8 safe-bottom">
        <Button
          size="lg"
          onClick={handleStart}
          loading={loading}
          disabled={!selectedGame}
        >
          Start Game
        </Button>
      </footer>
    </div>
  );
}

export default function NewGamePage() {
  return (
    <Suspense>
      <NewGameForm />
    </Suspense>
  );
}

