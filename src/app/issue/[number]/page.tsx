import Link from "next/link";
import { cookies } from "next/headers";
import IssueStatusButtons from "./IssueStatusButtons";

type IssueDetail = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  body: string | null;
  labels: { name: string }[];
  user?: { login: string };
};

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

export default async function IssuePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const issueNumber = Number(number);

  const jar = await cookies();
  const token = jar.get("kb_token")?.value;
  const owner = jar.get("kb_owner")?.value || "Richienv";
  const repo = jar.get("kb_repo")?.value || "clawd-kanban";

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/" className="text-sm text-zinc-300 hover:text-zinc-100">
              ← Back
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            Session missing (no token cookie). Go back, paste your token, and refresh.
          </div>
        </div>
      </div>
    );
  }

  let issue: IssueDetail;
  try {
    issue = await ghFetch<IssueDetail>(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      token
    );
  } catch (e: any) {
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
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
            {e?.message ?? String(e)}
          </div>
        </div>
      </div>
    );
  }

  const labelNames = (issue.labels ?? []).map((l) => l.name);

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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold leading-6">{issue.title}</div>
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

          <IssueStatusButtons issueNumber={issue.number} currentLabels={labelNames} />

          <div className="mt-4 flex flex-wrap gap-2">
            {labelNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
              >
                {name}
              </span>
            ))}
          </div>

          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
            {issue.body?.trim() ? issue.body : "(No description)"}
          </div>
        </div>
      </div>
    </div>
  );
}
