import { CONFIG, METRIC_WEIGHTS } from "./config";
import {
  APEX_TIERS,
  DIVISIONS,
  Division,
  Fit,
  MatchRow,
  PlayerRow,
  PlayerStats,
  RankSource,
  RatedPlayer,
  Role,
  ROLES,
  TIERS,
  TIER_LABEL,
  Tier,
  isRole,
} from "./types";

/** Hierro IV 0 LP = 0, cada división = 100, cada tier = 400. Master+ = 2800 + LP. */
export function rankValue(tier: Tier, division: Division | null, lp = 0): number {
  if (APEX_TIERS.includes(tier)) return 2800 + Math.max(0, lp);
  const t = TIERS.indexOf(tier);
  const d = division ? DIVISIONS.indexOf(division) : 0;
  return t * 400 + d * 100 + Math.min(Math.max(lp, 0), 100);
}

export function rankLabel(tier: Tier | null, division: Division | null, lp?: number | null): string {
  if (!tier) return "Sin rango";
  const base = APEX_TIERS.includes(tier) ? TIER_LABEL[tier] : `${TIER_LABEL[tier]} ${division ?? ""}`.trim();
  return lp != null ? `${base} ${lp} LP` : base;
}

export function rankScore(p: PlayerRow): { score: number; source: RankSource } {
  const peak = p.peak_tier ? rankValue(p.peak_tier, p.peak_division) + 50 : null;
  let current: number | null = null;
  let source: RankSource = "default";

  if (p.solo_tier) {
    current = rankValue(p.solo_tier, p.solo_division, p.solo_lp ?? 0);
    source = "solo";
  } else if (p.flex_tier) {
    current = rankValue(p.flex_tier, p.flex_division, p.flex_lp ?? 0) - CONFIG.flexPenalty;
    source = "flex";
  }

  if (current != null && peak != null) {
    const w = CONFIG.peakWeight;
    return { score: (1 - w) * current + w * Math.max(peak, current), source };
  }
  if (current != null) return { score: current, source };
  if (peak != null) return { score: peak - CONFIG.peakOnlyPenalty, source: "peak" };
  return { score: CONFIG.defaultRankScore, source: "default" };
}

type Metrics = { kda: number; kp: number; csm: number; dpm: number; gpm: number; vspm: number; win: number };
const METRIC_KEYS: (keyof Metrics)[] = ["kda", "kp", "csm", "dpm", "gpm", "vspm", "win"];

function gameMetrics(m: MatchRow): Metrics {
  const min = Math.max(m.duration_s / 60, 1);
  return {
    kda: Math.min((m.kills + m.assists) / Math.max(1, m.deaths), 12),
    kp: m.team_kills > 0 ? (m.kills + m.assists) / m.team_kills : 0,
    csm: m.cs / min,
    dpm: m.damage / min,
    gpm: m.gold / min,
    vspm: m.vision / min,
    win: m.win ? 1 : 0,
  };
}

type Dist = Record<keyof Metrics, { mean: number; std: number }>;

function distribution(rows: Metrics[]): Dist {
  const out = {} as Dist;
  for (const k of METRIC_KEYS) {
    const vals = rows.map((r) => r[k]);
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1);
    out[k] = { mean, std: Math.sqrt(variance) || 1 };
  }
  return out;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Calcula rating por jugador y por línea.
 * El rendimiento se mide comparando cada partida contra todas las partidas del grupo
 * jugadas en la MISMA línea (así un support no queda mal por tener pocos minions).
 */
export function computeRatings(players: PlayerRow[], matches: MatchRow[], matchCount = 20): RatedPlayer[] {
  // Últimas N partidas por jugador
  const byPuuid = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (!m.duration_s || m.duration_s <= 0) continue; // remakes
    if (!byPuuid.has(m.puuid)) byPuuid.set(m.puuid, []);
    byPuuid.get(m.puuid)!.push(m);
  }
  for (const [k, list] of byPuuid) {
    list.sort((a, b) => (b.game_end ?? "").localeCompare(a.game_end ?? ""));
    byPuuid.set(k, list.slice(0, matchCount));
  }

  const registered = new Set(players.map((p) => p.puuid).filter(Boolean) as string[]);
  const pool = [...byPuuid.entries()].filter(([k]) => registered.has(k)).flatMap(([, v]) => v);

  // Distribuciones por línea (y general como respaldo)
  const allDist = distribution(pool.map(gameMetrics));
  const roleDist = new Map<string, Dist>();
  for (const r of ROLES) {
    const rows = pool.filter((m) => m.position === r).map(gameMetrics);
    if (rows.length >= 5) roleDist.set(r, distribution(rows));
  }

  const gameScore = (m: MatchRow): number => {
    const pos = isRole(m.position) ? m.position : "ALL";
    const dist = roleDist.get(pos) ?? allDist;
    const w = METRIC_WEIGHTS[pos];
    const g = gameMetrics(m);
    let num = 0;
    let den = 0;
    for (const k of METRIC_KEYS) {
      if (!w[k]) continue;
      num += w[k] * ((g[k] - dist[k].mean) / dist[k].std);
      den += w[k];
    }
    return den ? num / den : 0;
  };

  const shrink = (scores: number[]) =>
    scores.length === 0
      ? 0
      : clamp(
          (scores.reduce((a, b) => a + b, 0) / scores.length) *
            (scores.length / (scores.length + CONFIG.perfShrinkGames)),
          -2,
          2,
        );

  return players.map((p) => {
    const { score, source } = rankScore(p);
    const games = p.puuid ? byPuuid.get(p.puuid) ?? [] : [];

    const perf = shrink(games.map(gameScore));
    const perfByRole: Partial<Record<Role, number>> = {};
    for (const r of ROLES) {
      const rg = games.filter((m) => m.position === r);
      if (rg.length >= CONFIG.minGamesForRolePerf) perfByRole[r] = shrink(rg.map(gameScore));
    }

    const ratingByRole = {} as Record<Role, number>;
    const fitByRole = {} as Record<Role, Fit>;
    for (const r of ROLES) {
      const fit: Fit = r === p.main_role ? "main" : r === p.alt_role ? "alt" : "fill";
      const penalty = fit === "main" ? 0 : fit === "alt" ? CONFIG.altPenalty : CONFIG.fillPenalty;
      const pr = perfByRole[r] ?? perf;
      ratingByRole[r] = Math.round(score + CONFIG.perfPoints * pr + (p.manual_adjust ?? 0) - penalty);
      fitByRole[r] = fit;
    }

    return {
      player: p,
      rankScore: Math.round(score),
      rankSource: source,
      perf,
      perfByRole,
      stats: games.length ? aggregateStats(games) : null,
      ratingByRole,
      fitByRole,
      rating: ratingByRole[p.main_role],
    };
  });
}

function aggregateStats(games: MatchRow[]): PlayerStats {
  const sum = (f: (m: MatchRow) => number) => games.reduce((a, m) => a + f(m), 0);
  const minutes = sum((m) => m.duration_s) / 60 || 1;
  const deaths = sum((m) => m.deaths);
  const teamKills = sum((m) => m.team_kills);
  const roleGames = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
  const champs = new Map<string, number>();
  for (const m of games) {
    if (isRole(m.position)) roleGames[m.position]++;
    if (m.champion) champs.set(m.champion, (champs.get(m.champion) ?? 0) + 1);
  }
  return {
    games: games.length,
    winrate: sum((m) => (m.win ? 1 : 0)) / games.length,
    kda: (sum((m) => m.kills) + sum((m) => m.assists)) / Math.max(1, deaths),
    kp: teamKills ? (sum((m) => m.kills) + sum((m) => m.assists)) / teamKills : 0,
    csm: sum((m) => m.cs) / minutes,
    dpm: sum((m) => m.damage) / minutes,
    gpm: sum((m) => m.gold) / minutes,
    vspm: sum((m) => m.vision) / minutes,
    roleGames,
    topChampions: [...champs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c),
  };
}
