"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface TimeSession {
  id: number;
  user_email: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

function durationMs(s: TimeSession): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
  return Math.max(0, end - new Date(s.started_at).getTime());
}
function fmtHM(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}
function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function localDayKey(iso: string): string {
  // Group by local calendar day (not UTC).
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x;
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0, 0, 0, 0); return x;
}
function toLocalInput(iso: string): string {
  // Produce "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimeLogView() {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [editing, setEditing] = useState<TimeSession | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/time-sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = sessions.find((s) => !s.ended_at) ?? null;

  // Live tick while clocked in so the running total updates.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Poll the server periodically so other browsers' clock-in/out show up here.
  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayKey = localDayKey(now.toISOString());
    const weekStart = startOfWeek(now).getTime();
    const monthStart = startOfMonth(now).getTime();
    let today = 0, week = 0, month = 0, all = 0;
    for (const s of sessions) {
      const d = durationMs(s);
      all += d;
      const startMs = new Date(s.started_at).getTime();
      if (localDayKey(s.started_at) === todayKey) today += d;
      if (startMs >= weekStart) week += d;
      if (startMs >= monthStart) month += d;
    }
    return { today, week, month, all };
  }, [sessions, sessions.find((s) => !s.ended_at) ? "active" : "idle"]);

  const byDay = useMemo(() => {
    const map = new Map<string, TimeSession[]>();
    for (const s of sessions) {
      const key = localDayKey(s.started_at);
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  async function clockIn() {
    await fetch("/api/time-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    load();
  }
  async function clockOut() {
    await fetch("/api/time-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "out" }) });
    load();
  }
  async function remove(id: number) {
    if (!confirm("Delete this session?")) return;
    await fetch(`/api/time-sessions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="view">
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="page-title">Time Log</h1>
          <p className="page-sub">Clock-in / out sessions, synced across devices and browsers.</p>
        </div>
        <div className="topbar-right">
          {active ? (
            <button className="btn btn-ghost" onClick={clockOut} style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}>
              ■ Clock out
            </button>
          ) : (
            <button className="btn btn-primary" onClick={clockIn}>▶ Clock in</button>
          )}
          <button className="btn btn-ghost" onClick={() => setShowManual(true)}>+ Manual entry</button>
        </div>
      </header>

      <section className="stats" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Today" value={fmtHM(stats.today)} delta={active ? "● clocked in" : "—"} tone={active ? "up" : "neutral"} />
        <StatCard label="This week" value={fmtHM(stats.week)} delta="" tone="neutral" />
        <StatCard label="This month" value={fmtHM(stats.month)} delta="" tone="neutral" />
        <StatCard label="All time" value={fmtHM(stats.all)} delta={`${sessions.length} sessions`} tone="neutral" />
      </section>

      <section className="panel">
        <div className="panel-header">
          <strong>Sessions</strong>
          <span className="muted">{sessions.length} total</span>
        </div>
        {loading ? (
          <div className="empty" style={{ padding: 40 }}>Loading…</div>
        ) : byDay.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>No sessions yet. Click <strong>Clock in</strong> to start tracking.</div>
        ) : (
          <div>
            {byDay.map(([dayKey, list]) => {
              const dayTotal = list.reduce((sum, s) => sum + durationMs(s), 0);
              return (
                <div key={dayKey} style={{ borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", background: "var(--surface-2)", fontSize: 13 }}>
                    <strong>{fmtDay(list[0].started_at)}</strong>
                    <span className="muted">{fmtHM(dayTotal)} · {list.length} session{list.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="table">
                    <tbody>
                      {list.map((s) => {
                        const isActive = !s.ended_at;
                        return (
                          <tr key={s.id}>
                            <td style={{ width: 100, fontFamily: "monospace", fontWeight: 600 }}>{fmtClock(s.started_at)}</td>
                            <td style={{ width: 100, fontFamily: "monospace", color: "var(--text-muted)" }}>→ {s.ended_at ? fmtClock(s.ended_at) : <span style={{ color: "var(--danger)", fontWeight: 700 }}>active</span>}</td>
                            <td style={{ width: 90, fontWeight: 600 }}>{fmtHM(durationMs(s))}</td>
                            <td style={{ color: "var(--text-muted)" }}>{s.notes || ""}</td>
                            <td style={{ textAlign: "right" }}>
                              <div className="row-actions">
                                {!isActive && <button className="row-btn" onClick={() => setEditing(s)}>Edit</button>}
                                <button className="row-btn danger" onClick={() => remove(s.id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showManual && <ManualEntryModal onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); load(); }} />}
      {editing && <EditSessionModal session={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </section>
  );
}

function StatCard({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: "up" | "down" | "neutral" }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${tone}`}>{delta || "—"}</div>
    </div>
  );
}

function ManualEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const startDefault = toLocalInput(new Date(now.getTime() - 60 * 60 * 1000).toISOString());
  const endDefault = toLocalInput(now.toISOString());
  const [startedAt, setStartedAt] = useState(startDefault);
  const [endedAt, setEndedAt] = useState(endDefault);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!startedAt || !endedAt) return;
    if (new Date(endedAt) <= new Date(startedAt)) {
      alert("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/time-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          started_at: new Date(startedAt).toISOString(),
          ended_at: new Date(endedAt).toISOString(),
          notes: notes || null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Manual time entry</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="form">
          <label>Start<input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></label>
          <label>End<input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></label>
          <label>Notes (optional)<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Applied to 8 Stripe roles" /></label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save entry"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditSessionModal({ session, onClose, onSaved }: { session: TimeSession; onClose: () => void; onSaved: () => void }) {
  const [startedAt, setStartedAt] = useState(toLocalInput(session.started_at));
  const [endedAt, setEndedAt] = useState(session.ended_at ? toLocalInput(session.ended_at) : "");
  const [notes, setNotes] = useState(session.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!startedAt) return;
    if (endedAt && new Date(endedAt) <= new Date(startedAt)) {
      alert("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/time-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          started_at: new Date(startedAt).toISOString(),
          ended_at: endedAt ? new Date(endedAt).toISOString() : null,
          notes: notes || null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Edit session</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="form">
          <label>Start<input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></label>
          <label>End<input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></label>
          <label>Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
