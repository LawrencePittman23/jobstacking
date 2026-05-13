import { NextRequest, NextResponse } from "next/server";
import { listAllUsersWithRefreshTokens } from "@/lib/db";
import { syncForUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const users = await listAllUsersWithRefreshTokens();
  const results: Array<{ email: string; ok: boolean; scanned?: number; saved?: number; error?: string }> = [];
  for (const u of users) {
    try {
      const r = await syncForUser(u.email, u.refresh_token!);
      results.push({ email: u.email, ok: true, ...r });
    } catch (e: any) {
      results.push({ email: u.email, ok: false, error: e?.message ?? "unknown" });
    }
  }
  return NextResponse.json({ ok: true, results });
}
