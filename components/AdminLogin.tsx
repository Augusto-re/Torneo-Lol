"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) router.refresh();
    else setErr("Contraseña incorrecta");
  }

  return (
    <form onSubmit={submit}>
      <label>Contraseña</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      <div style={{ marginTop: 14 }}>
        <button>Entrar</button>
      </div>
      {err && <div className="msg err">{err}</div>}
    </form>
  );
}
