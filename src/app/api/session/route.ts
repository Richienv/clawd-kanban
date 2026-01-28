import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { token, owner, repo } = (await req.json().catch(() => ({}))) as {
    token?: string;
    owner?: string;
    repo?: string;
  };

  const jar = await cookies();

  // Keep it simple: httpOnly cookies so mobile webviews keep session across routes.
  // NOTE: token is sensitive; this keeps it off localStorage.
  if (typeof token === "string") {
    jar.set("kb_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }
  if (typeof owner === "string") {
    jar.set("kb_owner", owner, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }
  if (typeof repo === "string") {
    jar.set("kb_repo", repo, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.set("kb_token", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  jar.set("kb_owner", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  jar.set("kb_repo", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
