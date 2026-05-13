import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProfile, upsertProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getProfile(session.user.email);
  return NextResponse.json({
    profile: profile || { email: session.user.email, full_name: null, resume_text: null, background: null },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  await upsertProfile(session.user.email, {
    full_name:   body.full_name ?? null,
    resume_text: body.resume_text ?? null,
    background:  body.background ?? null,
  });
  const profile = await getProfile(session.user.email);
  return NextResponse.json({ profile });
}
