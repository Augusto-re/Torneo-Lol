import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Torneo LoL",
  description: "Inscripción y armado de equipos parejos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            TORNEO LOL
          </Link>
          <nav>
            <Link href="/">Inscripción</Link>
            <Link href="/equipos">Equipos</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
