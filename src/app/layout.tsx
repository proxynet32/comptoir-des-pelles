import type { Metadata } from "next";
import { Fraunces, Space_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Le Comptoir des Pelles",
  description:
    "Déclarez votre métier, recevez la concession de votre agent IA sur-mesure.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body>
        <div className="site-shell">
          <header className="site-header">
            <span className="kicker">Bureau des concessions numériques</span>
            <h1>Le Comptoir des Pelles</h1>
            <p>
              Déclarez votre métier. Recevez la concession de l&apos;agent IA
              taillé pour vous.
            </p>
            <nav className="site-nav">
              <Link href="/">Forger un agent</Link>
              <Link href="/registre">Registre des concessions</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
