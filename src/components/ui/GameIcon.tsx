import { Spade, Coins, Hand, Flag, Cloud, Shuffle, type LucideIcon } from "lucide-react";

type IconComponent = LucideIcon;

const ICONS: Record<string, IconComponent> = {
  spades: Spade,
  casino: Coins,
  skyjo: Cloud,
  "catch-five": Hand,
  downforce: Flag,
  custom: Shuffle,
};

// Per-game colors for icon bubbles — use with style prop to avoid Tailwind purge issues
export const GAME_COLORS: Record<string, { bg: string; text: string }> = {
  spades:       { bg: "rgba(15,23,42,0.8)",   text: "#94a3b8" },  // dark slate / silver
  casino:       { bg: "rgba(69,10,10,0.8)",   text: "#f87171" },  // dark red / red
  skyjo:        { bg: "rgba(23,37,84,0.8)",   text: "#93c5fd" },  // dark blue / sky blue
  "catch-five": { bg: "rgba(78,52,0,0.8)",    text: "#fbbf24" },  // dark amber / yellow
  downforce:    { bg: "rgba(5,46,22,0.8)",    text: "#4ade80" },  // dark green / green
  custom:       { bg: "rgba(51,51,51,0.8)",   text: "#d1d5db" },  // neutral grey
};

export function gameIconStyle(gameId: string): React.CSSProperties {
  const colors = GAME_COLORS[gameId];
  if (!colors) return {};
  return { background: colors.bg, color: colors.text };
}

interface GameIconProps {
  gameId: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  fallback?: string;
}

export function GameIcon({ gameId, size = 22, strokeWidth = 1.5, className, fallback }: GameIconProps) {
  const Icon = ICONS[gameId];
  if (!Icon) {
    return fallback ? <span>{fallback}</span> : null;
  }
  return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
}
