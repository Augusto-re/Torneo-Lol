import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MatchRow, PlayerRow } from "./types";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export async function listPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await db().from("players").select("*").order("created_at");
  if (error) throw error;
  return data as PlayerRow[];
}

/** Trae todas las partidas de los puuids (paginando, Supabase devuelve 1000 por pedido). */
export async function listMatches(puuids: string[]): Promise<MatchRow[]> {
  if (!puuids.length) return [];
  const out: MatchRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db()
      .from("player_matches")
      .select("*")
      .in("puuid", puuids)
      .order("game_end", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...(data as MatchRow[]));
    if (!data || data.length < page) break;
  }
  return out;
}
