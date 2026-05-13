"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import type { Application, Status } from "@/lib/types";
import JobSearchView from "./job-search-view";

const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved", applied: "Applied", interview: "Interview", assessment: "Assessment", offer: "Offer", rejected: "Rejected",
};
const STATUS_ORDER: Status[] = ["applied", "interview", "assessment", "offer", "rejected"];

function initials(name: string) { return (name || "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isoDate(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtDate(iso?: string | null) { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); if (isNaN(+d)) return iso; return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function relativeDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00"); if (isNaN(+d)) return "";
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (diff < 0) return `in ${-diff}d`;
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff/7)}w ago`;
  return `${Math.floor(diff/30)}mo ago`;
}

type View = "applications" | "search" | "calendar" | "analytics" | "settings";

export default function Dashboard({ userEmail, userName }: { userEmail: string; userName: string }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [view, setView] = useState<View>("applications");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [calAnchor, setCalAnchor] = useState<Date>(startOfWeek(new Date()));
  const [editing, setEditing] = useState<Application | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  const reload = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (res.ok) { const data = await res.json(); setApps(data.applications); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length };
    for (const r of apps) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [apps]);

  const upcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return apps.filter((a) => (a.status === "interview" || a.status === "assessment") && a.applied_at && new Date(a.applied_at + "T00:00:00") >= today).length;
  }, [apps]);

  const filtered = useMemo(() => {
    let rows = apps.slice();
    if (filter !== "all") rows = rows.filter((r) => r.status === filter);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => r.company.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || (r.location || "").toLowerCase().includes(q));
    }
    switch (sort) {
      case "date-asc":  rows.sort((a,b) => (a.applied_at || "").localeCompare(b.applied_at || "")); break;
      case "company":   rows.sort((a,b) => a.company.localeCompare(b.company)); break;
      case "role":      rows.sort((a,b) => a.role.localeCompare(b.role)); break;
      default:          rows.sort((a,b) => (b.applied_at || "").localeCompare(a.applied_at || ""));
    }
    return rows;
  }, [apps, filter, query, sort]);

  async function saveApp(form: any) {
    const payload = {
      company: form.company, role: form.role, location: form.location, status: form.status,
      applied_at: form.applied_at, event_time: form.event_time, salary: form.salary, source: form.source, link: form.link,
    };
    if (form.id) {
      await fetch(`/api/applications/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowModal(false);
    reload();
  }

  async function deleteApp(id: number) {
    if (!confirm("Delete this application?")) return;
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    reload();
  }

  async function syncGmail() {
    setSyncing(true); setSyncStatus("Scanning Gmail...");
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncStatus(`Scanned ${data.scanned} emails, saved ${data.saved} application updates.`);
      reload();
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-logo">JS</span><span className="brand-name">JobStacking</span></div>
        <nav className="nav">
          <NavItem name="Applications" route="applications" view={view} setView={setView} icon="📄" badge={apps.length} />
          <NavItem name="Job Search" route="search" view={view} setView={setView} icon="🔎" />
          <NavItem name="Calendar" route="calendar" view={view} setView={setView} icon="📅" badge={upcomingCount} badgeAlt />
          <NavItem name="Analytics" route="analytics" view={view} setView={setView} icon="📊" />
          <NavItem name="Settings" route="settings" view={view} setView={setView} icon="⚙" />
        </nav>
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">{initials(userName || userEmail)}</div>
            <div className="user-info">
              <div className="user-name">{userName || userEmail.split("@")[0]}</div>
              <button className="link-btn" onClick={() => signOut()}>Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === "applications" && (
          <section className="view">
            <header className="topbar">
              <div className="topbar-left">
                <h1 className="page-title">Applications</h1>
                <p className="page-sub">Auto-synced from Gmail + anything you add manually.</p>
              </div>
              <div className="topbar-right">
                <div className="search">
                  <span className="search-icon">🔍</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or role..." />
                </div>
                <button className="btn btn-ghost" disabled={syncing} onClick={syncGmail}>{syncing ? "Syncing..." : "↻ Sync Gmail"}</button>
                <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ New</button>
              </div>
            </header>

            {syncStatus && <div className="banner">{syncStatus}</div>}

            <section className="stats">
              <StatCard label="Total" value={counts.all || 0} delta={`${counts.applied || 0} applied`} tone="neutral" />
              <StatCard label="In Progress" value={(counts.applied || 0) + (counts.interview || 0) + (counts.assessment || 0)} delta={`${counts.assessment || 0} assessments`} tone="up" />
              <StatCard label="Interviews" value={counts.interview || 0} delta={`${upcomingCount} upcoming`} tone="up" />
              <StatCard label="Offers" value={counts.offer || 0} delta={counts.offer ? "▲ keep going" : "—"} tone="up" />
              <StatCard label="Rejected" value={counts.rejected || 0} delta="noise filter" tone="down" />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="tabs">
                  {(["all","applied","interview","assessment","offer","rejected","saved"] as const).map((k) => (
                    <button key={k} className={`tab ${filter===k?"active":""}`} onClick={() => setFilter(k as any)}>
                      {k === "all" ? "All" : STATUS_LABEL[k as Status]} <span className="count">{counts[k] || 0}</span>
                    </button>
                  ))}
                </div>
                <div className="panel-actions">
                  <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="date-desc">Newest first</option>
                    <option value="date-asc">Oldest first</option>
                    <option value="company">Company A–Z</option>
                    <option value="role">Role A–Z</option>
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Company</th><th>Role</th><th>Location</th><th>Status</th>
                      <th>Date</th><th>Salary</th><th>Source</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="empty">No applications. Try syncing Gmail or adding one manually.</td></tr>
                    ) : filtered.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="company-cell">
                            <div className="company-logo" style={{ background: r.color || "#4f46e5" }}>{initials(r.company)}</div>
                            <div><div className="company-name">{r.company}</div><div className="company-tag">{r.source || ""}</div></div>
                          </div>
                        </td>
                        <td>{r.role || "—"}</td>
                        <td>{r.location || "—"}</td>
                        <td><span className={`status-pill status-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                        <td><div>{fmtDate(r.applied_at)}</div><div className="company-tag">{relativeDate(r.applied_at)}{r.event_time ? " · " + r.event_time : ""}</div></td>
                        <td>{r.salary || "—"}</td>
                        <td>{r.source || "—"}</td>
                        <td>
                          <div className="row-actions">
                            {r.link && <a className="row-btn" href={r.link} target="_blank" rel="noopener">Open</a>}
                            <button className="row-btn" onClick={() => { setEditing(r); setShowModal(true); }}>Edit</button>
                            <button className="row-btn danger" onClick={() => deleteApp(r.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <div className="muted">Showing {filtered.length} of {apps.length} applications</div>
              </div>
            </section>
          </section>
        )}

        {view === "search" && <JobSearchView onTracked={reload} />}

        {view === "calendar" && (
          <CalendarView apps={apps} calAnchor={calAnchor} setCalAnchor={setCalAnchor} />
        )}

        {view === "analytics" && (
          <AnalyticsView apps={apps} counts={counts} />
        )}

        {view === "settings" && (
          <SettingsView userEmail={userEmail} syncing={syncing} onSync={syncGmail} syncStatus={syncStatus} />
        )}
      </main>

      {showModal && (
        <AppModal app={editing} onClose={() => setShowModal(false)} onSave={saveApp} />
      )}
    </div>
  );
}

function NavItem({ name, route, view, setView, icon, badge, badgeAlt }: { name: string; route: View; view: View; setView: (v: View) => void; icon: string; badge?: number; badgeAlt?: boolean }) {
  return (
    <button className={`nav-item ${view === route ? "active" : ""}`} onClick={() => setView(route)}>
      <span className="icon">{icon}</span><span>{name}</span>
      {badge !== undefined && badge > 0 && <span className={`badge ${badgeAlt ? "alt" : ""}`}>{badge}</span>}
    </button>
  );
}

function StatCard({ label, value, delta, tone }: { label: string; value: number | string; delta: string; tone: "up"|"down"|"neutral" }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${tone}`}>{delta}</div>
    </div>
  );
}

function CalendarView({ apps, calAnchor, setCalAnchor }: { apps: Application[]; calAnchor: Date; setCalAnchor: (d: Date) => void }) {
  const start = calAnchor;
  const end = addDays(start, 6);
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayItems = apps.filter((a) => (a.status === "interview" || a.status === "assessment") && a.applied_at === isoDate(today)).sort((a,b) => (a.event_time || "").localeCompare(b.event_time || ""));
  return (
    <section className="view">
      <header className="topbar">
        <div className="topbar-left"><h1 className="page-title">Calendar</h1><p className="page-sub">Upcoming interviews and assessments.</p></div>
        <div className="topbar-right">
          <button className="btn btn-ghost" onClick={() => setCalAnchor(addDays(calAnchor, -7))}>‹</button>
          <button className="btn btn-ghost" onClick={() => setCalAnchor(startOfWeek(new Date()))}>Today</button>
          <button className="btn btn-ghost" onClick={() => setCalAnchor(addDays(calAnchor, 7))}>›</button>
        </div>
      </header>
      <section className="panel">
        <div className="panel-header">
          <strong>{start.toLocaleDateString(undefined,{month:"short",day:"numeric"})} – {end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</strong>
        </div>
        <div className="calendar">
          {days.map((d) => {
            const items = apps.filter((a) => (a.status === "interview" || a.status === "assessment") && a.applied_at === isoDate(d)).sort((a,b) => (a.event_time || "").localeCompare(b.event_time || ""));
            return (
              <div key={isoDate(d)} className={`cal-day ${isSameDay(d, today) ? "today" : ""}`}>
                <div className="cal-day-head">
                  <span className="cal-dow">{d.toLocaleDateString(undefined,{weekday:"short"})}</span>
                  <span className="cal-num">{d.getDate()}</span>
                </div>
                <div className="cal-events">
                  {items.length === 0 ? <div className="cal-empty">—</div> : items.map((it) => (
                    <div key={it.id} className={`cal-event ev-${it.status}`}>
                      <div className="ev-time">{it.event_time || "All day"}</div>
                      <div className="ev-title">{it.company}</div>
                      <div className="ev-sub">{it.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header"><strong>Today</strong><span className="muted">{today.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</span></div>
        <ul className="today-list">
          {todayItems.length === 0 ? <li className="cal-empty">Nothing scheduled today.</li> : todayItems.map((it) => (
            <li key={it.id}>
              <span className="t-time">{it.event_time || "—"}</span>
              <span className={`status-pill status-${it.status}`}>{STATUS_LABEL[it.status]}</span>
              <span className="t-title"><strong>{it.company}</strong> · {it.role}</span>
              <span className="t-loc">{it.location}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function AnalyticsView({ apps, counts }: { apps: Application[]; counts: Record<string, number> }) {
  const funnel = STATUS_ORDER.map((k) => ({ key: k, label: STATUS_LABEL[k], n: counts[k] || 0 }));
  const max = Math.max(1, ...funnel.map((s) => s.n));
  const weeks: Array<{ label: string; n: number }> = [];
  const start = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(start, -i * 7);
    const we = addDays(ws, 6);
    const n = apps.filter((a) => a.applied_at && a.applied_at >= isoDate(ws) && a.applied_at <= isoDate(we)).length;
    weeks.push({ label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }), n });
  }
  const wMax = Math.max(1, ...weeks.map((w) => w.n));
  return (
    <section className="view">
      <header className="topbar"><div className="topbar-left"><h1 className="page-title">Analytics</h1><p className="page-sub">Funnel and weekly volume.</p></div></header>
      <section className="panel">
        <div className="panel-header"><strong>Funnel</strong></div>
        <div className="funnel">
          {funnel.map((s) => (
            <div key={s.key} className="funnel-row">
              <div className="funnel-label">{s.label}</div>
              <div className="funnel-bar"><div className={`funnel-fill st-${s.key}`} style={{ width: `${(s.n/max)*100}%` }} /></div>
              <div className="funnel-num">{s.n}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header"><strong>Applications per week</strong></div>
        <div className="bars">
          {weeks.map((w) => (
            <div key={w.label} className="bar">
              <div className="bar-fill" style={{ height: `${(w.n/wMax)*100}%` }} />
              <div className="bar-label">{w.label}</div>
              <div className="bar-num">{w.n}</div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function SettingsView({ userEmail, syncing, onSync, syncStatus }: { userEmail: string; syncing: boolean; onSync: () => void; syncStatus: string }) {
  return (
    <section className="view">
      <header className="topbar"><div className="topbar-left"><h1 className="page-title">Settings</h1><p className="page-sub">Manage Gmail sync and data.</p></div></header>
      <section className="panel">
        <div className="panel-header"><strong>Integrations</strong></div>
        <div className="integrations">
          <div className="int-card">
            <div className="int-head">
              <div className="int-logo gmail">M</div>
              <div>
                <div className="int-name">Gmail</div>
                <div className="int-desc">Connected as <strong>{userEmail}</strong>. Auto-classifies application emails into Applied / Interview / Assessment / Offer / Rejected.</div>
              </div>
            </div>
            <div className="int-actions">
              <span className="status-pill status-offer">Connected</span>
              <button className="btn btn-primary" disabled={syncing} onClick={onSync}>{syncing ? "Syncing..." : "Sync now"}</button>
            </div>
            {syncStatus && <p className="muted small">{syncStatus}</p>}
          </div>
        </div>
        <p className="muted note">Auto-sync runs daily via cron. Last 60 days of emails are scanned per sync.</p>
      </section>
    </section>
  );
}

function AppModal({ app, onClose, onSave }: { app: Application | null; onClose: () => void; onSave: (data: any) => void }) {
  const [f, setF] = useState({
    id: app?.id || "",
    company: app?.company || "",
    role: app?.role || "",
    location: app?.location || "",
    status: app?.status || "applied",
    applied_at: app?.applied_at || isoDate(new Date()),
    event_time: app?.event_time || "",
    salary: app?.salary || "",
    source: app?.source || "",
    link: app?.link || "",
  });
  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header"><h2>{app ? "Edit" : "New"} Application</h2><button className="icon-btn" onClick={onClose}>✕</button></div>
        <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
          <label>Company<input value={f.company} required onChange={(e) => setF({...f, company: e.target.value})} /></label>
          <label>Role<input value={f.role} onChange={(e) => setF({...f, role: e.target.value})} /></label>
          <label>Location<input value={f.location} onChange={(e) => setF({...f, location: e.target.value})} /></label>
          <label>Status
            <select value={f.status} onChange={(e) => setF({...f, status: e.target.value as Status})}>
              <option value="saved">Saved</option><option value="applied">Applied</option>
              <option value="interview">Interview</option><option value="assessment">Assessment</option>
              <option value="offer">Offer</option><option value="rejected">Rejected</option>
            </select>
          </label>
          <div className="form-row">
            <label>Date<input type="date" value={f.applied_at} onChange={(e) => setF({...f, applied_at: e.target.value})} /></label>
            <label>Time<input type="time" value={f.event_time} onChange={(e) => setF({...f, event_time: e.target.value})} /></label>
          </div>
          <label>Salary<input value={f.salary} onChange={(e) => setF({...f, salary: e.target.value})} /></label>
          <label>Source<input value={f.source} onChange={(e) => setF({...f, source: e.target.value})} /></label>
          <label>Link<input type="url" value={f.link} onChange={(e) => setF({...f, link: e.target.value})} /></label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
