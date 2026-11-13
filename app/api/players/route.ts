import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount, RiotError } from "@/lib/riot";
import { APEX_TIERS, isDivision, isRole, isTier } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Inscripción pública. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { riotId, mainRole, altRole, peakTier, peakDivision, code } = body ?? {};

  const required = process.env.TOURNAMENT_CODE;
  if (required && code !== required) {
    return NextResponse.json({ error: "Código del torneo incorrecto" }, { status: 403 });
  }

  const match = typeof riotId === "string" ? riotId.trim().match(/^(.{3,16})#([A-Za-z0-9]{2,5})$/) : null;
  if (!match) return NextResponse.json({ error: "El Riot ID tiene que ser Nombre#TAG" }, { status: 400 });
  if (!isRole(mainRole) || !isRole(altRole))
    return NextResponse.json({ error: "Elegí línea principal y alternativa" }, { status: 400 });
  if (mainRole === altRole)
    return NextResponse.json({ error: "La alternativa tiene que ser distinta a la principal" }, { status: 400 });
  if (peakTier && !isTier(peakTier)) return NextResponse.json({ error: "Rango histórico inválido" }, { status: 400 });

  const tier = peakTier || null;
  const division = tier && !APEX_TIERS.includes(tier) ? (isDivision(peakDivision) ? peakDivision : "IV") : null;

  let gameName = match[1].trim();
  let tagLine = match[2];
  let puuid: string | null = null;
  try {
    const acc = await getAccount(gameName, tagLine);
    puuid = acc.puuid;
    gameName = acc.gameName;
    tagLine = acc.tagLine;
  } catch (e) {
    if (e instanceof RiotError && e.status === 404) {
      return NextResponse.json({ error: "Ese Riot ID no existe. Revisá el nombre y el #TAG." }, { status: 404 });
    }
    // Si Riot falla (key vencida, límite), lo inscribimos igual y se resuelve al sincronizar.
  }

  const { error } = await db().from("players").insert({
    game_name: gameName,
    tag_line: tagLine,
    puuid,
    main_role: mainRole,
    alt_role: altRole,
    peak_tier: tier,
    peak_division: division,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ese jugador ya está inscripto" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name: `${gameName}#${tagLine}` });
}
