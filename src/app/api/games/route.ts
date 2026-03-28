import { NextResponse } from "next/server";
import { getAllGames } from "@/lib/games";

export async function GET() {
  const games = getAllGames().map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    supportsTeams: g.supportsTeams,
    playersPerTeam: g.playersPerTeam,
    teamsWhenPlayerCount: g.teamsWhenPlayerCount,
    playerColumns: g.playerColumns,
    roundName: g.roundName,
    color: g.color,
    emoji: g.emoji,
    winCondition: g.winCondition,
    settings: g.settings,
    cheatSheet: g.cheatSheet,
  }));

  return NextResponse.json(games);
}
