"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, Car } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GameIcon, gameIconStyle } from "@/components/ui/GameIcon";
import { cn, formatDateTime } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────

const CARS = ["black", "blue", "green", "orange", "red", "yellow"] as const;
type Car = (typeof CARS)[number];

const CAR_STYLE: Record<Car, { icon: string; ring: string; bg: string }> = {
  black:  { icon: "#94a3b8", ring: "#94a3b8", bg: "rgba(71,85,105,0.25)"  },
  blue:   { icon: "#60a5fa", ring: "#60a5fa", bg: "rgba(37,99,235,0.25)"  },
  green:  { icon: "#4ade80", ring: "#4ade80", bg: "rgba(22,163,74,0.25)"  },
  orange: { icon: "#fb923c", ring: "#fb923c", bg: "rgba(234,88,12,0.25)"  },
  red:    { icon: "#f87171", ring: "#f87171", bg: "rgba(220,38,38,0.25)"  },
  yellow: { icon: "#fbbf24", ring: "#fbbf24", bg: "rgba(202,138,4,0.25)"  },
};

const CAR_NAME: Record<Car, string> = {
  black: "Black", blue: "Blue", green: "Green",
  orange: "Orange", red: "Red", yellow: "Yellow",
};

const RACING_PAYOUTS = [12, 9, 6, 4, 2, 0];
const BETTING_PAYOUTS = [
  [9, 6, 3, 0, 0, 0],
  [6, 4, 2, 0, 0, 0],
  [3, 2, 1, 0, 0, 0],
];
const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

// ── Sub-components ─────────────────────────────────────────────────────────

// Selectable car button — big icon, no text
function CarButton({ car, selected, disabled, onToggle }: {
  car: Car; selected: boolean; disabled?: boolean; onToggle: () => void;
}) {
  const s = CAR_STYLE[car];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn("flex items-center justify-center py-3 rounded-xl transition-all", disabled && "opacity-25 cursor-not-allowed")}
      style={{
        background: selected ? s.bg : "rgba(30,30,48,0.6)",
        boxShadow: selected ? `0 0 0 2px ${s.ring}` : undefined,
      }}
    >
      <Car size={28} strokeWidth={1.75} style={{ color: s.icon }} />
    </button>
  );
}

// Small compact chip for confirmed state
function CarChip({ car, size = "md" }: { car: Car; size?: "sm" | "md" }) {
  const s = CAR_STYLE[car];
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconSize = size === "sm" ? 14 : 18;
  return (
    <div
      className={cn("flex items-center justify-center rounded-xl shrink-0", dim)}
      style={{ background: s.bg, boxShadow: `0 0 0 1.5px ${s.ring}` }}
      title={CAR_NAME[car]}
    >
      <Car size={iconSize} strokeWidth={1.75} style={{ color: s.icon }} />
    </div>
  );
}

// Place result box — car icon centered, place label below
function PlaceBox({ pos, car, onClick }: { pos: number; car: Car; onClick?: () => void }) {
  const s = CAR_STYLE[car];
  const el = (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl"
      style={{ background: s.bg, boxShadow: `0 0 0 1.5px ${s.ring}` }}
    >
      <Car size={20} strokeWidth={1.75} style={{ color: s.icon }} />
      <span className="text-[10px] font-bold text-slate-400">{PLACE_LABELS[pos - 1]}</span>
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="flex-1">{el}</button>;
  return el;
}

function PhaseHeader({ number, title, done, onEdit }: {
  number: number; title: string; done: boolean; onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 h-9 bg-surface-elevated border-b border-slate-700/40">
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
        done ? "bg-success text-white" : "bg-accent/20 text-accent"
      )}>
        {done ? <Check size={11} /> : number}
      </div>
      <span className="font-bold text-slate-300 text-xs flex-1 uppercase tracking-wide">{title}</span>
      {done && onEdit && (
        <button onClick={onEdit} className="w-5 h-5 flex items-center justify-center rounded text-slate-500 shrink-0"><Pencil size={13} /></button>
      )}
    </div>
  );
}

function CarGrid({ selected, onToggle, disabledCars = [] }: {
  selected: Car[]; onToggle: (car: Car) => void; disabledCars?: Car[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CARS.map((car) => (
        <CarButton
          key={car} car={car}
          selected={selected.includes(car)}
          disabled={disabledCars.includes(car)}
          onToggle={() => onToggle(car)}
        />
      ))}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionData { id: string; status: string; createdAt: number; settings: string; }
interface Props { sessionId: string; session: SessionData; onRefresh: () => Promise<void>; }

// ── Main component ─────────────────────────────────────────────────────────

export function DownforceScorecard({ sessionId, session, onRefresh }: Props) {
  const router = useRouter();

  const parseSettings = (raw: string) => {
    const s = JSON.parse(raw ?? "{}");
    return {
      ownedCars: JSON.parse(s.df_ownedCars ?? "[]") as Car[],
      costs: JSON.parse(s.df_costs ?? "{}") as Record<string, number>,
      bet1: (s.df_bet1 ?? null) as Car | null,
      bet2: (s.df_bet2 ?? null) as Car | null,
      bet3: (s.df_bet3 ?? null) as Car | null,
      places: JSON.parse(s.df_places ?? "{}") as Record<string, number>,
    };
  };

  const stored = parseSettings(session.settings);
  const auctionDone = stored.ownedCars.length > 0 && stored.ownedCars.every((c) => (stored.costs[c] ?? 0) >= 1);
  const bet1Done = !!stored.bet1;
  const bet2Done = !!stored.bet2;
  const bet3Done = !!stored.bet3;
  const placesDone = CARS.every((c) => stored.places[c] >= 1 && stored.places[c] <= 6);
  const allDone = auctionDone && bet1Done && bet2Done && bet3Done && placesDone;
  const activePhase = !auctionDone ? 0 : !bet1Done ? 1 : !bet2Done ? 2 : !bet3Done ? 3 : !placesDone ? 4 : -1;

  const [editingPhase, setEditingPhase] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [wonGame, setWonGame] = useState<boolean | null>(null);

  const [localOwnedCars, setLocalOwnedCars] = useState<Car[]>(stored.ownedCars);
  const [localCosts, setLocalCosts] = useState<Record<string, number>>({ ...stored.costs });
  const [localBet1, setLocalBet1] = useState<Car | null>(stored.bet1);
  const [localBet2, setLocalBet2] = useState<Car | null>(stored.bet2);
  const [localBet3, setLocalBet3] = useState<Car | null>(stored.bet3);
  const [localPlaces, setLocalPlaces] = useState<Record<string, number>>({ ...stored.places });

  useEffect(() => {
    const s = parseSettings(session.settings);
    setLocalOwnedCars(s.ownedCars);
    setLocalCosts({ ...s.costs });
    setLocalBet1(s.bet1);
    setLocalBet2(s.bet2);
    setLocalBet3(s.bet3);
    setLocalPlaces({ ...s.places });
  }, [session.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFormMode = (phase: number) =>
    editingPhase === phase || (editingPhase === null && activePhase === phase);

  const patchSettings = async (patch: Record<string, string>) => {
    setSaving(true);
    try {
      const raw = JSON.parse(session.settings ?? "{}");
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: JSON.stringify({ ...raw, ...patch }) }),
      });
      await onRefresh();
      setEditingPhase(null);
    } finally {
      setSaving(false);
    }
  };

  const saveAuction = () => {
    const costs: Record<string, number> = {};
    for (const car of localOwnedCars) costs[car] = localCosts[car] ?? 1;
    return patchSettings({ df_ownedCars: JSON.stringify(localOwnedCars), df_costs: JSON.stringify(costs) });
  };

  const saveBet = (n: 1 | 2 | 3, car: Car | null) => {
    if (!car) return;
    return patchSettings({ [`df_bet${n}`]: car });
  };

  const savePlaces = () => {
    if (!CARS.every((c) => localPlaces[c])) return;
    return patchSettings({ df_places: JSON.stringify(localPlaces) });
  };

  const handleSaveGame = async () => {
    setSaving(true);
    try {
      const raw = JSON.parse(session.settings ?? "{}");
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          completedAt: Date.now(),
          settings: JSON.stringify({ ...raw, wonGame: wonGame ?? false }),
        }),
      });
      router.push(`/history/${sessionId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    router.push("/");
  };

  const carAtPlace = (pos: number): Car | null => CARS.find((c) => localPlaces[c] === pos) ?? null;

  const toggleCarPlace = (car: Car, pos: number) => {
    setLocalPlaces((prev) => {
      const next = { ...prev };
      for (const c of CARS) { if (c !== car && next[c] === pos) delete next[c]; }
      if (next[car] === pos) delete next[car];
      else next[car] = pos;
      return next;
    });
  };

  // Score from confirmed data
  const racingTotal = stored.ownedCars.reduce((sum, car) => {
    const p = stored.places[car];
    return sum + (p >= 1 && p <= 6 ? RACING_PAYOUTS[p - 1] : 0);
  }, 0);
  const betPayouts = ([stored.bet1, stored.bet2, stored.bet3] as (Car | null)[]).map((bet, i) => {
    if (!bet) return 0;
    const p = stored.places[bet];
    return p >= 1 && p <= 6 ? BETTING_PAYOUTS[i][p - 1] : 0;
  });
  const bettingTotal = betPayouts.reduce((s, p) => s + p, 0);
  const auctionTotal = Object.values(stored.costs).reduce((s, c) => s + c, 0);
  const netWinnings = racingTotal + bettingTotal - auctionTotal;

  // ── Bet phase ─────────────────────────────────────────────────────────────

  const renderBetPhase = (betNum: 1 | 2 | 3) => {
    const done = betNum === 1 ? bet1Done : betNum === 2 ? bet2Done : bet3Done;
    const localBet = betNum === 1 ? localBet1 : betNum === 2 ? localBet2 : localBet3;
    const setLocalBet = betNum === 1 ? setLocalBet1 : betNum === 2 ? setLocalBet2 : setLocalBet3;
    const prevDone = betNum === 1 ? auctionDone : betNum === 2 ? bet1Done : bet2Done;
    const locked = !prevDone;

    return (
      <div key={betNum} className={cn("rounded-2xl bg-surface-card overflow-hidden", locked && "opacity-40")}>
        <PhaseHeader number={betNum + 1} title={`Bet ${betNum}`} done={done} onEdit={done && !locked ? () => setEditingPhase(betNum) : undefined} />
        {isFormMode(betNum) && !locked && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">Which car do you think will win the race?</p>
            <CarGrid
              selected={localBet ? [localBet] : []}
              onToggle={(car) => setLocalBet(localBet === car ? null : car)}
            />
            <div className="flex gap-2">
              {editingPhase === betNum && (
                <Button variant="secondary" onClick={() => setEditingPhase(null)} className="flex-1">Cancel</Button>
              )}
              <Button onClick={() => saveBet(betNum, localBet)} loading={saving} disabled={!localBet} className="flex-1">
                <Check size={16} /> Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen">

      <header className="px-4 pt-8 pb-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/")} className="p-2 rounded-xl text-slate-400">
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={gameIconStyle("downforce")}>
            <GameIcon gameId="downforce" size={16} strokeWidth={1.5} fallback="🏎️" />
          </div>
          <h1 className="text-xl font-black text-white flex-1">Downforce</h1>
          <p className="text-xs text-slate-500">{formatDateTime(session.createdAt)}</p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 pb-32">

        {/* Phase 1: Auction */}
        <div className="rounded-2xl bg-surface-card overflow-hidden">
          <PhaseHeader number={1} title="Auction" done={auctionDone} onEdit={auctionDone ? () => setEditingPhase(0) : undefined} />
          {isFormMode(0) ? (
            <div className="p-4 space-y-4">
              <p className="text-xs text-slate-500">Select the car(s) you won at auction (up to 5), then enter your bid for each.</p>
              <CarGrid
                selected={localOwnedCars}
                onToggle={(car) =>
                  setLocalOwnedCars((prev) =>
                    prev.includes(car) ? prev.filter((c) => c !== car) : prev.length < 5 ? [...prev, car] : prev
                  )
                }
              />
              {localOwnedCars.length > 0 && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-slate-500">Bid amount ($M):</p>
                  {localOwnedCars.map((car) => (
                    <div key={car} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: CAR_STYLE[car].bg, boxShadow: `0 0 0 1.5px ${CAR_STYLE[car].ring}` }}>
                        <Car size={18} strokeWidth={1.75} style={{ color: CAR_STYLE[car].icon }} />
                      </div>
                      <div className="flex gap-1.5 flex-1">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <button key={n} type="button"
                            onClick={() => setLocalCosts((prev) => ({ ...prev, [car]: n }))}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-sm font-mono font-bold transition-all",
                              localCosts[car] === n ? "bg-accent text-white" : "bg-surface-elevated border border-slate-600 text-slate-400"
                            )}
                          >{n}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {editingPhase === 0 && (
                  <Button variant="secondary" onClick={() => setEditingPhase(null)} className="flex-1">Cancel</Button>
                )}
                <Button onClick={saveAuction} loading={saving}
                  disabled={localOwnedCars.length === 0 || localOwnedCars.some((c) => !localCosts[c])}
                  className="flex-1">
                  <Check size={16} /> Confirm Auction
                </Button>
              </div>
            </div>
          ) : auctionDone ? (
            <div className="px-4 py-3 flex items-center gap-2">
              {stored.ownedCars.map((car) => (
                <div key={car} className="flex flex-col items-center justify-center gap-1 py-2 px-2.5 rounded-xl shrink-0"
                  style={{ background: CAR_STYLE[car].bg, boxShadow: `0 0 0 1.5px ${CAR_STYLE[car].ring}` }}>
                  <Car size={22} strokeWidth={1.75} style={{ color: CAR_STYLE[car].icon }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: CAR_STYLE[car].icon }}>${stored.costs[car]}M</span>
                </div>
              ))}
              <span className="ml-auto text-xs text-slate-500 font-mono shrink-0">Total: ${auctionTotal}M</span>
            </div>
          ) : null}
        </div>

        {/* Bets — compact when all three done */}
        {bet1Done && bet2Done && bet3Done && editingPhase === null ? (
          <div className="rounded-2xl bg-surface-card overflow-hidden">
            <PhaseHeader number={2} title="Bets" done onEdit={() => setEditingPhase(1)} />
            <div className="px-4 py-3 flex items-center justify-center gap-6">
              {([1, 2, 3] as const).map((betNum, i) => {
                const storedBet = betNum === 1 ? stored.bet1 : betNum === 2 ? stored.bet2 : stored.bet3;
                return (
                  <div key={betNum} className="flex items-center gap-2">
                    {i > 0 && <div className="w-px h-8 bg-slate-700/60" />}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Bet {betNum}</span>
                      {storedBet && <CarChip car={storedBet} size="sm" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {renderBetPhase(1)}
            {renderBetPhase(2)}
            {renderBetPhase(3)}
          </>
        )}

        {/* Phase 5: Race Results */}
        {(() => {
          const locked = !bet3Done;
          return (
            <div className={cn("rounded-2xl bg-surface-card overflow-hidden", locked && "opacity-40")}>
              <PhaseHeader number={5} title="Race Results" done={placesDone}
                onEdit={placesDone && !locked ? () => setEditingPhase(4) : undefined} />

              {/* Confirmed: single row of 6 */}
              {placesDone && !isFormMode(4) ? (
                <div className="px-3 py-3 flex gap-1.5">
                  {PLACE_LABELS.map((_, idx) => {
                    const pos = idx + 1;
                    const car = CARS.find((c) => stored.places[c] === pos);
                    if (!car) return <div key={pos} className="flex-1" />;
                    return <PlaceBox key={pos} pos={pos} car={car} />;
                  })}
                </div>
              ) : isFormMode(4) && !locked ? (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-slate-500 px-1">Tap a car to assign it. Tap a filled slot to clear it.</p>

                  {/* Filled positions row — tap to clear */}
                  {(() => {
                    const anyFilled = PLACE_LABELS.some((_, i) => carAtPlace(i + 1) !== null);
                    if (!anyFilled) return null;
                    return (
                      <div className="flex gap-1.5 mb-1">
                        {PLACE_LABELS.map((_, idx) => {
                          const pos = idx + 1;
                          const car = carAtPlace(pos);
                          if (!car) {
                            // Empty slot placeholder
                            return (
                              <div key={pos} className="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-surface border border-slate-700/40">
                                <div className="w-4 h-4" />
                                <span className="text-[10px] text-slate-700">{PLACE_LABELS[idx]}</span>
                              </div>
                            );
                          }
                          return <PlaceBox key={pos} pos={pos} car={car} onClick={() => toggleCarPlace(car, pos)} />;
                        })}
                      </div>
                    );
                  })()}

                  {/* Each unfilled position in its own box */}
                  {PLACE_LABELS.map((label, idx) => {
                    const pos = idx + 1;
                    if (carAtPlace(pos) !== null) return null;
                    return (
                      <div key={pos} className="rounded-xl bg-surface-elevated overflow-hidden">
                        <div className="px-3 py-1.5 border-b border-slate-700/40">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                        </div>
                        <div className="p-2 grid grid-cols-3 gap-1.5">
                          {CARS.map((car) => {
                            const isElsewhere = localPlaces[car] !== undefined && localPlaces[car] !== pos;
                            return (
                              <CarButton key={car} car={car} selected={false} disabled={isElsewhere}
                                onToggle={() => toggleCarPlace(car, pos)} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-2 pt-1">
                    {editingPhase === 4 && (
                      <Button variant="secondary" onClick={() => setEditingPhase(null)} className="flex-1">Cancel</Button>
                    )}
                    <Button onClick={savePlaces} loading={saving} disabled={!CARS.every((c) => localPlaces[c])} className="flex-1">
                      <Check size={16} /> Confirm Results
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* Score breakdown */}
        {allDone && (
          <div className="rounded-2xl bg-surface-card overflow-hidden">
            <div className="flex items-center gap-2.5 px-3 h-9 bg-surface-elevated border-b border-slate-700/40">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-success text-white shrink-0">
                <Check size={11} />
              </div>
              <span className="font-bold text-slate-300 text-xs flex-1 uppercase tracking-wide">Score</span>
            </div>
            <div className="p-3 space-y-3">
              {/* 3-column breakdown */}
              <div className="grid grid-cols-3 divide-x divide-slate-700/40">
                {/* Auction Spend */}
                <div className="pr-3 space-y-1.5">
                  <div className="text-center mb-1">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Auction</div>
                    <div className="font-mono font-bold text-danger text-base">−${auctionTotal}M</div>
                  </div>
                  {stored.ownedCars.map((car) => (
                    <div key={car} className="flex items-center justify-between">
                      <Car size={12} strokeWidth={1.75} style={{ color: CAR_STYLE[car].icon }} />
                      <span className="text-xs font-mono text-slate-500">${stored.costs[car]}M</span>
                    </div>
                  ))}
                </div>
                {/* Betting Total */}
                <div className="px-3 space-y-1.5">
                  <div className="text-center mb-1">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Betting</div>
                    <div className="font-mono font-bold text-success text-base">+${bettingTotal}M</div>
                  </div>
                  {([stored.bet1, stored.bet2, stored.bet3] as (Car | null)[]).map((bet, i) => {
                    if (!bet) return null;
                    const p = stored.places[bet];
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">B{i + 1}</span>
                          <Car size={12} strokeWidth={1.75} style={{ color: CAR_STYLE[bet].icon }} />
                        </div>
                        <span className="text-xs font-mono text-slate-500">${betPayouts[i]}M</span>
                      </div>
                    );
                  })}
                </div>
                {/* Racing Total */}
                <div className="pl-3 space-y-1.5">
                  <div className="text-center mb-1">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Racing</div>
                    <div className="font-mono font-bold text-success text-base">+${racingTotal}M</div>
                  </div>
                  {stored.ownedCars.map((car) => {
                    const p = stored.places[car];
                    const payout = p >= 1 && p <= 6 ? RACING_PAYOUTS[p - 1] : 0;
                    return (
                      <div key={car} className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Car size={12} strokeWidth={1.75} style={{ color: CAR_STYLE[car].icon }} />
                          <span className="text-xs text-slate-500">{PLACE_LABELS[p - 1]}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">${payout}M</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Total Winnings */}
              <div className="border-t border-slate-700/50 pt-3 flex justify-between items-center">
                <span className="font-bold text-white">Total Winnings</span>
                <span className={cn("text-2xl font-mono font-black", netWinnings >= 0 ? "text-success" : "text-danger")}>
                  {netWinnings >= 0 ? "+" : ""}{netWinnings}M
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="fixed bottom-0 inset-x-0 px-4 pt-3 border-t border-slate-700/50 bg-[#0a0a1a]/95 backdrop-blur-sm space-y-2"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
      >
        {allDone && (
          <Button onClick={() => setSaveOpen(true)} className="w-full">Save Game</Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(true)} className="w-full text-slate-500 text-xs">
          Delete Game
        </Button>
      </footer>

      {/* Save game — did you win? */}
      {saveOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setSaveOpen(false)}>
          <div className="bg-surface w-full rounded-t-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-white font-bold text-center text-lg">Did you win?</p>
            <div className="flex gap-3">
              {([true, false] as const).map((won) => (
                <button
                  key={String(won)}
                  type="button"
                  onClick={() => setWonGame(wonGame === won ? null : won)}
                  className={cn(
                    "flex-1 py-3 rounded-2xl border text-sm font-bold transition-all",
                    wonGame === won
                      ? won ? "border-success bg-success/15 text-success" : "border-danger bg-danger/15 text-danger"
                      : "border-slate-700 bg-surface-elevated text-slate-400"
                  )}
                >
                  {won ? "🏆 Yes" : "Not this time"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSaveOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveGame} loading={saving} disabled={wonGame === null} className="flex-1">Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-surface w-full rounded-t-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-white font-bold text-center">Delete this game?</p>
            <p className="text-slate-400 text-sm text-center">This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(false)} className="flex-1">Cancel</Button>
              <Button variant="danger" onClick={handleDelete} className="flex-1">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
