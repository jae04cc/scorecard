"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { GameDefinition } from "@/lib/games/types";

interface Player {
  id: string;
  name: string;
  team?: string | null;
  active: boolean;
}

interface RoundEntryModalProps {
  open: boolean;
  onClose: () => void;
  game: GameDefinition;
  players: Player[];
  settings?: Record<string, unknown>;
  onSubmit: (
    entries: Array<{ playerId: string; score: number; metadata: Record<string, number> }>
  ) => Promise<void>;
  initialValues?: Record<string, Record<string, number>>;
  roundNumber?: number;
}

// Horizontally scrollable bubble picker; home position defaults to 5
function NumberPicker({
  value,
  onChange,
  min = 0,
  max = 13,
  homePosition = 5,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  homePosition?: number;
  disabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  const itemSize = 56; // 48px bubble + 8px gap

  // On mount, scroll so homePosition is centered
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = (homePosition - min) * itemSize - el.clientWidth / 2 + itemSize / 2;
    el.scrollLeft = Math.max(0, target);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * itemSize * 3, behavior: "smooth" });
  };

  const arrowClass = "shrink-0 w-7 h-12 flex items-center justify-center text-xl text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-surface select-none";

  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => scrollBy(-1)} tabIndex={-1} className={arrowClass}>
        ‹
      </button>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto py-1 flex-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(n)}
            className={cn(
              "shrink-0 w-12 h-12 rounded-full text-lg font-mono font-bold transition-colors",
              n === value
                ? "bg-accent text-white"
                : "bg-surface border border-slate-600 text-slate-300 hover:border-accent hover:text-white",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => scrollBy(1)} tabIndex={-1} className={arrowClass}>
        ›
      </button>
    </div>
  );
}

export function RoundEntryModal({
  open,
  onClose,
  game,
  players,
  settings = {},
  onSubmit,
  initialValues,
  roundNumber,
}: RoundEntryModalProps) {
  const activePlayers = players.filter((p) => p.active);
  const entry = game.scoreEntry;
  const isTeamFields = entry.type === "team-fields";
  const isTextInput = entry.type === "simple" && !!(entry as { textInput?: boolean }).textInput;
  const hasTriggerPlayer = isTextInput && !!(entry as { triggerPlayer?: boolean }).triggerPlayer;

  // One entry target per team (team-fields) or per player (others)
  const entryTargets = isTeamFields
    ? Array.from(new Map(activePlayers.map((p) => [p.team ?? p.id, p])).values())
    : activePlayers;

  // Build a human-readable label from player names (no "Team 1" / "Team 2")
  const getTargetLabel = useCallback(
    (target: Player): string => {
      if (!isTeamFields || !target.team) return target.name;
      return activePlayers
        .filter((p) => p.team === target.team)
        .map((p) => p.name)
        .join(" & ");
    },
    [isTeamFields, activePlayers]
  );

  // Determine if entry has phased fields (e.g. Spades: phase 1 = bids, phase 2 = tricks)
  const allFields = (
    entry.type === "fields" || entry.type === "team-fields" ? entry.fields : []
  ).filter((f) => !f.showWhenSetting || settings[f.showWhenSetting.setting] === f.showWhenSetting.value);
  const phases = allFields.some((f) => f.phase !== undefined)
    ? [...new Set(allFields.map((f) => f.phase ?? 1))].sort((a, b) => a - b)
    : null; // null = no phases, show everything at once

  // For team-fields games with an exclusive checkbox that has a linked picker (showWhen):
  // e.g. Catch Five "Won Bid" → render as global team selector with the linked bid picker below it
  // (bigCasino in Casino is exclusive too but has no linked picker, so it stays in-box)
  const globalExclusiveField = (isTeamFields && phases === null)
    ? allFields.find(
        (f) =>
          f.exclusive &&
          f.fieldType === "checkbox" &&
          allFields.some((pf) => pf.fieldType !== "checkbox" && pf.showWhen?.field === f.key)
      ) ?? null
    : null;

  // Optional label appended to the modal title (e.g. Casino "Points Scored")
  const roundEntryLabel = game.getRoundEntryLabel?.(settings) ?? null;

  const [currentPhase, setCurrentPhase] = useState(phases?.[0] ?? 1);

  const getDefaultFields = (): Record<string, number> => {
    if (entry.type === "simple") return { score: 0 };
    const defaults: Record<string, number> = {};
    for (const f of allFields) defaults[f.key] = f.defaultValue ?? 0;
    return defaults;
  };

  const buildInitValues = () => {
    const init: Record<string, Record<string, number>> = {};
    for (const target of entryTargets) {
      const key = isTeamFields ? (target.team ?? target.id) : target.id;
      init[key] = initialValues?.[key] ?? getDefaultFields();
    }
    return init;
  };

  const [values, setValues] = useState<Record<string, Record<string, number>>>(buildInitValues);
  // For textInput mode: track raw text string per target (sign is embedded in the string)
  const [textInputRaw, setTextInputRaw] = useState<Record<string, string>>({});
  // For trigger-player mechanic: which player triggered the end of round
  const [triggerPlayerId, setTriggerPlayerId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state every time the modal opens so previous round values don't persist
  useEffect(() => {
    if (!open) return;
    const initValues = buildInitValues();
    setValues(initValues);
    setCurrentPhase(phases?.[0] ?? 1);
    // For textInput mode, pre-populate raw strings from initial scores (supports editing existing rounds)
    if (isTextInput) {
      const rawInit: Record<string, string> = {};
      for (const target of entryTargets) {
        const key = isTeamFields ? (target.team ?? target.id) : target.id;
        const score = initValues[key]?.["score"] ?? 0;
        rawInit[key] = score === 0 ? "" : String(score);
      }
      setTextInputRaw(rawInit);
    } else {
      setTextInputRaw({});
    }
    setTriggerPlayerId(null);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFieldValue = (targetKey: string, field: string, v: number, exclusive = false) => {
    setValues((prev) => {
      const next = { ...prev };
      if (exclusive && v === 1) {
        // Clear this field for all other targets
        for (const key of Object.keys(next)) {
          if (key !== targetKey) next[key] = { ...next[key], [field]: 0 };
        }
      }
      next[targetKey] = { ...next[targetKey], [field]: v };
      return next;
    });
    setError(null);
  };

  const computeScore = (fields: Record<string, number>): number => {
    if (entry.type === "simple") return fields["score"] ?? 0;
    if (entry.type === "fields" || entry.type === "team-fields") {
      if (entry.calculateWithSettings) return entry.calculateWithSettings(fields, settings);
      return entry.calculate(fields);
    }
    return 0;
  };

  const isLastPhase = !phases || currentPhase === phases[phases.length - 1];

  const handleNext = () => {
    if (!phases) return;
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };

  const handleBack = () => {
    if (!phases) return;
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  const handleSubmit = async () => {
    setError(null);

    // Apply tie-resolution / normalization if the entry config provides it
    const normalizedValues = entry.type !== "simple" && entry.normalizeFields
      ? entry.normalizeFields(values)
      : values;

    let entries = activePlayers.map((player) => {
      const targetKey = isTeamFields ? (player.team ?? player.id) : player.id;
      const rawFields = values[targetKey] ?? getDefaultFields();
      const normFields = normalizedValues[targetKey] ?? rawFields;
      return { playerId: player.id, score: computeScore(normFields), metadata: rawFields };
    });

    // Trigger-player penalty: if selected player doesn't have the lowest score, multiply their score
    if (hasTriggerPlayer && triggerPlayerId) {
      const scores = entries.map((e) => e.score);
      const minScore = Math.min(...scores);
      const triggerEntry = entries.find((e) => e.playerId === triggerPlayerId);
      if (triggerEntry && triggerEntry.score > minScore) {
        const rawMultiplier = settings["triggerPenalty"];
        const multiplier = typeof rawMultiplier === "number" ? rawMultiplier
          : typeof rawMultiplier === "string" ? (parseFloat(rawMultiplier) || 2)
          : 2;
        entries = entries.map((e) =>
          e.playerId === triggerPlayerId
            ? { ...e, score: Math.round(e.score * multiplier) }
            : e
        );
      }
    }

    // Pass deduplicated (per-team) entries to validation so counts aren't doubled
    if (game.validateRound) {
      const deduped = entryTargets.map((target) => {
        const key = isTeamFields ? (target.team ?? target.id) : target.id;
        return { playerId: target.id, fields: values[key] ?? getDefaultFields() };
      });
      const err = game.validateRound(deduped, settings);
      if (err) { setError(err); return; }
    }

    setLoading(true);
    try {
      await onSubmit(entries);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save round");
    } finally {
      setLoading(false);
    }
  };

  // Fields visible in the current phase
  const visibleFields = phases
    ? allFields.filter((f) => (f.phase ?? 1) === currentPhase)
    : allFields;

  // Phase label derived from the fields in this phase
  const phaseLabel = phases
    ? visibleFields.filter((f) => !f.fieldType).map((f) => f.label).join(" / ")
    : null;

  const renderTarget = (target: Player) => {
    const targetKey = isTeamFields ? (target.team ?? target.id) : target.id;
    const currentValues = values[targetKey] ?? getDefaultFields();
    const label = getTargetLabel(target);
    // Use normalized values for preview so ties (e.g. mostCards) show 0 pts correctly
    const previewFields = entry.type !== "simple" && entry.normalizeFields
      ? (entry.normalizeFields(values)[targetKey] ?? currentValues)
      : currentValues;
    const previewScore = computeScore(previewFields);
    const showPreview = isLastPhase && allFields.length > 0;

    // When a global exclusive selector is shown, append the remaining picker labels to the box header
    // e.g. "Jake & John — Points Taken"
    const headerLabel = globalExclusiveField
      ? (() => {
          const suffix = allFields
            .filter(
              (f) =>
                f.key !== globalExclusiveField.key &&
                f.showWhen?.field !== globalExclusiveField.key &&
                f.fieldType !== "checkbox"
            )
            .map((f) => f.label)
            .join(" / ");
          return suffix ? `${label} — ${suffix}` : label;
        })()
      : label;

    return (
      <div key={targetKey} className="rounded-2xl bg-surface-elevated overflow-hidden">
        {/* Team / player header */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">{headerLabel}</div>
          </div>
          {showPreview && (
            <span className={`text-sm font-mono font-bold ${previewScore >= 0 ? "text-success" : "text-danger"}`}>
              {previewScore >= 0 ? `+${previewScore}` : previewScore} pts
            </span>
          )}
        </div>

        {/* Input fields for this phase */}
        <div className="p-4">
          {entry.type === "simple" ? (
            <NumberPicker
              value={currentValues["score"] ?? 0}
              onChange={(v) => setFieldValue(targetKey, "score", v)}
              min={(entry as { min?: number }).min ?? 0}
              max={(entry as { max?: number }).max ?? 13}
            />
          ) : (
            <div className="space-y-4">
              {(() => {
                const filtered = visibleFields.filter(
                  (f) =>
                    (!f.showWhen || currentValues[f.showWhen.field] === f.showWhen.value) &&
                    !(globalExclusiveField && f.key === globalExclusiveField.key) &&
                    // Also hide pickers linked to the global exclusive field (moved to global box)
                    !(globalExclusiveField && f.showWhen?.field === globalExclusiveField.key)
                );
                const checkboxFields = filtered.filter((f) => f.fieldType === "checkbox");
                const pickerFields = filtered.filter((f) => f.fieldType !== "checkbox");

                const makeCheckboxButton = (cbField: typeof checkboxFields[0], isChecked: boolean, isExclusive: boolean) => (
                  <button
                    type="button"
                    onClick={() => setFieldValue(targetKey, cbField.key, isChecked ? 0 : 1, isExclusive)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-colors shrink-0",
                      isChecked
                        ? "border-accent bg-accent/10 text-white"
                        : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      isChecked ? "border-accent bg-accent" : "border-slate-500"
                    )}>
                      {isChecked && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-medium text-center leading-tight">{cbField.label}</span>
                  </button>
                );

                // Inline layout for phased entries with exactly 1 checkbox + 1 picker (Spades)
                if (phases !== null && checkboxFields.length === 1 && pickerFields.length === 1) {
                  const cbField = checkboxFields[0];
                  const pkField = pickerFields[0];
                  const isExclusive = !!(cbField.exclusive || (cbField.exclusiveWhenEven && entryTargets.length % 2 === 0));
                  const isChecked = currentValues[cbField.key] === 1;
                  return (
                    <div className="flex items-start gap-3">
                      {makeCheckboxButton(cbField, isChecked, isExclusive)}
                      <div className="flex-1 min-w-0">
                        <NumberPicker
                          value={currentValues[pkField.key] ?? 0}
                          onChange={(v) => setFieldValue(targetKey, pkField.key, v)}
                          min={pkField.min ?? 0}
                          max={pkField.max ?? 13}
                          homePosition={pkField.homePosition ?? 5}
                          disabled={pkField.computed}
                        />
                      </div>
                    </div>
                  );
                }

                // Inline layout for non-phased entries: exclusive checkbox checked + associated picker
                // e.g. Catch Five: [Bid ✓] [‹ 3 4 5 ... 9 ›] with remaining pickers below
                if (phases === null && checkboxFields.length === 1) {
                  const cbField = checkboxFields[0];
                  const isChecked = currentValues[cbField.key] === 1;
                  const isExclusive = !!(cbField.exclusive || (cbField.exclusiveWhenEven && entryTargets.length % 2 === 0));
                  const inlinePicker = pickerFields.find(
                    (pf) => allFields.find((af) => af.key === pf.key)?.showWhen?.field === cbField.key
                  );
                  if (isChecked && inlinePicker) {
                    const remainingPickers = pickerFields.filter((pf) => pf.key !== inlinePicker.key);
                    return (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          {makeCheckboxButton(cbField, isChecked, isExclusive)}
                          <div className="flex-1 min-w-0">
                            <NumberPicker
                              value={currentValues[inlinePicker.key] ?? 0}
                              onChange={(v) => setFieldValue(targetKey, inlinePicker.key, v)}
                              min={inlinePicker.min ?? 0}
                              max={inlinePicker.max ?? 13}
                              homePosition={inlinePicker.homePosition ?? 5}
                              disabled={inlinePicker.computed}
                            />
                          </div>
                        </div>
                        {remainingPickers.map((field) => (
                          <div key={field.key} className="flex flex-col gap-2">
                            {!field.hideLabel && (
                              <label className="text-xs font-medium text-slate-400 text-center">{field.label}</label>
                            )}
                            <NumberPicker
                              value={currentValues[field.key] ?? 0}
                              onChange={(v) => setFieldValue(targetKey, field.key, v)}
                              min={field.min ?? 0}
                              max={field.max ?? 13}
                              homePosition={field.homePosition ?? 5}
                              disabled={field.computed}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  }
                }

                // Default: grid checkboxes + pickers below
                const useGrid = checkboxFields.length >= 3;
                return (
                  <>
                    {checkboxFields.length > 0 && (
                      <div className={useGrid ? "grid gap-1.5" : "flex justify-center"}
                        style={useGrid ? { gridTemplateColumns: `repeat(${checkboxFields.length}, 1fr)` } : {}}>
                        {checkboxFields.map((field) => {
                          const isExclusive = !!(field.exclusive || (field.exclusiveWhenEven && entryTargets.length % 2 === 0));
                          return (
                            <button
                              key={field.key}
                              type="button"
                              onClick={() =>
                                setFieldValue(targetKey, field.key, currentValues[field.key] === 1 ? 0 : 1, isExclusive)
                              }
                              className={cn(
                                "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border transition-colors",
                                currentValues[field.key] === 1
                                  ? "border-accent bg-accent/10 text-white"
                                  : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                currentValues[field.key] === 1 ? "border-accent bg-accent" : "border-slate-500"
                              )}>
                                {currentValues[field.key] === 1 && (
                                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span className="text-xs font-medium text-center leading-tight">{field.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {pickerFields.map((field) => {
                      // Suppress label when: field has hideLabel, OR title already carries the label
                      // (roundEntryLabel set + this is the only picker)
                      const showLabel = !field.hideLabel && !(roundEntryLabel && pickerFields.length === 1);
                      return (
                        <div key={field.key} className="flex flex-col gap-2">
                          {showLabel && (
                            <label className="text-xs font-medium text-slate-400 text-center">{field.label}</label>
                          )}
                          <NumberPicker
                            value={currentValues[field.key] ?? 0}
                            onChange={(v) => setFieldValue(targetKey, field.key, v)}
                            min={field.min ?? 0}
                            max={field.max ?? 13}
                            homePosition={field.homePosition ?? 5}
                            disabled={field.computed}
                          />
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const modalTitle = phases
    ? `${game.roundName} ${roundNumber ?? ""} — ${phaseLabel}`
    : roundEntryLabel
      ? `Enter ${game.roundName} ${roundNumber ?? ""} — ${roundEntryLabel}`
      : `Enter ${game.roundName} ${roundNumber ?? ""}`;

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      <div className="space-y-3">
        {/* Phase progress indicator */}
        {phases && phases.length > 1 && (
          <div className="flex gap-1.5 mb-1">
            {phases.map((p) => (
              <div
                key={p}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  p <= currentPhase ? "bg-accent" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        )}

        {/* Global exclusive team selector (e.g. Catch Five "Won Bid") + linked bid picker */}
        {globalExclusiveField && (() => {
          const linkedPickerField = allFields.find(
            (f) => f.fieldType !== "checkbox" && f.showWhen?.field === globalExclusiveField.key
          ) ?? null;
          const selectedKey = entryTargets
            .map((t) => t.team ?? t.id)
            .find((key) => (values[key]?.[globalExclusiveField.key] ?? 0) === 1) ?? null;
          return (
            <div className="rounded-2xl bg-surface-elevated px-4 py-3 flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-400 text-center uppercase tracking-wide">
                {globalExclusiveField.label}
              </p>
              <div className="flex gap-2">
                {entryTargets.map((target) => {
                  const key = target.team ?? target.id;
                  const isSelected = (values[key]?.[globalExclusiveField.key] ?? 0) === 1;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFieldValue(key, globalExclusiveField.key, isSelected ? 0 : 1, true)}
                      className={cn(
                        "flex-1 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-colors",
                        isSelected
                          ? "border-accent bg-accent/10 text-white"
                          : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                      )}
                    >
                      {getTargetLabel(target)}
                    </button>
                  );
                })}
              </div>
              {linkedPickerField && (
                <NumberPicker
                  value={
                    selectedKey
                      ? (values[selectedKey]?.[linkedPickerField.key] ?? linkedPickerField.defaultValue ?? 0)
                      : (linkedPickerField.defaultValue ?? 0)
                  }
                  onChange={(v) => selectedKey && setFieldValue(selectedKey, linkedPickerField.key, v)}
                  min={linkedPickerField.min ?? 0}
                  max={linkedPickerField.max ?? 13}
                  homePosition={linkedPickerField.homePosition ?? 5}
                  disabled={!selectedKey}
                />
              )}
            </div>
          );
        })()}

        {isTextInput ? (
          // Compact list: name left, − toggle + text input right
          <div className="rounded-2xl bg-surface-elevated overflow-hidden divide-y divide-slate-700/50">
            {hasTriggerPlayer && (
              <div className="px-4 py-2.5 bg-surface-card/60">
                <p className="text-xs text-slate-400 text-center">Tap a name to mark who ended the round</p>
              </div>
            )}
            {entryTargets.map((target) => {
              const targetKey = isTeamFields ? (target.team ?? target.id) : target.id;
              const label = getTargetLabel(target);
              const rawText = textInputRaw[targetKey] ?? "";
              // Derive negative state from the raw string itself — no separate state needed
              const isNeg = rawText.startsWith("-");
              const isTrigger = triggerPlayerId === targetKey;
              return (
                <div key={targetKey} className="flex items-center gap-3 px-4 py-3">
                  {hasTriggerPlayer ? (
                    <button
                      type="button"
                      onClick={() => setTriggerPlayerId(isTrigger ? null : targetKey)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                        isTrigger ? "border-accent bg-accent" : "border-slate-600"
                      )} />
                      <span className={cn(
                        "text-sm font-medium truncate",
                        isTrigger ? "text-white" : "text-slate-200"
                      )}>{label}</span>
                    </button>
                  ) : (
                    <span className="flex-1 text-sm font-medium text-slate-200 truncate">{label}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      // Toggle sign in the raw string; update score in one state write
                      const newRaw = isNeg ? rawText.slice(1) : (rawText ? `-${rawText}` : "-");
                      const parsed = parseInt(newRaw, 10);
                      setTextInputRaw((prev) => ({ ...prev, [targetKey]: newRaw }));
                      setFieldValue(targetKey, "score", isNaN(parsed) ? 0 : parsed);
                    }}
                    className={cn(
                      "w-9 h-9 rounded-lg border-2 flex items-center justify-center text-base font-bold font-mono transition-colors shrink-0",
                      isNeg
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                    )}
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={rawText}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow only digits, leading minus, and empty
                      if (!/^-?\d*$/.test(val)) return;
                      setTextInputRaw((prev) => ({ ...prev, [targetKey]: val }));
                      const parsed = parseInt(val, 10);
                      setFieldValue(targetKey, "score", isNaN(parsed) ? 0 : parsed);
                    }}
                    className="w-16 text-center text-base font-mono font-bold rounded-lg bg-surface border border-slate-600 px-2 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          entryTargets.map((target) => renderTarget(target))
        )}

        {error && (
          <p className="text-danger text-sm bg-danger/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          {phases && currentPhase !== phases[0] ? (
            <Button variant="secondary" onClick={handleBack} className="flex-1">
              Back
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}

          {isLastPhase ? (
            <Button onClick={handleSubmit} loading={loading} className="flex-1">
              Save {game.roundName}
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Next →
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
