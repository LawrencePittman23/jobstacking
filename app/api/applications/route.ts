import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createApplication, listApplications } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listApplications(session.user.email);
  return NextResponse.json({ applications: rows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.company) return NextResponse.json({ error: "company required" }, { status: 400 });
  const row = await createApplication(session.user.email, body);
  return NextResponse.json({ application: row }, { status: 201 });
}
