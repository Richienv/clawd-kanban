"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IssueDetail = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  body: string | null;
  labels: { name: string }[];
  user?: { login: string };
  created_at?: string;
  updated_at?: string;
};

type ColumnId = "todo" | "doing" | "done";

const COLUMN_META: Record<ColumnId, { title: string; label: string }> = {
  todo: { title: "Todo", label: "kb:todo" },
  doing: { title: "Doing", label: "kb:doing" },
  done: { title: "Done", label: "kb:done" },
};

function getStored(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

async function ghFetch<T>(
  url: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

export default function IssuePage({ params }: { params: { number: string } }) {
  const number = Number(params.number);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // prefer in-memory context from the board page (works better on some mobile webviews)
    const mem = typeof window !== "undefined" ? (window as any).__CLAWD_KANBAN__ : null;
    const o = mem?.owner || getStored("kb:owner", "Richienv");
    const r = mem?.repo || getStored("kb:repo", "clawd-kanban");
    const t = mem?.token || getStored("kb:token");

    setOwner(o);
    setRepo(r);
    setToken(t);
  }, []);

  async function load() {
    if (!token || !owner || !repo || !number) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ghFetch<IssueDetail>(
        `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
        token
      );
      setIssue(data);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, owner, repo, number]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-300 hover:text-zinc-100">
            ← Back
          </Link>
          <div className="text-xs text-zinc-500">
            {owner}/{repo}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            Loading…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!mounted ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            Loading…
          </div>
        ) : null}

        {mounted && !token ? (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            No token found in this browser session. Go back and paste your token.
          </div>
        ) : null}

        {issue ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold leading-6">
                  {issue.title}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  #{issue.number} • {issue.state}
                  {issue.user?.login ? ` • opened by ${issue.user.login}` : ""}
                </div>
              </div>
              <a
                href={issue.html_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
              >
                Open on GitHub
              </a>
            </div>

            {/* status buttons (replaces drag) */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-zinc-400">Status</div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(COLUMN_META) as ColumnId[]).map((c) => {
                  const active = issue.labels?.some((l) => l.name === COLUMN_META[c].label);
                  return (
                    <button
                      key={c}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium active:scale-[0.99] ${
                        active
                          ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-300"
                      }`}
                      onClick={async () => {
                        if (!token) return;
                        try {
                          setError(null);
                          const other = (Object.keys(COLUMN_META) as ColumnId[])
                            .map((k) => COLUMN_META[k].label)
                            .filter((l) => l !== COLUMN_META[c].label);
                          const existing = (issue.labels ?? [])
                            .map((l) => l.name)
                            .filter((n) => !other.includes(n));
                          const next = Array.from(new Set([...existing, COLUMN_META[c].label]));

                          await ghFetch(
                            `https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels`,
                            token,
                            {
                              method: "PUT",
                              body: JSON.stringify(next),
                            }
                          );
                          await load();
                        } catch (e: any) {
                          setError(e?.message ?? String(e));
                        }
                      }}
                    >
                      {COLUMN_META[c].title}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Tip: tap a status to move this card.
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {issue.labels?.map((l) => (
                <span
                  key={l.name}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
                >
                  {l.name}
                </span>
              ))}
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
              {issue.body?.trim() ? issue.body : "(No description)"}
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
