"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { balanceTeams, BalanceResult } from "@/lib/balance";
import { rankLabel } from "@/lib/scoring";
import { computeStars } from "@/lib/stars";
import Stars from "./Stars";
import {
  APEX_TIERS,
  DIVISIONS,
  DraftData,
  RatedPlayer,
  ROLES,
  ROLE_LABEL,
  TIERS,
  TIER_LABEL,
  Tier,
} from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (x: number, d = 1) => x.toFixed(d);
const riotName = (p: RatedPlayer) => `${p.player.game_name}#${p.player.tag_line}`;
const logLink = (p: RatedPlayer) =>
  `https://www.leagueofgraphs.com/summoner/las/${encodeURIComponent(p.player.game_name)}-${encodeURIComponent(p.player.tag_line)}`;

function currentRank(p: RatedPlayer): string {
  const pl = p.player;
  if (pl.solo_tier) return rankLabel(pl.solo_tier, pl.solo_division, pl.solo_lp);
  if (pl.flex_tier) return `${rankLabel(pl.flex_tier, pl.flex_division, pl.flex_lp)} (flex)`;
  return "Sin rango";
}

export default function AdminPanel() {
  const [players, setPlayers] = useState<RatedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ res: BalanceResult; pool: RatedPlayer[]; bench: RatedPlayer[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [tournamentName, setTournamentName] = useState(
    () => `Torneo ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`,
  );

  const addLog = (s: string) => setLog((l) => [...l.slice(-200), s]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(j.error ?? "Error cargando datos");
    setError("");
    setPlayers(j.players);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, body: unknown) {
    for (;;) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const wait = Number(j.retryAfter ?? 10) + 1;
        addLog(`  ⏳ Límite de Riot: espero ${wait}s…`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
      return j;
    }
  }

  async function syncOne(p: RatedPlayer) {
    addLog(`→ ${riotName(p)}`);
    const prof = await call(`/api/players/${p.player.id}/sync`, { action: "profile" });
    let pending: string[] = prof.pending ?? [];
    const total = pending.length;
    if (!total) addLog("  sin partidas nuevas");
    while (pending.length) {
      const chunk = pending.slice(0, 5);
      await call(`/api/players/${p.player.id}/sync`, { action: "matches", matchIds: chunk });
      pending = pending.slice(5);
      addLog(`  partidas ${total - pending.length}/${total}`);
    }
  }

  async function syncAll(list: RatedPlayer[]) {
    setSyncing(true);
    for (const p of list) {
      try {
        await syncOne(p);
      } catch (e) {
        addLog(`  ✗ ${(e as Error).message}`);
      }
    }
    addLog("✓ Sincronización terminada");
    setSyncing(false);
    await load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function remove(p: RatedPlayer) {
    if (!confirm(`¿Borrar a ${riotName(p)}?`)) return;
    await fetch(`/api/players/${p.player.id}`, { method: "DELETE" });
    await load();
  }

  const active = useMemo(() => players.filter((p) => p.player.active), [players]);
  const stars = useMemo(() => computeStars(players), [players]);

  async function setAll(value: boolean) {
    await fetch("/api/players", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: value }),
    });
    setResult(null);
    await load();
  }
  const teamCount = Math.floor(active.length / 5);
  const extra = active.length % 5;

  function generate() {
    setNotice("");
    // Si sobran jugadores, quedan de suplentes los últimos inscriptos.
    const byDate = [...active].sort((a, b) => a.player.created_at.localeCompare(b.player.created_at));
    const pool = byDate.slice(0, teamCount * 5);
    const bench = byDate.slice(teamCount * 5);
    const res = balanceTeams(
      pool.map((p) => ({ id: p.player.id, ratingByRole: p.ratingByRole, fitByRole: p.fitByRole })),
    );
    setResult({ res, pool, bench });
  }

  async function publish() {
    if (!result) return;
    const { res, pool, bench } = result;
    const data: DraftData = {
      name: tournamentName.trim() || "Torneo",
      teams: res.teams.map((team, t) => ({
        name: `Equipo ${t + 1}`,
        total: res.totals[t],
        players: team.map((pi, r) => {
          const p = pool[pi];
          const role = ROLES[r];
          return {
            playerId: p.player.id,
            name: riotName(p),
            role,
            fit: p.fitByRole[role],
            rating: p.ratingByRole[role],
            rankLabel: currentRank(p),
            stars: stars[p.player.id],
          };
        }),
      })),
      bench: bench.map((p) => ({ playerId: p.player.id, name: riotName(p) })),
    };
    const r = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    setNotice(r.ok ? "Publicado. Ya se ve en /equipos." : "No se pudo publicar.");
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    location.reload();
  }

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Panel del torneo</h1>
        <button className="secondary tiny" onClick={logout}>
          Salir
        </button>
      </div>

      <h2>Jugadores ({players.length})</h2>
      <div className="toolbar">
        <button disabled={syncing || !players.length} onClick={() => syncAll(players)}>
          {syncing ? "Sincronizando…" : "Sincronizar todos con Riot"}
        </button>
        <button className="secondary" disabled={syncing} onClick={load}>
          Recargar
        </button>
        <span className="muted small">
          La primera vez tarda unos minutos (límite de Riot: 100 pedidos cada 2 min). Después solo baja partidas nuevas.
        </span>
      </div>
      {log.length > 0 && <div className="log">{log.join("\n")}</div>}
      {error && <div className="msg err">{error}</div>}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Juega</th>
              <th>Jugador</th>
              <th>Principal</th>
              <th>Alternativa</th>
              <th>Rango actual</th>
              <th>Pico</th>
              <th className="num">Partidas</th>
              <th className="num">WR</th>
              <th className="num">KDA</th>
              <th className="num">KP</th>
              <th className="num">CS/min</th>
              <th className="num">Daño/min</th>
              <th className="num">Oro/min</th>
              <th className="num">Visión/min</th>
              <th>Campeones</th>
              <th className="num">Rend.</th>
              <th className="num">Ajuste</th>
              <th className="num">Rating</th>
              <th>Nivel</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && !players.length ? (
              <tr>
                <td colSpan={20} className="muted">
                  Cargando…
                </td>
              </tr>
            ) : (
              players.map((p) => {
                const pl = p.player;
                const s = p.stats;
                return (
                  <tr key={pl.id} className={pl.active ? "" : "inactive"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={pl.active}
                        onChange={(e) => {
                          setResult(null);
                          patch(pl.id, { active: e.target.checked });
                        }}
                      />
                    </td>
                    <td>
                      <a href={logLink(p)} target="_blank" rel="noreferrer">
                        {riotName(p)}
                      </a>
                      {pl.sync_error && <div className="small" style={{ color: "var(--red)" }}>{pl.sync_error}</div>}
                      {!pl.last_synced_at && !pl.sync_error && <div className="small muted">sin sincronizar</div>}
                    </td>
                    <td>
                      <select value={pl.main_role} onChange={(e) => patch(pl.id, { main_role: e.target.value })}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={pl.alt_role} onChange={(e) => patch(pl.id, { alt_role: e.target.value })}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {currentRank(p)}{" "}
                      {p.rankSource !== "solo" && <span className="badge src">usa {p.rankSource === "default" ? "default" : p.rankSource}</span>}
                    </td>
                    <td>
                      <select
                        value={pl.peak_tier ?? ""}
                        onChange={(e) => patch(pl.id, { peak_tier: e.target.value || null, peak_division: pl.peak_division })}
                      >
                        <option value="">—</option>
                        {TIERS.map((t) => (
                          <option key={t} value={t}>
                            {TIER_LABEL[t]}
                          </option>
                        ))}
                      </select>{" "}
                      {pl.peak_tier && !APEX_TIERS.includes(pl.peak_tier as Tier) && (
                        <select
                          value={pl.peak_division ?? "IV"}
                          onChange={(e) => patch(pl.id, { peak_tier: pl.peak_tier, peak_division: e.target.value })}
                        >
                          {DIVISIONS.map((d) => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="num">{s?.games ?? 0}</td>
                    <td className="num">{s ? `${Math.round(s.winrate * 100)}%` : "—"}</td>
                    <td className="num">{s ? fmt(s.kda, 2) : "—"}</td>
                    <td className="num">{s ? `${Math.round(s.kp * 100)}%` : "—"}</td>
                    <td className="num">{s ? fmt(s.csm) : "—"}</td>
                    <td className="num">{s ? Math.round(s.dpm) : "—"}</td>
                    <td className="num">{s ? Math.round(s.gpm) : "—"}</td>
                    <td className="num">{s ? fmt(s.vspm, 2) : "—"}</td>
                    <td className="small">{s?.topChampions.join(", ") ?? "—"}</td>
                    <td className="num" title="Rendimiento vs el resto del grupo en la misma línea (desvíos estándar)">
                      {s ? (p.perf >= 0 ? "+" : "") + fmt(p.perf, 2) : "—"}
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        step={50}
                        defaultValue={pl.manual_adjust}
                        title="Puntos extra a mano (100 = 1 división)"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== pl.manual_adjust) patch(pl.id, { manual_adjust: v });
                        }}
                      />
                    </td>
                    <td className="num">
                      <b>{p.rating}</b>
                    </td>
                    <td>
                      <Stars value={stars[pl.id]} />
                    </td>
                    <td>
                      <button className="secondary tiny" disabled={syncing} onClick={() => syncAll([p])}>
                        Sync
                      </button>{" "}
                      <button className="danger tiny" onClick={() => remove(p)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Rating = rango (100 pts por división, 400 por tier; Master+ desde 2800) + rendimiento en sus últimas partidas
        rankeadas comparado con el resto del grupo en la misma línea + ajuste manual. Jugar la alternativa resta 75 y
        una línea no elegida resta 250. Los pesos están en <code>lib/config.ts</code>.
      </p>

      <h2>Armado de equipos</h2>
      <div className="toolbar">
        <span>
          Juegan este torneo: <b>{active.length}</b> de {players.length}
          {teamCount > 0 && (
            <span className="muted">
              {" "}
              → {teamCount} equipo{teamCount > 1 ? "s" : ""}
              {extra > 0 ? ` + ${extra} suplente${extra > 1 ? "s" : ""}` : ""}
            </span>
          )}
        </span>
        <button className="secondary tiny" onClick={() => setAll(true)}>
          Todos
        </button>
        <button className="secondary tiny" onClick={() => setAll(false)}>
          Ninguno
        </button>
        <span className="muted small">Marcá en la columna &quot;Juega&quot; quiénes participan esta vez.</span>
      </div>
      {teamCount === 0 ? (
        <p className="muted">Hacen falta al menos 5 jugadores activos.</p>
      ) : (
        <>
          <div className="toolbar">
            <button onClick={generate}>{result ? "Regenerar" : `Armar ${teamCount} equipo${teamCount > 1 ? "s" : ""}`}</button>
            {result && (
              <>
                <input
                  style={{ width: 200 }}
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Nombre del torneo"
                />
                <button className="secondary" onClick={publish}>
                  Publicar
                </button>
              </>
            )}
            {extra > 0 && (
              <span className="muted small">
                Hay {active.length} activos: sobran {extra}, que quedan de suplentes (los últimos inscriptos). Desmarcá
                &quot;Activo&quot; para elegir vos quién queda afuera.
              </span>
            )}
          </div>
          {notice && <div className="msg ok">{notice}</div>}
          {result && <Teams result={result} stars={stars} />}
        </>
      )}
    </>
  );
}

function Teams({
  result,
  stars,
}: {
  result: { res: BalanceResult; pool: RatedPlayer[]; bench: RatedPlayer[] };
  stars: Record<string, number>;
}) {
  const { res, pool, bench } = result;
  return (
    <>
      <div className="summary">
        <span>
          Diferencia máx. entre equipos: <b>{Math.round(res.maxDiff)}</b> pts
        </span>
        <span>
          En línea alternativa: <b>{res.alts}</b>
        </span>
        <span>
          Fuera de sus líneas: <b>{res.fills}</b>
        </span>
      </div>
      <div className="teams">
        {res.teams.map((team, t) => (
          <div className="team" key={t}>
            <h3>
              <span>Equipo {t + 1}</span>
              <span className="muted">{res.totals[t]}</span>
            </h3>
            <ul>
              {team.map((pi, r) => {
                const p = pool[pi];
                const role = ROLES[r];
                const fit = p.fitByRole[role];
                return (
                  <li key={p.player.id}>
                    <span className="role">{ROLE_LABEL[role]}</span>
                    <span className="pname" title={currentRank(p)}>
                      {riotName(p)}{" "}
                      <span className={`badge ${fit}`}>{fit === "main" ? "main" : fit === "alt" ? "alt" : "fill"}</span>
                    </span>
                    <span className="muted small" title={`Rating en esta línea: ${p.ratingByRole[role]}`}>
                      <Stars value={stars[p.player.id]} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {bench.length > 0 && <p className="muted">Suplentes: {bench.map(riotName).join(", ")}</p>}
    </>
  );
}
