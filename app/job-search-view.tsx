"use client";
import { useEffect, useState } from "react";
import CoverLetterModal, { CoverLetterJob } from "./cover-letter-modal";

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

const SALARY_PRESETS = [50000, 60000, 70000, 80000, 90000, 100000];
const SOURCE_COLORS: Record<string, string> = {
  Adzuna: "#7b2cbf",
  JSearch: "#1d4ed8",
  Greenhouse: "#0f766e",
  Lever: "#b45309",
  Ashby: "#be185d",
  Remotive: "#dc2626",
  RemoteOK: "#0891b2",
};

function initials(s: string) { return (s || "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function stringToColor(s: string) {
  const palette = ["#4f46e5","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function timeAgo(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function JobSearchView({ onTracked }: { onTracked: () => void }) {
  const [minSalary, setMinSalary] = useState(70000);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"newest" | "salary">("newest");
  const [coverJob, setCoverJob] = useState<CoverLetterJob | null>(null);
  const PAGE_SIZE = 25;

  async function search(targetSalary = minSalary) {
    setLoading(true); setError(""); setPage(1);
    try {
      const res = await fetch(`/api/jobs/search?salary=${targetSalary}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
      setBySource(data.bySource || {});
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); /* eslint-disable-next-line */ }, []);

  async function track(job: Job) {
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          location: job.location,
          status: "saved",
          applied_at: new Date().toISOString().slice(0, 10),
          salary: job.salary,
          source: job.source,
          link: job.url,
        }),
      });
      if (!res.ok) throw new Error("Track failed");
      setTracked((s) => new Set([...s, job.id]));
      onTracked();
    } catch {
      alert("Couldn't track this job.");
    }
  }

  function parseSalary(s: string): number {
    const m = s.match(/\$?(\d+)k/i);
    return m ? Number(m[1]) * 1000 : 0;
  }

  const filtered = (() => {
    let rows = jobs.slice();
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    }
    if (sortBy === "salary") {
      rows.sort((a, b) => parseSalary(b.salary) - parseSalary(a.salary));
    }
    return rows;
  })();

  const paged = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  return (
    <section className="view jobs-view">
      <header className="jobs-hero">
        <div>
          <h1 className="page-title">SDR &amp; BDR Jobs</h1>
          <p className="page-sub">Live roles aggregated from Adzuna, JSearch, Remotive, RemoteOK, and 100+ company career pages.</p>
        </div>
        <div className="jobs-hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-value">{total.toLocaleString()}</div>
            <div className="hero-stat-label">Total openings</div>
          </div>
        </div>
      </header>

      {Object.keys(bySource).length > 0 && (
        <div className="source-bar">
          {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="source-chip" style={{ borderColor: SOURCE_COLORS[k] || "#999", color: SOURCE_COLORS[k] || "#333" }}>
              <span className="source-dot" style={{ background: SOURCE_COLORS[k] || "#999" }} />
              <strong>{k}</strong>
              <span className="source-count">{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="jobs-filterbar">
        <div className="filter-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by company, title, or location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-salary">
          <span className="filter-label">Min salary</span>
          <div className="filter-salary-chips">
            {SALARY_PRESETS.map((s) => (
              <button
                key={s}
                className={`chip ${minSalary === s ? "chip-active" : ""}`}
                onClick={() => { setMinSalary(s); search(s); }}
              >
                ${(s / 1000)}k+
              </button>
            ))}
          </div>
        </div>
        <div className="filter-sort">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="select">
            <option value="newest">Newest</option>
            <option value="salary">Highest salary</option>
          </select>
          <button className="btn btn-primary" onClick={() => search()} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && jobs.length === 0 ? (
        <div className="jobs-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-row"><div className="skel skel-circle" /><div className="skel-col"><div className="skel skel-line" style={{ width: "60%" }} /><div className="skel skel-line" style={{ width: "40%" }} /></div></div>
          ))}
        </div>
      ) : paged.length === 0 ? (
        <div className="jobs-empty">
          <div className="jobs-empty-icon">🔍</div>
          <h3>No jobs match your filters</h3>
          <p className="muted">Try lowering the salary minimum or clearing the search.</p>
        </div>
      ) : (
        <>
          <div className="jobs-count-bar">
            <strong>{filtered.length.toLocaleString()}</strong> jobs match · <span className="muted">showing {paged.length}</span>
          </div>
          <ul className="jobs-list">
            {paged.map((j) => (
              <li key={j.id} className="job-row">
                <a className="job-row-logo" href={j.url} target="_blank" rel="noopener" style={{ background: stringToColor(j.company) }}>
                  {initials(j.company)}
                </a>
                <div className="job-row-main">
                  <div className="job-row-titleline">
                    <a className="job-row-title" href={j.url} target="_blank" rel="noopener">{j.title}</a>
                    <span className="job-row-source" style={{ color: SOURCE_COLORS[j.source] || "#666", borderColor: SOURCE_COLORS[j.source] || "#ccc" }}>{j.source}</span>
                  </div>
                  <div className="job-row-company">{j.company}</div>
                  <div className="job-row-meta">
                    {j.location && <span className="meta-item"><span className="meta-icon">📍</span>{j.location}</span>}
                    {j.salary && <span className="meta-item meta-salary"><span className="meta-icon">💵</span>{j.salary}</span>}
                    {j.posted && <span className="meta-item meta-time"><span className="meta-icon">🕒</span>{timeAgo(j.posted)}</span>}
                  </div>
                </div>
                <div className="job-row-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setCoverJob({ title: j.title, company: j.company, url: j.url })}
                    title="Generate AI cover letter"
                  >
                    ✍️ Cover
                  </button>
                  <a className="btn btn-ghost" href={j.url} target="_blank" rel="noopener">Apply</a>
                  <button
                    className={`btn ${tracked.has(j.id) ? "btn-tracked" : "btn-primary"}`}
                    disabled={tracked.has(j.id)}
                    onClick={() => track(j)}
                  >
                    {tracked.has(j.id) ? "✓ Tracked" : "+ Track"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="jobs-load-more">
              <button className="btn btn-ghost" onClick={() => setPage(page + 1)}>
                Show {Math.min(PAGE_SIZE, filtered.length - paged.length)} more ({filtered.length - paged.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {coverJob && <CoverLetterModal job={coverJob} onClose={() => setCoverJob(null)} />}
    </section>
  );
}
