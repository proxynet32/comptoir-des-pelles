"use client";

import { useState } from "react";
import styles from "./Certificat.module.css";

export default function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.copyButton} onClick={handleCopy}>
      {copied ? "Copié !" : "Copier le prompt"}
    </button>
  );
}
