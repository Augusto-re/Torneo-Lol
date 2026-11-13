export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungla",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  IRON: "Hierro",
  BRONZE: "Bronce",
  SILVER: "Plata",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Esmeralda",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran Maestro",
  CHALLENGER: "Retador",
};

export const DIVISIONS = ["IV", "III", "II", "I"] as const;
export type Division = (typeof DIVISIONS)[number];

export const APEX_TIERS: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

export function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}
export function isTier(x: unknown): x is Tier {
  return typeof x === "string" && (TIERS as readonly string[]).includes(x);
}
export function isDivision(x: unknown): x is Division {
  return typeof x === "string" && (DIVISIONS as readonly string[]).includes(x);
}

export interface PlayerRow {
  id: string;
  game_name: string;
  tag_line: string;
  puuid: string | null;
  main_role: Role;
  alt_role: Role;
  peak_tier: Tier | null;
  peak_division: Division | null;
  active: boolean;
  manual_adjust: number;
  solo_tier: Tier | null;
  solo_division: Division | null;
  solo_lp: number | null;
  solo_wins: number | null;
  solo_losses: number | null;
  flex_tier: Tier | null;
  flex_division: Division | null;
  flex_lp: number | null;
  flex_wins: number | null;
  flex_losses: number | null;
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
}

export interface MatchRow {
  match_id: string;
  puuid: string;
  queue_id: number | null;
  champion: string | null;
  position: string | null;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  gold: number;
  vision: number;
  team_kills: number;
  duration_s: number;
  game_end: string | null;
}

export interface PlayerStats {
  games: number;
  winrate: number;
  kda: number;
  kp: number;
  csm: number;
  dpm: number;
  gpm: number;
  vspm: number;
  roleGames: Record<Role, number>;
  topChampions: string[];
}

export type RankSource = "solo" | "flex" | "peak" | "default";
export type Fit = "main" | "alt" | "fill";

export interface RatedPlayer {
  player: PlayerRow;
  rankScore: number;
  rankSource: RankSource;
  perf: number; // rendimiento global (z-score promedio, -2..2)
  perfByRole: Partial<Record<Role, number>>;
  stats: PlayerStats | null;
  ratingByRole: Record<Role, number>;
  fitByRole: Record<Role, Fit>;
  rating: number; // rating en su línea principal
}

export interface DraftPlayer {
  playerId: string;
  name: string;
  role: Role;
  fit: Fit;
  rating: number;
  rankLabel: string;
}

export interface DraftTeam {
  name: string;
  total: number;
  players: DraftPlayer[];
}

export interface DraftData {
  teams: DraftTeam[];
  bench: { playerId: string; name: string }[];
}
