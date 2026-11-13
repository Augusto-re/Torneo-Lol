import { CONFIG } from "./config";
import { RatedPlayer } from "./types";

const half = (x: number) => Math.round(x * 2) / 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Devuelve las estrellas (0.5–5, de a media) de cada jugador, por id. */
export function computeStars(rated: RatedPlayer[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (CONFIG.starsMode === "relative") {
    const vals = rated.map((r) => r.rating);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    for (const r of rated) {
      out[r.player.id] = max - min < 1 ? 3 : half(1 + (4 * (r.rating - min)) / (max - min));
    }
  } else {
    for (const r of rated) out[r.player.id] = Math.max(0.5, half(0.5 + 4.5 * clamp01(r.rating / 2800)));
  }
  return out;
}
