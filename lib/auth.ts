import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "torneo_admin";

export function adminToken(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("Falta ADMIN_PASSWORD");
  return createHash("sha256").update(`torneo-lol:${pw}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!c || !process.env.ADMIN_PASSWORD) return false;
  const a = Buffer.from(c);
  const b = Buffer.from(adminToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}
