import styles from "./Certificat.module.css";
import { formatClaimNumber } from "@/lib/claimNumber";
import CopyPromptButton from "./CopyPromptButton";

export type CertificatAgent = {
  claimNumber: number;
  metier: string;
  precision?: string | null;
  prenom?: string | null;
  nomAgent: string;
  role: string;
  pitch: string;
  traits: string[];
  systemPromptXml?: string | null;
  statut: string;
  createdAt: string | Date;
};

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function Certificat({
  agent,
  compact = false,
}: {
  agent: CertificatAgent;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.certificat} ${compact ? styles.compact : ""}`}>
      <span className={`${styles.corner} ${styles.cornerTL}`} />
      <span className={`${styles.corner} ${styles.cornerTR}`} />
      <span className={`${styles.corner} ${styles.cornerBL}`} />
      <span className={`${styles.corner} ${styles.cornerBR}`} />

      <div className={styles.stamp}>Agent forgé · Comptoir des Pelles</div>

      <div className={styles.topRow}>
        <span className={styles.claimLabel}>
          Concession n° {formatClaimNumber(agent.claimNumber)}
        </span>
        <span>{formatDate(agent.createdAt)}</span>
      </div>

      <div className={styles.identity}>
        <h2 className={styles.agentName}>{agent.nomAgent}</h2>
        <p className={styles.role}>{agent.role}</p>
      </div>

      <hr className={styles.divider} />

      <p className={styles.pitch}>&laquo; {agent.pitch} &raquo;</p>

      <ul className={styles.traits}>
        {agent.traits.map((trait) => (
          <li key={trait} className={styles.trait}>
            {trait}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <span>
          Métier : <strong>{agent.metier}</strong>
        </span>
        {agent.prenom ? (
          <span>
            Titulaire : <strong>{agent.prenom}</strong>
          </span>
        ) : null}
        <span
          className={`${styles.statutBadge} ${
            agent.statut === "publie" ? styles.publie : ""
          }`}
        >
          {agent.statut === "publie" ? "Publié" : "Brouillon"}
        </span>
      </div>

      {agent.systemPromptXml ? (
        <details className={styles.promptBlock}>
          <summary className={styles.promptSummary}>
            Voir le prompt système (à coller dans Claude ou ChatGPT)
          </summary>
          <pre className={styles.promptPre}>{agent.systemPromptXml}</pre>
          <CopyPromptButton text={agent.systemPromptXml} />
        </details>
      ) : null}
    </div>
  );
}
