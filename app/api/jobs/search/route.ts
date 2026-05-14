import { NextRequest, NextResponse } from "next/server";
import { fetchAllSdrBdrJobs } from "@/lib/jobs";
import { getJobsCache, setJobsCache } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_TTL_MIN = 30;

export async function GET(req: NextRequest) {
  const minSalary = Number(req.nextUrl.searchParams.get("salary") || 0);
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const cacheKey = `sdr_bdr:remote:${minSalary}`;

  // Try cache first unless forced refresh
  if (!force) {
    try {
      const cached = await getJobsCache(cacheKey);
      if (cached && cached.age_minutes < CACHE_TTL_MIN) {
        return NextResponse.json({
          ...cached.payload,
          cached: true,
          age_minutes: Math.round(cached.age_minutes),
        });
      }
    } catch (e) {
      // Cache lookup failed (cold start, schema not ready) — fall through to fresh fetch
      console.error("cache lookup failed", e);
    }
  }

  // Fresh fetch
  try {
    const { jobs, bySource } = await fetchAllSdrBdrJobs(minSalary);
    const payload = { jobs: jobs.slice(0, 1000), total: jobs.length, bySource };

    // Write cache (don't fail the response if cache write errors)
    try {
      await setJobsCache(cacheKey, payload);
    } catch (e) {
      console.error("cache write failed", e);
    }

    return NextResponse.json({ ...payload, cached: false });
  } catch (e: any) {
    // If fresh fetch fails, try returning stale cache as a fallback
    try {
      const cached = await getJobsCache(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached.payload,
          cached: true,
          stale: true,
          age_minutes: Math.round(cached.age_minutes),
        });
      }
    } catch {}
    return NextResponse.json({ error: e?.message || "search failed", jobs: [], total: 0, bySource: {} }, { status: 500 });
  }
}
