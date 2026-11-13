import "server-only";

const PLATFORM = process.env.RIOT_PLATFORM || "la2"; // LAS
const REGION = process.env.RIOT_REGION || "americas";

export class RiotError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

async function riot<T>(host: string, path: string): Promise<T> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new RiotError(500, "Falta RIOT_API_KEY en las variables de entorno");
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after") ?? "10");
    throw new RiotError(429, "Límite de pedidos de Riot alcanzado", Number.isFinite(ra) ? ra : 10);
  }
  if (res.status === 401 || res.status === 403)
    throw new RiotError(res.status, "API key de Riot inválida o vencida (la de desarrollo dura 24 h)");
  if (res.status === 404) throw new RiotError(404, "No encontrado en Riot");
  if (!res.ok) throw new RiotError(res.status, `Error de Riot (${res.status})`);
  return (await res.json()) as T;
}

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export function getAccount(gameName: string, tagLine: string) {
  return riot<RiotAccount>(
    REGION,
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  );
}

export interface LeagueEntry {
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export function getLeagueEntries(puuid: string) {
  return riot<LeagueEntry[]>(PLATFORM, `/lol/league/v4/entries/by-puuid/${puuid}`);
}

export function getRankedMatchIds(puuid: string, count: number) {
  return riot<string[]>(REGION, `/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&start=0&count=${count}`);
}

export interface RiotParticipant {
  puuid: string;
  teamId: number;
  teamPosition: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  visionScore: number;
  gameEndedInEarlySurrender?: boolean;
}

export interface RiotMatch {
  metadata: { matchId: string };
  info: {
    gameDuration: number;
    gameEndTimestamp?: number;
    queueId: number;
    participants: RiotParticipant[];
  };
}

export function getMatch(matchId: string) {
  return riot<RiotMatch>(REGION, `/lol/match/v5/matches/${matchId}`);
}
