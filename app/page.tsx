import RegisterForm from "@/components/RegisterForm";
import Stars from "@/components/Stars";
import { listMatches, listPlayers } from "@/lib/db";
import { computeRatings, rankLabel } from "@/lib/scoring";
import { computeStars } from "@/lib/stars";
import { altLabel, RatedPlayer, ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

function currentRank(p: RatedPlayer): string {
  const pl = p.player;
  if (pl.solo_tier) return rankLabel(pl.solo_tier, pl.solo_division);
  if (pl.flex_tier) return `${rankLabel(pl.flex_tier, pl.flex_division)} (flex)`;
  if (pl.peak_tier) return `Sin rango (pico ${rankLabel(pl.peak_tier, pl.peak_division)})`;
  return "Sin rango";
}

export default async function Home() {
  let rated: RatedPlayer[] = [];
  let stars: Record<string, number> = {};
  let dbError = "";
  try {
    const players = await listPlayers();
    const matches = await listMatches(players.map((p) => p.puuid).filter(Boolean) as string[]);
    rated = computeRatings(players, matches, Number(process.env.MATCH_COUNT) || 20).sort((a, b) => b.rating - a.rating);
    stars = computeStars(rated);
  } catch (e) {
    dbError = (e as Error).message;
  }

  return (
    <main className="container narrow" style={{ maxWidth: 760 }}>
      <h1>Inscripción</h1>
      <p className="muted">
        Poné tu Riot ID de LAS, qué línea querés jugar y una alternativa. Tu rango y tus estadísticas se traen solos.
      </p>
      <div className="card" style={{ maxWidth: 560 }}>
        <RegisterForm needsCode={Boolean(process.env.TOURNAMENT_CODE)} />
      </div>

      <h2>Inscriptos ({rated.length})</h2>
      {dbError ? (
        <p className="msg err">No se pudo conectar a la base: {dbError}</p>
      ) : rated.length === 0 ? (
        <p className="muted">Todavía no se anotó nadie.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Líneas</th>
                <th>Rango</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              {rated.map((r) => (
                <tr key={r.player.id}>
                  <td>
                    {r.player.game_name}
                    <span className="muted">#{r.player.tag_line}</span>
                  </td>
                  <td>
                    {ROLE_LABEL[r.player.main_role]} <span className="muted">/ {altLabel(r.player.alt_role)}</span>
                  </td>
                  <td className="small">{currentRank(r)}</td>
                  <td>
                    <Stars value={stars[r.player.id]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 10 }}>
        El nivel combina el rango actual, el más alto histórico y cómo vienen jugando sus últimas rankeadas.
      </p>
    </main>
  );
}
