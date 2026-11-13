import { db } from "@/lib/db";
import { DraftData, ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Equipos() {
  type Draft = { data: DraftData; created_at: string };
  let draft: Draft | null = null;
  try {
    const { data } = await db()
      .from("drafts")
      .select("data, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    draft = (data as Draft | null) ?? null;
  } catch {
    draft = null;
  }

  return (
    <main className="container">
      <h1>Equipos</h1>
      {!draft ? (
        <p className="muted">Todavía no se publicaron los equipos.</p>
      ) : (
        <>
          <p className="muted small">
            Publicado el {new Date(draft.created_at).toLocaleString("es-AR", { timeZone: "America/Buenos_Aires" })}
          </p>
          <div className="teams">
            {draft.data.teams.map((t) => (
              <div className="team" key={t.name}>
                <h3>{t.name}</h3>
                <ul>
                  {t.players.map((p) => (
                    <li key={p.playerId}>
                      <span className="role">{ROLE_LABEL[p.role]}</span>
                      <span className="pname">{p.name}</span>
                      <span className="muted small">{p.rankLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {draft.data.bench.length > 0 && (
            <p className="muted" style={{ marginTop: 18 }}>
              Suplentes: {draft.data.bench.map((b) => b.name).join(", ")}
            </p>
          )}
        </>
      )}
    </main>
  );
}
