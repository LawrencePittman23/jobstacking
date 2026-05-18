import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteTimeSession, updateTimeSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json();
  const row = await updateTimeSession(session.user.email, id, body);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ session: row });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  await deleteTimeSession(session.user.email, id);
  return NextResponse.json({ ok: true });
}
