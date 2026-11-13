import { CONFIG } from "./config";
import { Fit, Role, ROLES } from "./types";

export interface BalanceInput {
  id: string;
  ratingByRole: Record<Role, number>;
  fitByRole: Record<Role, Fit>;
}

export interface BalanceResult {
  /** teams[t][roleIndex] = índice del jugador en el array de entrada */
  teams: number[][];
  totals: number[];
  maxDiff: number;
  alts: number;
  fills: number;
  cost: number;
}

/**
 * Reparte jugadores en equipos de 5 (una persona por línea) buscando:
 *  1. que la suma de rating de cada equipo sea lo más pareja posible,
 *  2. respetar línea principal (o alternativa; "fill" casi nunca),
 *  3. que cada duelo de línea (top vs top, etc.) también sea parejo.
 * Usa simulated annealing con varios reinicios: con 30 jugadores tarda milisegundos.
 * Es aleatorio a propósito: "Regenerar" da otra combinación igual de buena.
 */
export function balanceTeams(players: BalanceInput[], opts?: { restarts?: number; iterations?: number }): BalanceResult {
  const n = players.length;
  if (n === 0 || n % 5 !== 0) throw new Error("La cantidad de jugadores tiene que ser múltiplo de 5");
  const T = n / 5;
  const R = ROLES.length;
  const restarts = opts?.restarts ?? 12;
  const iterations = opts?.iterations ?? 30000;

  // slot s = t*5 + r  →  jugador
  const rating = (pi: number, s: number) => players[pi].ratingByRole[ROLES[s % R]];
  const fit = (pi: number, s: number) => players[pi].fitByRole[ROLES[s % R]];

  const cost = (assign: number[]) => {
    const totals = new Array(T).fill(0);
    let roleCost = 0;
    for (let s = 0; s < n; s++) {
      totals[Math.floor(s / R)] += rating(assign[s], s);
      const f = fit(assign[s], s);
      if (f === "alt") roleCost += CONFIG.altCost;
      else if (f === "fill") roleCost += CONFIG.fillCost;
    }
    const mean = totals.reduce((a, b) => a + b, 0) / T;
    const std = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / T);
    const spread = Math.max(...totals) - Math.min(...totals);

    let lane = 0;
    if (T > 1) {
      for (let r = 0; r < R; r++) {
        const vals = Array.from({ length: T }, (_, t) => rating(assign[t * R + r], t * R + r));
        const m = vals.reduce((a, b) => a + b, 0) / T;
        lane += Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / T);
      }
    }
    return std + 0.5 * spread + roleCost + CONFIG.laneBalanceWeight * lane;
  };

  const greedy = (): number[] => {
    const assign = new Array(n).fill(-1);
    const totals = new Array(T).fill(0);
    const order = players
      .map((p, i) => ({ i, r: Math.max(...ROLES.map((ro) => p.ratingByRole[ro])) + Math.random() * 200 }))
      .sort((a, b) => b.r - a.r)
      .map((x) => x.i);
    for (const pi of order) {
      let best = -1;
      let bestScore = Infinity;
      for (let s = 0; s < n; s++) {
        if (assign[s] !== -1) continue;
        const f = fit(pi, s);
        const penalty = f === "main" ? 0 : f === "alt" ? 1000 : 100000;
        const sc = penalty + totals[Math.floor(s / R)];
        if (sc < bestScore) {
          bestScore = sc;
          best = s;
        }
      }
      assign[best] = pi;
      totals[Math.floor(best / R)] += rating(pi, best);
    }
    return assign;
  };

  let best: number[] = [];
  let bestCost = Infinity;

  for (let rs = 0; rs < restarts; rs++) {
    let cur = greedy();
    let curCost = cost(cur);
    let localBest = cur.slice();
    let localBestCost = curCost;
    const t0 = 300;
    const t1 = 0.5;
    for (let it = 0; it < iterations; it++) {
      const temp = t0 * Math.pow(t1 / t0, it / iterations);
      const a = Math.floor(Math.random() * n);
      let b = Math.floor(Math.random() * n);
      if (a === b) b = (b + 1) % n;
      [cur[a], cur[b]] = [cur[b], cur[a]];
      const c = cost(cur);
      if (c <= curCost || Math.random() < Math.exp((curCost - c) / temp)) {
        curCost = c;
        if (c < localBestCost) {
          localBestCost = c;
          localBest = cur.slice();
        }
      } else {
        [cur[a], cur[b]] = [cur[b], cur[a]];
      }
    }
    if (localBestCost < bestCost) {
      bestCost = localBestCost;
      best = localBest;
    }
    cur = [];
  }

  const teams = Array.from({ length: T }, (_, t) => best.slice(t * R, t * R + R));
  const totals = teams.map((team, t) => team.reduce((a, pi, r) => a + rating(pi, t * R + r), 0));
  let alts = 0;
  let fills = 0;
  best.forEach((pi, s) => {
    const f = fit(pi, s);
    if (f === "alt") alts++;
    if (f === "fill") fills++;
  });
  return {
    teams,
    totals,
    maxDiff: Math.max(...totals) - Math.min(...totals),
    alts,
    fills,
    cost: bestCost,
  };
}
