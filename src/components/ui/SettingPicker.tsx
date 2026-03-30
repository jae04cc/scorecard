"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function SettingPicker({
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
    const itemSize = 52;
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
              : "bg-surface-elevated border border-slate-600 text-slate-300"
          )}
        >
          {n === min && minLabel ? minLabel : n}
        </button>
      ))}
    </div>
  );
}
