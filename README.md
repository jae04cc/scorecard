# Scorecard

A mobile-first web app for tracking scores in card and board games. Runs locally in Docker, built for self-hosting on Unraid.

## Supported Games

| Game | Players | Win Condition |
|---|---|---|
| ♠️ Spades | 4 (2 teams) | First team to 500 pts |
| 🃏 Casino | 2–4 | First to 21 pts |
| 🎴 Skyjo | 2–8 | Lowest when someone hits 100 |
| 🖐️ Catch Five | 3–7 | Lowest after N rounds |
| 🏎️ Downforce | 2–6 | Most money after race |

## Quick Start (Docker)

```bash
# Clone and start
git clone <repo>
cd scorecard

docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database is stored in `./data/scorecard.db` on your host.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database is created automatically at `./data/scorecard.db`.

## Unraid Setup

1. In Unraid, go to **Docker → Add Container**
2. Repository: build locally or push to a registry
3. Port mapping: `3000 → 3000`
4. Volume mapping: `/mnt/user/appdata/scorecard` → `/data`
5. Environment: `DATABASE_PATH=/data/scorecard.db`

Or use `docker-compose.yml` with the Unraid Community App Store / Compose Manager plugin.

## Adding a New Game

1. Create `src/lib/games/your-game.ts` implementing `GameDefinition`
2. Import and add it to the array in `src/lib/games/index.ts`
3. That's it — the UI picks it up automatically

```typescript
// src/lib/games/your-game.ts
import type { GameDefinition } from "./types";

export const yourGame: GameDefinition = {
  id: "your-game",
  name: "Your Game",
  // ...
};
```

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Home / game selection
│   ├── new/page.tsx          # New game setup
│   ├── game/[id]/page.tsx    # Active game screen
│   ├── history/page.tsx      # Game history list
│   ├── history/[id]/page.tsx # Past game detail
│   └── api/                  # Next.js API routes (no separate backend)
│       ├── games/            # Game definitions
│       └── sessions/         # CRUD for game sessions
├── components/
│   ├── ui/                   # Button, Card, Input, Modal, Badge
│   └── game/                 # ScoreTable, RoundEntryModal, CheatSheet, StandingsBar
└── lib/
    ├── db/                   # Drizzle ORM + SQLite (better-sqlite3)
    └── games/                # Game definitions (plugin-style registry)
```

## Stack

- **Next.js 14** (App Router) — framework + API routes in one
- **TypeScript** — end-to-end type safety
- **SQLite + Drizzle ORM** — file-based, zero-ops, Docker-friendly
- **Tailwind CSS** — mobile-first, dark theme
- **Lucide React** — icons

## Known TODOs / Future Work

- [ ] Spades: full bag tracking (requires storing per-team bid+tricks in metadata)
- [ ] Spades: Blind Nil bid support (+200/−200)
- [ ] Casino: auto-compute "most cards" and "most spades" bonuses
- [ ] Catch Five: verify exact point card values — house rules vary widely
- [ ] Downforce: per-player auction spend entry in new-game setup flow
- [ ] PWA icons (add icon-192.png and icon-512.png to /public)
- [ ] Push notification / sound when win condition is hit
- [ ] Export game history to CSV
- [ ] Player name autocomplete from previous sessions
