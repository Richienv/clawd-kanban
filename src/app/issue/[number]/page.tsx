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

function getStored(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

async function ghFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
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

  useEffect(() => {
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
    void load();
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
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

            <div className="mt-3 flex flex-wrap gap-2">
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
