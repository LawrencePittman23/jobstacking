export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  source: string;
  posted: string;
}

const SDR_BDR_RE = /\b(SDR|BDR|sales development|business development\s+(?:representative|rep)|outbound\s+sales|inside\s+sales\s+rep)\b/i;

function matchesSdrBdr(title: string, extra: string = ""): boolean {
  return SDR_BDR_RE.test(title) || SDR_BDR_RE.test(extra);
}

const REMOTE_RE = /\b(remote|anywhere|worldwide|work\s*from\s*home|wfh|fully\s+remote|distributed)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const ONSITE_RE = /\bon[-\s]?site|in[-\s]?office\b/i;

function isRemoteJob(j: Job): boolean {
  if (j.source === "Remotive" || j.source === "RemoteOK") return true;
  const loc = (j.location || "").toLowerCase();
  const title = (j.title || "").toLowerCase();
  if (HYBRID_RE.test(loc) || ONSITE_RE.test(loc)) return false;
  if (REMOTE_RE.test(loc) || REMOTE_RE.test(title)) return true;
  return false;
}

async function timedFetch(url: string, init: RequestInit & { next?: any } = {}, timeoutMs = 4000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isLinkedInEasyApply(j: any): boolean {
  if (Array.isArray(j?.apply_options)) {
    const hasDirect = j.apply_options.some((opt: any) =>
      /linkedin/i.test(opt?.publisher || "") && opt?.is_direct === true
    );
    if (hasDirect) return true;
  }
  const link = j?.job_apply_link || "";
  return /linkedin\.com\/jobs\/view\//i.test(link);
}

// Detect LinkedIn from any field — publisher, apply link, or apply_options.
function isLinkedInJob(j: any): boolean {
  const pub = (j?.job_publisher || "").toLowerCase();
  if (pub.includes("linkedin")) return true;
  const link = (j?.job_apply_link || "").toLowerCase();
  if (link.includes("linkedin.com")) return true;
  if (Array.isArray(j?.apply_options)) {
    if (j.apply_options.some((o: any) => /linkedin/i.test(o?.publisher || "") || /linkedin\.com/i.test(o?.apply_link || ""))) return true;
  }
  return false;
}

function normalizePublisher(raw: string): string {
  if (!raw) return "JSearch";
  const lower = raw.toLowerCase().trim();
  const compact = lower.replace(/\s+/g, "");
  if (lower.includes("linkedin"))      return "LinkedIn";
  if (lower.includes("indeed"))        return "Indeed";
  if (compact.includes("ziprecruiter")) return "ZipRecruiter";
  if (lower.includes("glassdoor"))     return "Glassdoor";
  if (lower.includes("monster"))       return "Monster";
  if (compact.includes("simplyhired")) return "SimplyHired";
  if (compact.includes("builtin"))     return "Built In";
  if (lower.includes("snagajob"))      return "Snagajob";
  if (lower.includes("jooble"))        return "Jooble";
  if (lower.includes("talent.com") || lower === "talent") return "Talent.com";
  if (lower.includes("lensa"))         return "Lensa";
  if (/^https?:\/\//.test(raw) || raw.includes(".")) {
    const host = raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    const name = host.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return raw;
}

function mapJSearchJob(j: any, idPrefix = "jsearch"): Job {
  // Two-step LinkedIn detection: trust publisher first, but if a non-LinkedIn
  // publisher is reported yet the apply_link / apply_options point to LinkedIn,
  // promote it to LinkedIn anyway.
  const fromPublisher = normalizePublisher(j.job_publisher || "");
  const linkedin = fromPublisher === "LinkedIn" || isLinkedInJob(j);
  const easyApply = linkedin && isLinkedInEasyApply(j);
  const source = easyApply ? "LinkedIn Easy Apply" : (linkedin ? "LinkedIn" : fromPublisher);
  const sMin = j.job_min_salary;
  let url = j.job_apply_link || j.job_google_link || "";
  if (easyApply && Array.isArray(j.apply_options)) {
    const liOpt = j.apply_options.find((o: any) => /linkedin/i.test(o?.publisher || ""));
    if (liOpt?.apply_link) url = liOpt.apply_link;
  } else if (linkedin && Array.isArray(j.apply_options)) {
    const liOpt = j.apply_options.find((o: any) => /linkedin/i.test(o?.publisher || "") || /linkedin\.com/i.test(o?.apply_link || ""));
    if (liOpt?.apply_link) url = liOpt.apply_link;
  }
  return {
    id: `${idPrefix}-${j.job_id}`,
    title: j.job_title || "",
    company: j.employer_name || "",
    location: j.job_is_remote ? "Remote" : [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", "),
    salary: sMin ? `$${Math.floor(sMin / 1000)}k${j.job_max_salary ? `-$${Math.floor(j.job_max_salary / 1000)}k` : ""}` : "",
    url,
    source,
    posted: j.job_posted_at_datetime_utc || "",
  };
}

async function fetchRemotive(): Promise<Job[]> {
  try {
    const queries = ["SDR", "BDR", "sales development", "business development representative"];
    const tasks = queries.map((q) =>
      timedFetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`, { next: { revalidate: 1800 } } as any, 4000)
    );
    const responses = await Promise.allSettled(tasks);
    const out: Job[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value || !r.value.ok) continue;
      const data: any = await r.value.json();
      for (const j of data.jobs || []) {
        const tagStr = (j.tags || []).join(" ");
        if (!matchesSdrBdr(j.title || "", tagStr)) continue;
        out.push({
          id: `remotive-${j.id}`,
          title: j.title || "",
          company: j.company_name || "",
          location: j.candidate_required_location || "Remote",
          salary: j.salary || "",
          url: j.url || "",
          source: "Remotive",
          posted: j.publication_date || "",
        });
      }
    }
    return out;
  } catch { return []; }
}

async function fetchRemoteOK(): Promise<Job[]> {
  try {
    const res = await timedFetch("https://remoteok.com/api", {
      headers: { Accept: "application/json", "User-Agent": "JobStacking/1.0 (https://jobstacking.vercel.app)" },
      next: { revalidate: 1800 },
    } as any, 4000);
    if (!res || !res.ok) return [];
    const data: any = await res.json();
    const items = Array.isArray(data) ? data.slice(1) : [];
    return items
      .filter((j: any) => matchesSdrBdr(j.position || "", (j.tags || []).join(" ")))
      .map((j: any) => ({
        id: `remoteok-${j.id}`,
        title: j.position || "",
        company: j.company || "",
        location: j.location || "Remote",
        salary: j.salary_min ? `$${Math.floor(j.salary_min / 1000)}k${j.salary_max && j.salary_max !== j.salary_min ? `-$${Math.floor(j.salary_max / 1000)}k` : ""}` : "",
        url: j.url || (j.id ? `https://remoteok.com/remote-jobs/${j.id}` : ""),
        source: "RemoteOK",
        posted: j.date || "",
      }));
  } catch { return []; }
}

async function fetchAdzuna(minSalary: number): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;
  if (!appId || !apiKey) return [];
  try {
    const queries = ["remote sales development representative", "remote business development representative", "remote SDR", "remote BDR"];
    const pages = [1, 2];
    const tasks: Promise<Response | null>[] = [];
    for (const q of queries) {
      for (const page of pages) {
        const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${apiKey}&what=${encodeURIComponent(q)}&results_per_page=50${minSalary > 0 ? `&salary_min=${minSalary}` : ""}`;
        tasks.push(timedFetch(url, { next: { revalidate: 1800 } } as any, 4000));
      }
    }
    const responses = await Promise.allSettled(tasks);
    const out: Job[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value || !r.value.ok) continue;
      const data: any = await r.value.json();
      const results = data.results || [];
      for (const j of results) {
        if (!matchesSdrBdr(j.title || "")) continue;
        out.push({
          id: `adzuna-${j.id}`,
          title: j.title || "",
          company: j.company?.display_name || "",
          location: j.location?.display_name || "",
          salary: j.salary_min ? `$${Math.floor(j.salary_min / 1000)}k${j.salary_max && j.salary_max !== j.salary_min ? `-$${Math.floor(j.salary_max / 1000)}k` : ""}` : "",
          url: j.redirect_url || "",
          source: "Adzuna",
          posted: j.created || "",
        });
      }
    }
    return out;
  } catch { return []; }
}

// JSearch — parallel fetches, no invalid filter params.
async function fetchJSearch(minSalary: number): Promise<Job[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];
  try {
    const queries = ["Sales Development Representative", "Business Development Representative", "SDR remote", "BDR remote"];
    const pages = [1, 2];
    const tasks: Promise<Response | null>[] = [];
    for (const q of queries) {
      for (const page of pages) {
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=${page}&num_pages=1&date_posted=month&remote_jobs_only=true`;
        tasks.push(timedFetch(url, {
          headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
          next: { revalidate: 1800 },
        } as any, 6000));
      }
    }
    const responses = await Promise.allSettled(tasks);
    const out: Job[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled" || !r.value || !r.value.ok) continue;
      const data: any = await r.value.json();
      const items = data.data || [];
      for (const j of items) {
        if (!matchesSdrBdr(j.job_title || "")) continue;
        const sMin = j.job_min_salary;
        if (minSalary > 0 && sMin && sMin < minSalary) continue;
        out.push(mapJSearchJob(j, "jsearch"));
      }
    }
    return out;
  } catch { return []; }
}

const GREENHOUSE_COMPANIES = [
  "airbnb","stripe","doordash","gusto","instacart","plaid","lyft","twilio","segment","brex","robinhood",
  "asana","retool","datadog","ramp","samsara","gong","gitlab","figma","notion","airtable","cloudflare",
  "mongodb","snowflake","databricks","scale","rippling","deel","mercury","webflow","carta",
  "amplitude","intercom","front","mixpanel","lattice","sentry","posthog","outreach","salesloft",
  "apollo","clari","zendesk","klaviyo","drift","looker","hashicorp","circleci","atlassian",
  "auth0","okta","hubspot","chime","sofi","affirm","toast","squarespace","box","dropbox",
  "smartsheet","miro","loom","qualtrics","new-relic","pagerduty","freshworks","zoominfo",
  "6sense","chilipiper","gemshq","orum","dialpad","aircall","talkdesk","five9","nextiva",
];

const LEVER_COMPANIES = [
  "netflix","github","eventbrite","attentive","mercari","cruise","substack",
  "shopify","square","reddit","twitch","snap","pinterest","yelp","glassdoor",
  "benchling","clever","discord",
];

const ASHBY_COMPANIES = [
  "linear","vercel","supabase","anthropic","neon","posthog","modal","cursor","openai",
  "huggingface","groq","mistral","perplexity","arc","raycast","cohere","deepgram",
  "airplane","replicate","runway","pinecone","langchain","replit",
];

async function fetchAtsCompany(slug: string, source: "Greenhouse" | "Lever" | "Ashby"): Promise<Job[]> {
  const urls: Record<string, string> = {
    Greenhouse: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    Lever:      `https://api.lever.co/v0/postings/${slug}?mode=json`,
    Ashby:      `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  };
  try {
    const res = await timedFetch(urls[source], { next: { revalidate: 1800 } } as any, 3000);
    if (!res || !res.ok) return [];
    const data: any = await res.json();
    if (source === "Greenhouse") {
      return (data.jobs || []).filter((j: any) => matchesSdrBdr(j.title || "")).map((j: any) => ({
        id: `gh-${slug}-${j.id}`,
        title: j.title || "",
        company: capitalize(slug),
        location: j.location?.name || "",
        salary: "",
        url: j.absolute_url || "",
        source: "Greenhouse",
        posted: j.updated_at || "",
      }));
    }
    if (source === "Lever") {
      return (Array.isArray(data) ? data : []).filter((j: any) => matchesSdrBdr(j.text || "")).map((j: any) => ({
        id: `lever-${slug}-${j.id}`,
        title: j.text || "",
        company: capitalize(slug),
        location: j.categories?.location || "",
        salary: "",
        url: j.hostedUrl || "",
        source: "Lever",
        posted: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      }));
    }
    if (source === "Ashby") {
      return (data.jobs || []).filter((j: any) => matchesSdrBdr(j.title || "")).map((j: any) => ({
        id: `ashby-${slug}-${j.id}`,
        title: j.title || "",
        company: capitalize(slug),
        location: j.locationName || "",
        salary: "",
        url: j.jobUrl || j.applyUrl || "",
        source: "Ashby",
        posted: j.publishedAt || "",
      }));
    }
    return [];
  } catch { return []; }
}

function capitalize(s: string) {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function fetchATS(): Promise<Job[]> {
  const tasks: Promise<Job[]>[] = [
    ...GREENHOUSE_COMPANIES.map((c) => fetchAtsCompany(c, "Greenhouse")),
    ...LEVER_COMPANIES.map((c) => fetchAtsCompany(c, "Lever")),
    ...ASHBY_COMPANIES.map((c) => fetchAtsCompany(c, "Ashby")),
  ];
  const results = await Promise.race([
    Promise.allSettled(tasks),
    new Promise<PromiseSettledResult<Job[]>[]>((resolve) =>
      setTimeout(() => resolve(tasks.map(() => ({ status: "rejected", reason: "timeout" } as any))), 7000)
    ),
  ]);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function fetchAllSdrBdrJobs(minSalary: number = 0): Promise<{ jobs: Job[]; bySource: Record<string, number> }> {
  const [remotive, remoteok, adzuna, jsearch, ats] = await Promise.allSettled([
    fetchRemotive(),
    fetchRemoteOK(),
    fetchAdzuna(minSalary),
    fetchJSearch(minSalary),
    fetchATS(),
  ]);

  const all: Job[] = [
    ...(jsearch.status === "fulfilled" ? jsearch.value : []),
    ...(remotive.status === "fulfilled" ? remotive.value : []),
    ...(remoteok.status === "fulfilled" ? remoteok.value : []),
    ...(adzuna.status === "fulfilled" ? adzuna.value : []),
    ...(ats.status === "fulfilled" ? ats.value : []),
  ];

  const remoteOnly = all.filter(isRemoteJob);

  const seen = new Set<string>();
  const deduped: Job[] = [];
  for (const j of remoteOnly) {
    const k = `${j.company.toLowerCase().trim()}|${j.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "")}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(j);
  }

  let filtered = deduped;
  if (minSalary > 0) {
    filtered = deduped.filter((j) => {
      if (!j.salary) return true;
      const m = j.salary.match(/\$?(\d+)k/i);
      if (!m) return true;
      return Number(m[1]) * 1000 >= minSalary;
    });
  }

  filtered.sort((a, b) => (b.posted || "").localeCompare(a.posted || ""));

  const bySource: Record<string, number> = {};
  for (const j of filtered) bySource[j.source] = (bySource[j.source] || 0) + 1;

  return { jobs: filtered, bySource };
}
