"use client";

import { useState } from "react";

export function PublicRepoActions({
  aiPrompt,
  canonicalUrl,
}: {
  aiPrompt: string;
  canonicalUrl: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied-ai" | "copied-link" | "error">("idle");

  async function copyToClipboard(value: string, nextStatus: "copied-ai" | "copied-link") {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(nextStatus);
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  return (
    <div className="public-actions">
      <button onClick={() => copyToClipboard(aiPrompt, "copied-ai")} type="button">
        Copy for AI
      </button>
      <button className="secondary" onClick={() => copyToClipboard(canonicalUrl, "copied-link")} type="button">
        Copy link
      </button>
      <span aria-live="polite" className="public-copy-status">
        {status === "copied-ai"
          ? "Copied for AI"
          : status === "copied-link"
            ? "Link copied"
            : status === "error"
              ? "Copy failed"
              : ""}
      </span>
    </div>
  );
}
