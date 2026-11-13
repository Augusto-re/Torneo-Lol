import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listMatches, listPlayers } from "@/lib/db";
import { computeRatings } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const players = await listPlayers();
  const matches = await listMatches(players.map((p) => p.puuid).filter(Boolean) as string[]);
  const rated = computeRatings(players, matches, Number(process.env.MATCH_COUNT) || 20);
  return NextResponse.json({ players: rated });
}
