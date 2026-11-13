import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccount, getLeagueEntries, getMatch, getRankedMatchIds, leagueFields, RiotError } from "@/lib/riot";
import { PlayerRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MATCHES_PER_CALL = 5;

/**
 * Sincroniza un jugador en pasos cortos (para no pasarse del tiempo de Vercel ni del límite de Riot):
 *  - { action: "profile" }  → cuenta + rango + lista de partidas. Devuelve las partidas pendientes.
 *  - { action: "matches", matchIds: [...] } → baja hasta 5 partidas y las guarda.
 * Si Riot responde 429, devolvemos 429 con retryAfter y el panel espera y reintenta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: player, error } = await db().from("players").select("*").eq("id", id).single<PlayerRow>();
  if (error || !player) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });

  try {
    if (body.action === "matches") {
      const ids: string[] = Array.isArray(body.matchIds) ? body.matchIds.slice(0, MAX_MATCHES_PER_CALL) : [];
      const saved = await syncMatches(ids);
      return NextResponse.json({ ok: true, saved });
    }
    const pending = await syncProfile(player);
    return NextResponse.json({ ok: true, pending });
  } catch (e) {
    if (e instanceof RiotError) {
      if (e.status === 429) {
        return NextResponse.json({ error: e.message, retryAfter: e.retryAfter ?? 10 }, { status: 429 });
      }
      await db().from("players").update({ sync_error: e.message }).eq("id", id);
      return NextResponse.json({ error: e.message }, { status: e.status === 404 ? 404 : 502 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function syncProfile(player: PlayerRow): Promise<string[]> {
  let puuid = player.puuid;
  const update: Record<string, unknown> = {};

  if (!puuid) {
    const acc = await getAccount(player.game_name, player.tag_line);
    puuid = acc.puuid;
    Object.assign(update, { puuid, game_name: acc.gameName, tag_line: acc.tagLine });
  }

  const entries = await getLeagueEntries(puuid);
  Object.assign(update, leagueFields(entries), {
    last_synced_at: new Date().toISOString(),
    sync_error: null,
  });
  const { error } = await db().from("players").update(update).eq("id", player.id);
  if (error) throw new Error(error.message);

  const count = Math.min(Math.max(Number(process.env.MATCH_COUNT) || 20, 1), 100);
  const ids = await getRankedMatchIds(puuid, count);
  if (!ids.length) return [];
  const { data: have } = await db().from("player_matches").select("match_id").eq("puuid", puuid).in("match_id", ids);
  const known = new Set((have ?? []).map((r) => r.match_id as string));
  return ids.filter((m) => !known.has(m));
}

/** Baja partidas y guarda las filas de TODOS los jugadores inscriptos que aparezcan (ahorra pedidos). */
async function syncMatches(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data: regs } = await db().from("players").select("puuid").not("puuid", "is", null);
  const registered = new Set((regs ?? []).map((r) => r.puuid as string));

  // Si un reintento trae partidas que ya guardamos, no las volvemos a pedir.
  const { data: existing } = await db().from("player_matches").select("match_id").in("match_id", ids);
  const done = new Set((existing ?? []).map((r) => r.match_id as string));

  let saved = 0;
  for (const matchId of ids) {
    if (done.has(matchId)) continue;
    let match;
    try {
      match = await getMatch(matchId);
    } catch (e) {
      if (e instanceof RiotError && e.status === 404) continue;
      throw e;
    }
    const info = match.info;
    const remake = info.gameDuration < 300 || info.participants.some((p) => p.gameEndedInEarlySurrender);
    const teamKills = new Map<number, number>();
    for (const p of info.participants) teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.kills);

    const rows = info.participants
      .filter((p) => registered.has(p.puuid))
      .map((p) => ({
        match_id: matchId,
        puuid: p.puuid,
        queue_id: info.queueId,
        champion: p.championName,
        position: p.teamPosition || null,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        damage: p.totalDamageDealtToChampions,
        gold: p.goldEarned,
        vision: p.visionScore,
        team_kills: teamKills.get(p.teamId) ?? 0,
        duration_s: remake ? 0 : info.gameDuration,
        game_end: info.gameEndTimestamp ? new Date(info.gameEndTimestamp).toISOString() : null,
      }));
    // Las remakes se guardan con duración 0 para no volver a pedirlas, y se ignoran al puntuar.
    if (rows.length) {
      const { error } = await db().from("player_matches").upsert(rows);
      if (error) throw new Error(error.message);
    }
    saved++;
  }
  return saved;
}
