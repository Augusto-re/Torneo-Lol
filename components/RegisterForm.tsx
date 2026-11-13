"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APEX_TIERS, DIVISIONS, ROLES, ROLE_LABEL, TIERS, TIER_LABEL, Tier } from "@/lib/types";

export default function RegisterForm({ needsCode }: { needsCode: boolean }) {
  const router = useRouter();
  const [riotId, setRiotId] = useState("");
  const [mainRole, setMainRole] = useState("");
  const [altRole, setAltRole] = useState("");
  const [peakTier, setPeakTier] = useState("");
  const [peakDivision, setPeakDivision] = useState("IV");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotId, mainRole, altRole, peakTier, peakDivision, code }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `¡Listo! ${j.name} quedó inscripto.` });
      setRiotId("");
      setMainRole("");
      setAltRole("");
      setPeakTier("");
      router.refresh();
    } else {
      setMsg({ ok: false, text: j.error ?? "Algo salió mal" });
    }
  }

  const isApex = peakTier && APEX_TIERS.includes(peakTier as Tier);

  return (
    <form onSubmit={submit}>
      <label>Riot ID</label>
      <input placeholder="Nombre#LAS" value={riotId} onChange={(e) => setRiotId(e.target.value)} required />

      <div className="row">
        <div>
          <label>Línea principal</label>
          <select value={mainRole} onChange={(e) => setMainRole(e.target.value)} required>
            <option value="">Elegí…</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Alternativa</label>
          <select value={altRole} onChange={(e) => setAltRole(e.target.value)} required>
            <option value="">Elegí…</option>
            {ROLES.filter((r) => r !== mainRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div>
          <label>Rango más alto que llegaste (cualquier temporada)</label>
          <select value={peakTier} onChange={(e) => setPeakTier(e.target.value)}>
            <option value="">Nunca rankeé / no sé</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {peakTier && !isApex && (
          <div style={{ maxWidth: 110 }}>
            <label>División</label>
            <select value={peakDivision} onChange={(e) => setPeakDivision(e.target.value)}>
              {[...DIVISIONS].reverse().map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {needsCode && (
        <>
          <label>Código del torneo</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <button disabled={busy}>{busy ? "Verificando…" : "Inscribirme"}</button>
      </div>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    </form>
  );
}
