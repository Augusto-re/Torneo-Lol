import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Publica un armado de equipos (queda visible en /equipos). */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data } = await req.json().catch(() => ({}));
  if (!data || !Array.isArray(data.teams)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { error } = await db().from("drafts").insert({ data, published: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
