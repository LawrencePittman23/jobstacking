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

async function fetchRemotive(): Promise<Job[]> {
  try {
    const queries = ["SDR", "BDR", "sales development", "business development representative"];
    const all: Job[] = [];
    for (const q of queries) {
      const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`, { next: { revalidate: 1800 } });
      if (!res.ok) continue;
      const data: any = await res.json();
      for (const j of data.jobs || []) {
        const tagStr = (j.tags || []).join(" ");
        if (!matchesSdrBdr(j.title || "", tagStr)) continue;
        all.push({
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
    return all;
  } catch { return []; }
}

async function fetchRemoteOK(): Promise<Job[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { Accept: "application/json", "User-Agent": "JobStacking/1.0 (https://jobstacking.vercel.app)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
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
    const queries = ["sales development representative", "business development representative", "SDR", "BDR"];
    const all: Job[] = [];
    for (const q of queries) {
      for (let page = 1; page <= 5; page++) {
        const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${apiKey}&what=${encodeURIComponent(q)}&results_per_page=50${minSalary > 0 ? `&salary_min=${minSalary}` : ""}`;
        const res = await fetch(url, { next: { revalidate: 1800 } });
        if (!res.ok) break;
        const data: any = await res.json();
        const results = data.results || [];
        if (results.length === 0) break;
        for (const j of results) {
          if (!matchesSdrBdr(j.title || "")) continue;
          all.push({
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
        if (results.length < 50) break;
      }
    }
    return all;
  } catch { return []; }
}

async function fetchJSearch(minSalary: number): Promise<Job[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];
  try {
    const queries = ["Sales Development Representative", "Business Development Representative", "SDR remote", "BDR remote"];
    const all: Job[] = [];
    for (const q of queries) {
      for (let page = 1; page <= 3; page++) {
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=${page}&num_pages=1&date_posted=month`;
        const res = await fetch(url, {
          headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
          next: { revalidate: 1800 },
        });
        if (!res.ok) break;
        const data: any = await res.json();
        const items = data.data || [];
        if (items.length === 0) break;
        for (const j of items) {
          if (!matchesSdrBdr(j.job_title || "")) continue;
          const sMin = j.job_min_salary;
          if (minSalary > 0 && sMin && sMin < minSalary) continue;
          all.push({
            id: `jsearch-${j.job_id}`,
            title: j.job_title || "",
            company: j.employer_name || "",
            location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : ""),
            salary: sMin ? `$${Math.floor(sMin / 1000)}k${j.job_max_salary ? `-$${Math.floor(j.job_max_salary / 1000)}k` : ""}` : "",
            url: j.job_apply_link || j.job_google_link || "",
            source: "JSearch",
            posted: j.job_posted_at_datetime_utc || "",
          });
        }
      }
    }
    return all;
  } catch { return []; }
}

const GREENHOUSE_COMPANIES = [
  "airbnb","stripe","doordash","gusto","instacart","plaid","lyft","twilio","segment","brex","robinhood",
  "asana","retool","datadog","ramp","samsara","gong","gitlab","figma","notion","airtable","cloudflare",
  "mongodb","snowflake","databricks","scale","rippling","deel","mercury","webflow","carta",
  "amplitude","intercom","front","mixpanel","lattice","sentry","posthog","outreach","salesloft",
  "apollo","clari","zendesk","klaviyo","drift","looker","hashicorp","circleci","atlassian",
  "auth0","okta","hubspot","chime","sofi","affirm","toast","squarespace","box","dropbox",
  "asana","smartsheet","miro","loom","qualtrics","new-relic","pagerduty","freshworks","zoominfo",
  "6sense","chilipiper","gemshq","orum","dialpad","aircall","talkdesk","five9","nextiva",
];

const LEVER_COMPANIES = [
  "netflix","github","eventbrite","attentive","mercari","cruise","substack","scale",
  "shopify","square","reddit","twitch","linkedin","snap","pinterest","yelp","glassdoor",
  "benchling","clever","discord","plaid","chime","ramp","linear","vercel",
];

const ASHBY_COMPANIES = [
  "linear","vercel","supabase","anthropic","neon","posthog","modal","cursor","openai",
  "huggingface","groq","mistral","perplexity","arc","raycast","cohere","deepgram",
  "airplane","replicate","runway","weights-and-biases","pinecone","langchain","replit",
];

async function fetchAtsCompany(slug: string, source: "Greenhouse" | "Lever" | "Ashby"): Promise<Job[]> {
  const urls: Record<string, string> = {
    Greenhouse: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    Lever:      `https://api.lever.co/v0/postings/${slug}?mode=json`,
    Ashby:      `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  };
  try {
    const res = await fetch(urls[source], { next: { revalidate: 1800 } });
    if (!res.ok) return [];
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
  const results = await Promise.allSettled(tasks);
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
    ...(remotive.status === "fulfilled" ? remotive.value : []),
    ...(remoteok.status === "fulfilled" ? remoteok.value : []),
    ...(adzuna.status === "fulfilled" ? adzuna.value : []),
    ...(jsearch.status === "fulfilled" ? jsearch.value : []),
    ...(ats.status === "fulfilled" ? ats.value : []),
  ];

  const seen = new Set<string>();
  const deduped: Job[] = [];
  for (const j of all) {
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
