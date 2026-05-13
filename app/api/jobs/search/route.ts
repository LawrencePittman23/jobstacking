import { NextRequest, NextResponse } from "next/server";
import { fetchAllSdrBdrJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const minSalary = Number(req.nextUrl.searchParams.get("salary") || 0);
  try {
    const { jobs, bySource } = await fetchAllSdrBdrJobs(minSalary);
    return NextResponse.json({ jobs: jobs.slice(0, 1000), total: jobs.length, bySource });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "search failed", jobs: [], total: 0, bySource: {} }, { status: 500 });
  }
}
