// Prueba del balanceo con jugadores inventados: npm run test:balance
import { balanceTeams } from "../lib/balance";
import { CONFIG } from "../lib/config";
import { Fit, Role, ROLES } from "../lib/types";

const N = Number(process.argv[2] ?? 30);
// Distribución realista: muchos quieren mid/adc, pocos support
const mainPool: Role[] = ["MIDDLE", "MIDDLE", "BOTTOM", "BOTTOM", "JUNGLE", "TOP", "TOP", "UTILITY"];

const players = Array.from({ length: N }, (_, i) => {
  const base = 400 + Math.random() * 2000; // Bronce → Diamante
  const main = mainPool[Math.floor(Math.random() * mainPool.length)];
  const alts = ROLES.filter((r) => r !== main);
  const alt = alts[Math.floor(Math.random() * alts.length)];
  const ratingByRole = {} as Record<Role, number>;
  const fitByRole = {} as Record<Role, Fit>;
  for (const r of ROLES) {
    const fit: Fit = r === main ? "main" : r === alt ? "alt" : "fill";
    fitByRole[r] = fit;
    ratingByRole[r] = Math.round(base - (fit === "alt" ? CONFIG.altPenalty : fit === "fill" ? CONFIG.fillPenalty : 0));
  }
  return { id: `p${i}`, ratingByRole, fitByRole, main, alt, base: Math.round(base) };
});

const count = (r: Role) => players.filter((p) => p.main === r).length;
console.log("Mains:", ROLES.map((r) => `${r}:${count(r)}`).join(" "));

const t = Date.now();
const res = balanceTeams(players);
console.log(`Tiempo: ${Date.now() - t} ms`);
res.teams.forEach((team, ti) => {
  console.log(
    `Equipo ${ti + 1} (${res.totals[ti]}): ` +
      team.map((pi, r) => `${ROLES[r][0]}=${players[pi].id}[${players[pi].fitByRole[ROLES[r]]}]`).join(" "),
  );
});
console.log(`Dif máx: ${res.maxDiff} | alt: ${res.alts} | fill: ${res.fills}`);
// Chequeo: cada jugador aparece una sola vez
const seen = new Set(res.teams.flat());
console.log(seen.size === N ? "OK: todos asignados una vez" : "ERROR: asignación inválida");
