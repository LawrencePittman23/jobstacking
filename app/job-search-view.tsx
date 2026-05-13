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

const PRESETS: Record<string, { role: string; salary: number; location: string; remote: boolean }> = {
  "sdr-70":   { role: "SDR", salary: 70000, location: "Remote", remote: true },
  "bdr-75":   { role: "BDR", salary: 75000, location: "Remote", remote: true },
  "ae-100":   { role: "Account Executive", salary: 100000, location: "Remote", remote: true },
  "sdr-saas": { role: "SaaS SDR", salary: 80000, location: "Remote", remote: true },
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
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function JobSearchView({ onTracked }: { onTracked: () => void }) {
  const [sb, setSb] = useState({ role: "SDR", salary: 70000, location: "Remote", remote: true });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  async function search() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/jobs/search?role=${encodeURIComponent(sb.role)}&salary=${sb.salary}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
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
      alert("Couldn't track this job. Try again.");
    }
  }

  const indeedUrl    = `https://www.indeed.com/jobs?q=${encodeURIComponent(`${sb.role} $${sb.salary.toLocaleString()}`)}&l=${encodeURIComponent(sb.remote ? "Remote" : sb.location)}${sb.remote ? "&sc=0kf%3Aattr%28DSQF7%29%3B" : ""}`;
  const wellfoundUrl = `https://wellfound.com/jobs?keywords=${encodeURIComponent(sb.role)}${sb.remote ? "&remote=true" : ""}`;
  const builtinUrl   = `https://builtin.com/jobs?search=${encodeURIComponent(sb.role)}`;

  return (
    <section className="view">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">Job Search</h1>
          <p className="page-sub">Live SDR / BDR / AE roles from Remotive + RemoteOK. Click Track to save to your dashboard.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header"><strong>Search</strong></div>
        <div className="search-builder">
          <div className="sb-grid">
            <label className="sb-field"><span>Role / Title</span><input value={sb.role} onChange={(e) => setSb({ ...sb, role: e.target.value })} /></label>
            <label className="sb-field"><span>Min salary (USD)</span><input type="number" step={5000} value={sb.salary} onChange={(e) => setSb({ ...sb, salary: Number(e.target.value) })} /></label>
            <label className="sb-field"><span>Location</span><input value={sb.location} onChange={(e) => setSb({ ...sb, location: e.target.value })} /></label>
            <label className="sb-field sb-toggle"><input type="checkbox" checked={sb.remote} onChange={(e) => setSb({ ...sb, remote: e.target.checked })} /><span>Remote only</span></label>
          </div>
          <div className="sb-presets">
            <span className="muted">Presets:</span>
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} className="chip" onClick={() => setSb(p)}>{p.role} · ${p.salary.toLocaleString()}+</button>
            ))}
            <button className="btn btn-primary" onClick={search} disabled={loading} style={{ marginLeft: "auto" }}>
              {loading ? "Searching..." : "🔍 Search"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <strong>Live jobs {total > 0 && <span className="muted" style={{ fontWeight: 400 }}>({jobs.length} shown · {total} total)</span>}</strong>
          <span className="muted">Sourced from Remotive + RemoteOK</span>
        </div>
        {error && <div className="empty" style={{ color: "var(--danger)" }}>{error}</div>}
        {!error && (
          <div className="jobs-grid">
            {loading ? (
              <div className="empty">Searching...</div>
            ) : jobs.length === 0 ? (
              <div className="empty">No jobs match. Try a broader role title or lower salary, or use the external links below.</div>
            ) : jobs.map((j) => (
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
        )}
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <strong>Broader search on major boards</strong>
          <span className="muted">Opens in a new tab with your filters applied.</span>
        </div>
        <div className="sb-actions" style={{ padding: 18 }}>
          <a className="board-btn indeed" href={indeedUrl} target="_blank" rel="noopener"><span className="board-logo">in</span><span className="board-name">Search on Indeed</span><span className="board-arrow">→</span></a>
          <a className="board-btn wellfound" href={wellfoundUrl} target="_blank" rel="noopener"><span className="board-logo">W</span><span className="board-name">Search on Wellfound</span><span className="board-arrow">→</span></a>
          <a className="board-btn builtin" href={builtinUrl} target="_blank" rel="noopener"><span className="board-logo">BI</span><span className="board-name">Search on Built In</span><span className="board-arrow">→</span></a>
        </div>
      </section>
    </section>
  );
}
