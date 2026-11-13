import RegisterForm from "@/components/RegisterForm";
import { listPlayers } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let players: Awaited<ReturnType<typeof listPlayers>> = [];
  let dbError = "";
  try {
    players = await listPlayers();
  } catch (e) {
    dbError = (e as Error).message;
  }

  return (
    <main className="container narrow">
      <h1>Inscripción</h1>
      <p className="muted">
        Poné tu Riot ID de LAS, qué línea querés jugar y una alternativa. Tu rango y tus estadísticas se traen solos.
      </p>
      <div className="card">
        <RegisterForm needsCode={Boolean(process.env.TOURNAMENT_CODE)} />
      </div>

      <h2>Inscriptos ({players.length})</h2>
      {dbError ? (
        <p className="msg err">No se pudo conectar a la base: {dbError}</p>
      ) : players.length === 0 ? (
        <p className="muted">Todavía no se anotó nadie.</p>
      ) : (
        <ul className="plain">
          {players.map((p) => (
            <li key={p.id}>
              {p.game_name}
              <span className="muted">#{p.tag_line}</span> — {ROLE_LABEL[p.main_role]} / {ROLE_LABEL[p.alt_role]}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
