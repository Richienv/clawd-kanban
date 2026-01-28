"use client";

import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";

type ColumnId = "todo" | "doing" | "done";

type Issue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  labels: { name: string }[];
  // present on PRs; we filter them out
  pull_request?: unknown;
};

const COLUMN_ORDER: ColumnId[] = ["todo", "doing", "done"];

const COLUMN_META: Record<
  ColumnId,
  { title: string; label: string; state?: "open" | "closed" }
> = {
  todo: { title: "Todo", label: "kb:todo", state: "open" },
  doing: { title: "Doing", label: "kb:doing", state: "open" },
  done: { title: "Done", label: "kb:done" },
};

const COLUMN_STYLE: Record<
  ColumnId,
  {
    dot: string;
    header: string;
    cardBorder: string;
    badge: string;
  }
> = {
  todo: {
    dot: "bg-zinc-400",
    header: "bg-zinc-900/60",
    cardBorder: "border-l-zinc-400",
    badge: "bg-zinc-800 text-zinc-200",
  },
  doing: {
    dot: "bg-blue-400",
    header: "bg-blue-950/25",
    cardBorder: "border-l-blue-400",
    badge: "bg-blue-950/50 text-blue-200",
  },
  done: {
    dot: "bg-emerald-400",
    header: "bg-emerald-950/25",
    cardBorder: "border-l-emerald-400",
    badge: "bg-emerald-950/50 text-emerald-200",
  },
};

function getStored(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function setStored(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function hasLabel(issue: Issue, label: string) {
  return issue.labels?.some((l) => l.name === label) ?? false;
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

function Card({ issue, col }: { issue: Issue; col: ColumnId }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `issue:${issue.number}`,
    data: { from: col, issueNumber: issue.number },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-zinc-800 bg-zinc-950 p-3 active:cursor-grabbing border-l-4 ${COLUMN_STYLE[col].cardBorder}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-5">{issue.title}</div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${COLUMN_STYLE[col].badge}`}
          title={COLUMN_META[col].label}
        >
          {COLUMN_META[col].title}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
        <a
          href={issue.html_url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-zinc-200"
        >
          #{issue.number}
        </a>
        <span className={issue.state === "closed" ? "text-emerald-300" : ""}>
          {issue.state}
        </span>
      </div>
    </div>
  );
}

function Column({
  col,
  issues,
}: {
  col: ColumnId;
  issues: Issue[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-zinc-800 bg-zinc-900/40 ${
        isOver ? "ring-2 ring-zinc-400/40" : ""
      }`}
    >
      <div className={`flex items-center justify-between border-b border-zinc-800 px-4 py-3 ${COLUMN_STYLE[col].header}`}>
        <div className="flex items-center gap-2 font-medium">
          <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_STYLE[col].dot}`} />
          {COLUMN_META[col].title}
        </div>
        <div className="text-xs text-zinc-400">{issues.length}</div>
      </div>

      <div className="p-3">
        <div className="flex flex-col gap-2">
          {issues.map((i) => (
            <Card key={i.id} issue={i} col={col} />
          ))}
          {issues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
              Drop an issue here
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    setToken(getStored("kb:token"));
    setOwner(getStored("kb:owner", "Richienv"));
    setRepo(getStored("kb:repo", "clawd-kanban"));
    setName(getStored("kb:name", "richie"));
  }, []);

  const columns = useMemo(() => {
    const byColumn: Record<ColumnId, Issue[]> = {
      todo: [],
      doing: [],
      done: [],
    };

    for (const issue of issues) {
      if (hasLabel(issue, COLUMN_META.todo.label)) byColumn.todo.push(issue);
      else if (hasLabel(issue, COLUMN_META.doing.label)) byColumn.doing.push(issue);
      else if (hasLabel(issue, COLUMN_META.done.label) || issue.state === "closed")
        byColumn.done.push(issue);
      else byColumn.todo.push(issue); // default
    }

    // stable-ish ordering
    for (const col of COLUMN_ORDER) {
      byColumn[col].sort((a, b) => b.number - a.number);
    }

    return byColumn;
  }, [issues]);

  async function loadIssues() {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`;
      const data = await ghFetch<Issue[]>(url, token);
      setIssues(data.filter((x) => !x.pull_request));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && owner && repo) loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, owner, repo]);

  async function ensureLabelsExist() {
    const wanted = [
      { name: COLUMN_META.todo.label, color: "6e7681" },
      { name: COLUMN_META.doing.label, color: "1f6feb" },
      { name: COLUMN_META.done.label, color: "2da44e" },
    ];

    for (const w of wanted) {
      try {
        await ghFetch(
          `https://api.github.com/repos/${owner}/${repo}/labels`,
          token,
          {
            method: "POST",
            body: JSON.stringify({ name: w.name, color: w.color }),
          }
        );
      } catch {
        // ignore (already exists or insufficient perms)
      }
    }
  }

  async function moveIssue(issueNumber: number, to: ColumnId) {
    const issue = issues.find((x) => x.number === issueNumber);
    if (!issue) return;

    const targetLabel = COLUMN_META[to].label;
    const otherLabels = Object.values(COLUMN_META)
      .map((m) => m.label)
      .filter((l) => l !== targetLabel);

    const existing = issue.labels
      .map((l) => l.name)
      .filter((n) => !otherLabels.includes(n));
    const next = Array.from(new Set([...existing, targetLabel]));

    await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/labels`,
      token,
      {
        method: "PUT",
        body: JSON.stringify(next),
      }
    );

    // optimistic update
    setIssues((prev) =>
      prev.map((x) =>
        x.number === issue.number
          ? { ...x, labels: next.map((name) => ({ name })) }
          : x
      )
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith("col:")) return;

    const to = overId.replace("col:", "") as ColumnId;
    const issueNumber = (active.data.current as any)?.issueNumber as number | undefined;
    if (!issueNumber) return;

    void moveIssue(issueNumber, to).catch((err) => setError(err?.message ?? String(err)));
  }

  const ready = token && owner && repo;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xl font-semibold">Clawd Kanban</div>
            <div className="text-sm text-zinc-400">
              {name ? (
                <>
                  Welcome, <span className="text-zinc-200">{name}</span>. Track what I’m working on.
                </>
              ) : (
                <>Track what I’m working on.</>
              )}
            </div>
            <div className="text-sm text-zinc-500">
              GitHub Issues → Kanban (labels: <code>kb:todo</code>, <code>kb:doing</code>, <code>kb:done</code>)
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
              onClick={() => void ensureLabelsExist()}
              disabled={!ready}
            >
              Ensure labels
            </button>
            <button
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
              onClick={() => void loadIssues()}
              disabled={!ready || loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-200 hover:bg-red-950/60 disabled:opacity-50"
              onClick={() => {
                setStored("kb:token", "");
                setToken("");
                setError(null);
                setIssues([]);
              }}
              disabled={!token}
              title="Clears the saved token from this browser"
            >
              Log out
            </button>
          </div>
        </div>

        {!ready ? (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 text-sm text-zinc-300">
              Paste a GitHub token (fine-grained PAT with access to the repo) — stored locally in your browser.
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Your name</div>
                <input
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setStored("kb:name", e.target.value);
                  }}
                  placeholder="richie"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Owner</div>
                <input
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    setStored("kb:owner", e.target.value);
                  }}
                  placeholder="Richienv"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Repo</div>
                <input
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  value={repo}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    setStored("kb:repo", e.target.value);
                  }}
                  placeholder="clawd-kanban"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-zinc-400">Token</div>
                <input
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setStored("kb:token", e.target.value);
                  }}
                  placeholder="github_pat_..."
                  type="password"
                />
              </label>
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              Tip: create a token with <b>Issues: Read & Write</b> on that repo.
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {ready ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DndContext onDragEnd={onDragEnd}>
              {COLUMN_ORDER.map((col) => (
                <Column key={col} col={col} issues={columns[col]} />
              ))}
            </DndContext>
          </div>
        ) : null}

        <div className="mt-8 text-xs text-zinc-500">
          Add issues in the target repo, then drag cards between columns to update labels.
        </div>
      </div>
    </div>
  );
}
