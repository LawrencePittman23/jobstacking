import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listTimeSessions,
  startTimeSession,
  endActiveTimeSessions,
  createManualTimeSession,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessions = await listTimeSessions(session.user.email);
  const active = sessions.find((s) => !s.ended_at) ?? null;
  return NextResponse.json({ sessions, active });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));

  // Clock out: close any currently-active sessions for this user.
  if (body?.action === "out") {
    const closed = await endActiveTimeSessions(session.user.email);
    return NextResponse.json({ active: null, closed });
  }

  // Manual entry: explicit start + end timestamps.
  if (body?.action === "manual") {
    if (!body.started_at || !body.ended_at) {
      return NextResponse.json({ error: "started_at and ended_at required" }, { status: 400 });
    }
    const row = await createManualTimeSession(session.user.email, body.started_at, body.ended_at, body.notes ?? null);
    return NextResponse.json({ session: row }, { status: 201 });
  }

  // Default: clock in.
  const row = await startTimeSession(session.user.email, body?.notes ?? null);
  return NextResponse.json({ active: row }, { status: 201 });
}
