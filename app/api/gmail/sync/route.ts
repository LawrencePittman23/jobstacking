import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUser } from "@/lib/db";
import { syncForUser } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await getUser(session.user.email);
  if (!user?.refresh_token) {
    return NextResponse.json({ error: "no refresh token; sign out and sign in again" }, { status: 400 });
  }
  try {
    const result = await syncForUser(session.user.email, user.refresh_token);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("sync error", e);
    return NextResponse.json({ error: e?.message ?? "sync failed" }, { status: 500 });
  }
}
