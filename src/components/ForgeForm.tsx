"use client";

import { useState } from "react";
import styles from "./ForgeForm.module.css";
import Certificat, { type CertificatAgent } from "./Certificat";

type ForgeResponse =
  | { agent: CertificatAgent }
  | { error: string };

export default function ForgeForm() {
  const [metier, setMetier] = useState("");
  const [precision, setPrecision] = useState("");
  const [prenom, setPrenom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<CertificatAgent | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metier, precision, prenom }),
      });

      const data = (await res.json()) as ForgeResponse;

      if (!res.ok || "error" in data) {
        setError(
          "error" in data ? data.error : "Une erreur inattendue est survenue."
        );
        setAgent(null);
        return;
      }

      setAgent(data.agent);
    } catch {
      setError("Impossible de contacter le comptoir. Vérifie ta connexion.");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="metier">
            Métier ou discipline
          </label>
          <input
            id="metier"
            className={styles.input}
            value={metier}
            onChange={(e) => setMetier(e.target.value)}
            placeholder="Ex. plombier, avocate, boulanger, développeuse..."
            required
            minLength={2}
            maxLength={80}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="precision">
            Précision libre <span className={styles.optional}>(optionnel)</span>
          </label>
          <textarea
            id="precision"
            className={styles.textarea}
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
            placeholder="Ex. je travaille surtout en rénovation d'appartements anciens à Paris."
            maxLength={400}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="prenom">
            Prénom <span className={styles.optional}>(optionnel)</span>
          </label>
          <input
            id="prenom"
            className={styles.input}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Pour personnaliser le registre"
            maxLength={60}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Forge en cours..." : "Forger mon agent"}
          </button>
          <span className={styles.hint}>5 forges par heure et par adresse.</span>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
      </form>

      {agent ? (
        <div>
          <p className={styles.resultLabel}>Concession délivrée</p>
          <Certificat agent={agent} />
        </div>
      ) : null}
    </>
  );
}
