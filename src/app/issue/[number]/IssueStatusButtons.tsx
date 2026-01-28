"use client";

import { useState } from "react";

type ColumnId = "todo" | "doing" | "done";

const COLUMN_META: Record<ColumnId, { title: string; label: string }> = {
  todo: { title: "Todo", label: "kb:todo" },
  doing: { title: "Doing", label: "kb:doing" },
  done: { title: "Done", label: "kb:done" },
};

export default function IssueStatusButtons({
  issueNumber,
  currentLabels,
  onUpdated,
}: {
  issueNumber: number;
  currentLabels: string[];
  onUpdated?: () => void;
}) {
  const [saving, setSaving] = useState<ColumnId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(to: ColumnId) {
    setSaving(to);
    setError(null);
    try {
      const other = (Object.keys(COLUMN_META) as ColumnId[])
        .map((k) => COLUMN_META[k].label)
        .filter((l) => l !== COLUMN_META[to].label);

      const existing = currentLabels.filter((n) => !other.includes(n));
      const next = Array.from(new Set([...existing, COLUMN_META[to].label]));

      const res = await fetch(`/api/issue/${issueNumber}/labels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: next }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
      }

      onUpdated?.();
      // simplest: hard reload to re-render server data
      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-medium text-zinc-400">Status</div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(COLUMN_META) as ColumnId[]).map((c) => {
          const active = currentLabels.includes(COLUMN_META[c].label);
          return (
            <button
              key={c}
              className={`rounded-xl border px-3 py-3 text-sm font-medium active:scale-[0.99] ${
                active
                  ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300"
              }`}
              onClick={() => void setStatus(c)}
              disabled={saving !== null}
            >
              {saving === c ? "Saving…" : COLUMN_META[c].title}
            </button>
          );
        })}
      </div>
      {error ? (
        <div className="mt-2 rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      <div className="mt-2 text-xs text-zinc-500">Tip: tap a status to move this card.</div>
    </div>
  );
}
