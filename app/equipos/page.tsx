import Link from "next/link";
import Stars from "@/components/Stars";
import { db } from "@/lib/db";
import { DraftData, ROLE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Draft = { id: string; data: DraftData; created_at: string };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Buenos_Aires", day: "2-digit", month: "2-digit" });

export default async function Equipos({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  let drafts: Draft[] = [];
  try {
    const { data } = await db()
      .from("drafts")
      .select("id, data, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(30);
    drafts = (data as Draft[] | null) ?? [];
  } catch {
    drafts = [];
  }
  const draft = drafts.find((d) => d.id === id) ?? drafts[0];

  return (
    <main className="container">
      <h1>Equipos</h1>
      {!draft ? (
        <p className="muted">Todavía no se publicaron los equipos.</p>
      ) : (
        <>
          {drafts.length > 1 && (
            <div className="pill-row">
              {drafts.map((d) => (
                <Link key={d.id} href={`/equipos?id=${d.id}`} className={`pill ${d.id === draft.id ? "on" : ""}`}>
                  {d.data.name ?? "Torneo"} · {fecha(d.created_at)}
                </Link>
              ))}
            </div>
          )}
          <h2 style={{ marginTop: 8 }}>{draft.data.name ?? "Torneo"}</h2>
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
                      <span className="pname" title={p.rankLabel}>
                        {p.name}
                      </span>
                      {p.stars != null ? <Stars value={p.stars} /> : <span className="muted small">{p.rankLabel}</span>}
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
