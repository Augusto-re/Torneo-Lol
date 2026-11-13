/**
 * Todos los "pesos" del armado de equipos están acá para que los puedan tunear.
 * Las unidades son "puntos de rango": 100 puntos = 1 división (ej. Oro II → Oro I).
 */
export const CONFIG = {
  /**
   * Estrellas (0.5 a 5, de a media):
   *  - "absolute": por nivel real. Hierro IV = 0.5★, Plata II ≈ 2★, Oro II = 3★, Platino II = 3.5★,
   *    Esmeralda II = 4★, Diamante II = 4.5★, Master+ = 5★.
   *  - "relative": el mejor del grupo tiene 5★ y el más flojo 1★.
   */
  starsMode: "absolute" as "absolute" | "relative",

  /** Rango por defecto si alguien no tiene rango actual ni pico cargado (Plata II). */
  defaultRankScore: 1000,
  /** Cuánto pesa el pico histórico cuando también hay rango actual (0..1). */
  peakWeight: 0.25,
  /** Si solo hay pico (no rankeó esta temporada), se descuenta esto. */
  peakOnlyPenalty: 150,
  /** Si el rango sale de flex en vez de solo/duo, se descuenta esto. */
  flexPenalty: 75,

  /** Cuántos puntos de rango vale 1 desvío estándar de rendimiento (KDA, daño, etc.). */
  perfPoints: 150,
  /** Partidas "ficticias" para no confiar en jugadores con pocas partidas. */
  perfShrinkGames: 5,
  /** Mínimo de partidas en una línea para usar su rendimiento específico. */
  minGamesForRolePerf: 3,

  /** Penalización por jugar la línea alternativa / una línea que no eligió. */
  altPenalty: 75,
  fillPenalty: 250,

  /** Costos extra del optimizador (evitar alternativas y sobre todo fills). */
  altCost: 30,
  fillCost: 400,
  /** Peso de que cada línea esté pareja entre equipos (top vs top, etc.). */
  laneBalanceWeight: 0.2,
};

/** Pesos por línea de cada métrica para el rendimiento. */
export const METRIC_WEIGHTS: Record<
  string,
  { kda: number; kp: number; csm: number; dpm: number; gpm: number; vspm: number; win: number }
> = {
  TOP: { kda: 1, kp: 0.5, csm: 1, dpm: 1, gpm: 1, vspm: 0.3, win: 0.5 },
  JUNGLE: { kda: 1, kp: 1, csm: 0.5, dpm: 0.7, gpm: 0.8, vspm: 0.6, win: 0.5 },
  MIDDLE: { kda: 1, kp: 0.8, csm: 1, dpm: 1.2, gpm: 1, vspm: 0.3, win: 0.5 },
  BOTTOM: { kda: 1, kp: 0.8, csm: 1.2, dpm: 1.2, gpm: 1, vspm: 0.3, win: 0.5 },
  UTILITY: { kda: 1, kp: 1.2, csm: 0, dpm: 0.5, gpm: 0.3, vspm: 1.3, win: 0.5 },
  ALL: { kda: 1, kp: 1, csm: 0.5, dpm: 1, gpm: 1, vspm: 0.5, win: 0.5 },
};
