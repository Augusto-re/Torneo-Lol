import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { APEX_TIERS, isAltRole, isDivision, isRole, isTier } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Editar jugador (admin): líneas, pico, activo, ajuste manual. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (isRole(b.main_role)) patch.main_role = b.main_role;
  if (isAltRole(b.alt_role)) patch.alt_role = b.alt_role;
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.manual_adjust === "number" && Number.isFinite(b.manual_adjust))
    patch.manual_adjust = Math.round(b.manual_adjust);
  if ("peak_tier" in b) {
    patch.peak_tier = isTier(b.peak_tier) ? b.peak_tier : null;
    patch.peak_division =
      isTier(b.peak_tier) && !APEX_TIERS.includes(b.peak_tier) ? (isDivision(b.peak_division) ? b.peak_division : "IV") : null;
  }
  const { error } = await db().from("players").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await db().from("players").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
