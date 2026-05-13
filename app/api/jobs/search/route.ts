import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  source: string;
  posted: string;
}

async function fetchRemotive(role: string): Promise<Job[]> {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(role)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.jobs || []).map((j: any) => ({
      id: `remotive-${j.id}`,
      title: j.title || "",
      company: j.company_name || "",
      location: j.candidate_required_location || "Remote",
      salary: j.salary || "",
      url: j.url || "",
      source: "Remotive",
      posted: j.publication_date || "",
    }));
  } catch (e) {
    console.error("remotive error", e);
    return [];
  }
}

async function fetchRemoteOK(role: string): Promise<Job[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { Accept: "application/json", "User-Agent": "JobStacking/1.0 (https://jobstacking.vercel.app)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const items = Array.isArray(data) ? data.slice(1) : [];
    const re = new RegExp(role.split(/\s+/).join(".*"), "i");
    return items
      .filter((j: any) => re.test(j.position || "") || (j.tags || []).some((t: string) => re.test(t)))
      .map((j: any) => ({
        id: `remoteok-${j.id}`,
        title: j.position || "",
        company: j.company || "",
        location: j.location || "Remote",
        salary: j.salary_min
          ? `$${Math.floor(j.salary_min / 1000)}k${j.salary_max && j.salary_max !== j.salary_min ? `-$${Math.floor(j.salary_max / 1000)}k` : ""}`
          : "",
        url: j.url || (j.id ? `https://remoteok.com/remote-jobs/${j.id}` : ""),
        source: "RemoteOK",
        posted: j.date || "",
      }));
  } catch (e) {
    console.error("remoteok error", e);
    return [];
  }
}

function parseSalaryNumeric(s: string): number {
  if (!s) return 0;
  const m = s.match(/\$?(\d{2,3})k/i);
  if (m) return Number(m[1]) * 1000;
  const n = s.match(/\$?([\d,]+)/);
  if (n) return Number(n[1].replace(/,/g, ""));
  return 0;
}

export async function GET(req: NextRequest) {
  const role = (req.nextUrl.searchParams.get("role") || "SDR").trim();
  const minSalary = Number(req.nextUrl.searchParams.get("salary") || 0);

  const [a, b] = await Promise.all([fetchRemotive(role), fetchRemoteOK(role)]);
  let jobs = [...a, ...b];

  if (minSalary > 0) {
    jobs = jobs.filter((j) => {
      const s = parseSalaryNumeric(j.salary);
      return s === 0 || s >= minSalary; // keep unknown salaries
    });
  }

  // de-dup by company+title
  const seen = new Set<string>();
  jobs = jobs.filter((j) => {
    const k = `${j.company.toLowerCase()}|${j.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  jobs.sort((x, y) => (y.posted || "").localeCompare(x.posted || ""));
  return NextResponse.json({ jobs: jobs.slice(0, 60), total: jobs.length });
}
