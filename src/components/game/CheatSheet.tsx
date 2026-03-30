"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { CheatSheetSection } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface CheatSheetProps {
  sections: CheatSheetSection[];
  gameName: string;
}

export function CheatSheet({ sections, gameName }: CheatSheetProps) {
  const [open, setOpen] = useState(false);

  if (sections.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-surface-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <BookOpen size={16} />
          <span className="font-semibold text-sm">{gameName} Scoring Reference</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-500" />
        ) : (
          <ChevronDown size={16} className="text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-3">
          {sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.entries.map((entry, j) => (
                  <div key={j} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-slate-300">{entry.label}</span>
                    {(entry.value !== undefined || entry.note) && (
                      <div className="text-right shrink-0">
                        {entry.value !== undefined && (
                          <div className="font-mono font-semibold text-accent-light">
                            {entry.value}
                          </div>
                        )}
                        {entry.note && (
                          <div className="text-slate-500 text-xs italic whitespace-pre-line">{entry.note}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
