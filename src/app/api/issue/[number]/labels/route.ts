import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COLUMN_LABELS = new Set(["kb:todo", "kb:doing", "kb:done"]);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const body = (await req.json().catch(() => ({}))) as { labels?: string[] };

  const jar = await cookies();
  const token = jar.get("kb_token")?.value;
  const owner = jar.get("kb_owner")?.value;
  const repo = jar.get("kb_repo")?.value;

  if (!token || !owner || !repo) {
    return NextResponse.json(
      { ok: false, error: "missing_session" },
      { status: 401 }
    );
  }

  const next = Array.isArray(body.labels) ? body.labels : [];

  // Sanitize: keep only strings
  const labels = next.filter((x) => typeof x === "string");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${number}/labels`,
    {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `token ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(labels),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        body: text,
      },
      { status: res.status }
    );
  }

  return NextResponse.json({ ok: true, labels });
}
