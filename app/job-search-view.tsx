"use client";
import { useEffect, useState } from "react";

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
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function JobSearchView({ onTracked }: { onTracked: () => void }) {
  const [minSalary, setMinSalary] = useState(70000);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 60;

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
    } catch (e) {
      alert("Couldn't track this job.");
    }
  }

  const paged = jobs.slice(0, page * PAGE_SIZE);
  const hasMore = paged.length < jobs.length;

  return (
    <section className="view">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">Job Search</h1>
          <p className="page-sub">Live SDR &amp; BDR roles aggregated from Remotive, RemoteOK, Adzuna, JSearch, and 100+ company career pages.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header"><strong>Filter</strong><span className="muted">SDR &amp; BDR titles only</span></div>
        <div className="search-builder">
          <div className="sb-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label className="sb-field">
              <span>Minimum base salary (USD)</span>
              <input type="number" step={5000} value={minSalary} onChange={(e) => setMinSalary(Number(e.target.value))} />
            </label>
          </div>
          <div className="sb-presets">
            <span className="muted">Quick set:</span>
            {SALARY_PRESETS.map((s) => (
              <button key={s} className="chip" onClick={() => { setMinSalary(s); search(s); }}>${(s/1000)}k+</button>
            ))}
            <button className="btn btn-primary" onClick={() => search()} disabled={loading} style={{ marginLeft: "auto" }}>
              {loading ? "Searching..." : "🔍 Search"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <strong>SDR / BDR jobs <span className="muted" style={{ fontWeight: 400 }}>({total} total · showing {paged.length})</span></strong>
          <span className="muted">
            {Object.keys(bySource).length === 0 ? "—" : Object.entries(bySource).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </span>
        </div>
        {error && <div className="empty" style={{ color: "var(--danger)" }}>{error}</div>}
        {!error && (
          <>
            <div className="jobs-grid">
              {loading ? (
                <div className="empty">Searching across all sources...</div>
              ) : paged.length === 0 ? (
                <div className="empty">No jobs found. Try lowering the salary, or add Adzuna / JSearch API keys in Vercel for many more sources (see SETUP.md).</div>
              ) : paged.map((j) => (
                <div key={j.id} className="job-card">
                  <div className="job-head">
                    <div className="company-logo" style={{ background: stringToColor(j.company) }}>{initials(j.company)}</div>
                    <div className="job-headtext">
                      <div className="job-title">{j.title}</div>
                      <div className="job-company">{j.company}</div>
                    </div>
                    <span className="job-source">{j.source}</span>
                  </div>
                  <div className="job-meta">
                    {j.location && <span>📍 {j.location}</span>}
                    {j.salary && <span>💵 {j.salary}</span>}
                    {j.posted && <span>📅 {timeAgo(j.posted)}</span>}
                  </div>
                  <div className="job-actions">
                    <a className="btn btn-ghost" href={j.url} target="_blank" rel="noopener">View / Apply</a>
                    <button className="btn btn-primary" disabled={tracked.has(j.id)} onClick={() => track(j)}>
                      {tracked.has(j.id) ? "✓ Tracked" : "+ Track"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                <button className="btn btn-ghost" onClick={() => setPage(page + 1)}>Show more ({jobs.length - paged.length} remaining)</button>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}
