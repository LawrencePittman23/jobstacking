/* ============ Seed data ============ */
const SEED = [
  { id: 1,  company: "Outreach",       role: "SDR",                   location: "Remote (US)",      status: "interview",  date: "2026-05-13", time: "10:00", salary: "$72k",  source: "Wellfound", link: "", color: "#1a73e8" },
  { id: 2,  company: "Gong",           role: "BDR",                   location: "Remote (US)",      status: "applied",    date: "2026-05-08", time: "",      salary: "$75k",  source: "Indeed",    link: "", color: "#7b3fe4" },
  { id: 3,  company: "Salesloft",      role: "SDR II",                location: "Atlanta, GA",      status: "assessment", date: "2026-05-14", time: "14:00", salary: "$78k",  source: "Built In",  link: "", color: "#ff5a36" },
  { id: 4,  company: "HubSpot",        role: "Business Dev Rep",      location: "Remote",           status: "interview",  date: "2026-05-13", time: "15:30", salary: "$70k",  source: "LinkedIn",  link: "", color: "#ff7a59" },
  { id: 5,  company: "Apollo.io",      role: "Outbound SDR",          location: "Remote",           status: "applied",    date: "2026-05-10", time: "",      salary: "$72k",  source: "Wellfound", link: "", color: "#4a48e0" },
  { id: 6,  company: "Klaviyo",        role: "SDR",                   location: "Boston, MA",       status: "rejected",   date: "2026-04-22", time: "",      salary: "$74k",  source: "Indeed",    link: "", color: "#000000" },
  { id: 7,  company: "ZoomInfo",       role: "BDR",                   location: "Remote",           status: "applied",    date: "2026-05-09", time: "",      salary: "$71k",  source: "Built In",  link: "", color: "#0072ce" },
  { id: 8,  company: "Drift",          role: "SDR",                   location: "Remote",           status: "interview",  date: "2026-05-15", time: "11:00", salary: "$73k",  source: "Referral",  link: "", color: "#00d4a8" },
  { id: 9,  company: "Lattice",        role: "Sales Development Rep", location: "San Francisco",    status: "offer",      date: "2026-05-01", time: "",      salary: "$80k",  source: "Wellfound", link: "", color: "#1f1f1f" },
  { id: 10, company: "Pendo",          role: "BDR",                   location: "Raleigh, NC",      status: "rejected",   date: "2026-04-18", time: "",      salary: "$70k",  source: "Indeed",    link: "", color: "#ff4785" },
  { id: 11, company: "Chili Piper",    role: "Outbound SDR",          location: "Remote",           status: "assessment", date: "2026-05-13", time: "09:00", salary: "$75k",  source: "Built In",  link: "", color: "#e74c3c" },
  { id: 12, company: "Clari",          role: "SDR",                   location: "Remote",           status: "saved",      date: "2026-05-11", time: "",      salary: "$72k",  source: "Wellfound", link: "", color: "#00b3a4" },
];

const STATUS_LABEL = { saved: "Saved", applied: "Applied", interview: "Interview", assessment: "Assessment", offer: "Offer", rejected: "Rejected" };
const STATUS_ORDER = ["applied", "interview", "assessment", "offer", "rejected"];

const state = { apps: load(), filter: "all", query: "", sort: "date-desc", view: "applications", calAnchor: startOfWeek(new Date()) };

function load() { try { const raw = localStorage.getItem("jobstacking.apps"); if (raw) return JSON.parse(raw); } catch (e) {} return [...SEED]; }
function save() { try { localStorage.setItem("jobstacking.apps", JSON.stringify(state.apps)); } catch (e) {} }

function initials(name) { return (name || "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase(); }
function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return iso; return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function relativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff === -1) return "Tomorrow";
  if (diff < 0) return `in ${-diff}d`;
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff/7)}w ago`;
  return `${Math.floor(diff/30)}mo ago`;
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
function startOfWeek(d) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isoDate(d) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const day = String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function isSameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function setView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach(v => { v.hidden = v.dataset.view !== name; });
  document.querySelectorAll(".nav-item").forEach(n => { n.classList.toggle("active", n.dataset.route === name); });
  if (name === "calendar") renderCalendar();
  if (name === "analytics") renderAnalytics();
}

function counts() { const c = { all: state.apps.length }; for (const r of state.apps) c[r.status] = (c[r.status] || 0) + 1; return c; }

function renderStats() {
  const c = counts();
  const inProgress = (c.applied || 0) + (c.interview || 0) + (c.assessment || 0);
  const cards = [
    { label: "Total",       value: c.all || 0,       delta: `${c.applied || 0} applied`,            tone: "neutral" },
    { label: "In Progress", value: inProgress,       delta: `${c.assessment || 0} assessments`,     tone: "up" },
    { label: "Interviews",  value: c.interview || 0, delta: upcomingInterviewsCount() + " upcoming",tone: "up" },
    { label: "Offers",      value: c.offer || 0,     delta: (c.offer ? "▲ keep going" : "—"), tone: "up" },
    { label: "Rejected",    value: c.rejected || 0,  delta: "noise filter",                         tone: "down" },
  ];
  document.getElementById("stats").innerHTML = cards.map(s => `<div class="stat-card"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div><div class="stat-delta ${s.tone}">${escapeHtml(s.delta)}</div></div>`).join("");
}

function upcomingInterviewsCount() {
  const today = new Date(); today.setHours(0,0,0,0);
  return state.apps.filter(a => (a.status === "interview" || a.status === "assessment") && a.date && new Date(a.date + "T00:00:00") >= today).length;
}

function filtered() {
  let rows = state.apps.slice();
  if (state.filter !== "all") rows = rows.filter(r => r.status === state.filter);
  if (state.query) { const q = state.query.toLowerCase(); rows = rows.filter(r => r.company.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || (r.location || "").toLowerCase().includes(q)); }
  switch (state.sort) {
    case "date-asc": rows.sort((a,b) => (a.date||"").localeCompare(b.date||"")); break;
    case "company":  rows.sort((a,b) => a.company.localeCompare(b.company)); break;
    case "role":     rows.sort((a,b) => a.role.localeCompare(b.role)); break;
    default:         rows.sort((a,b) => (b.date||"").localeCompare(a.date||""));
  }
  return rows;
}

function renderTable() {
  const rows = filtered();
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><input type="checkbox" class="row-check" /></td>
      <td><div class="company-cell"><div class="company-logo" style="background:${r.color || '#4f46e5'}">${initials(r.company)}</div><div><div class="company-name">${escapeHtml(r.company)}</div><div class="company-tag">${escapeHtml(r.source || '')}</div></div></div></td>
      <td>${escapeHtml(r.role)}</td>
      <td>${escapeHtml(r.location || '—')}</td>
      <td><span class="status-pill status-${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td><div>${fmtDate(r.date)}</div><div class="company-tag">${relativeDate(r.date)}${r.time ? " · " + escapeHtml(r.time) : ""}</div></td>
      <td>${escapeHtml(r.salary || '—')}</td>
      <td>${escapeHtml(r.source || '—')}</td>
      <td><div class="row-actions">${r.link ? `<a class="row-btn" href="${escapeHtml(r.link)}" target="_blank" rel="noopener">Open</a>` : ""}<button class="row-btn" data-action="edit">Edit</button><button class="row-btn danger" data-action="delete">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="9" style="padding:40px;text-align:center;color:var(--text-muted)">No applications match your filters.</td></tr>`;
  document.getElementById("shownCount").textContent = rows.length;
  document.getElementById("totalCount").textContent = state.apps.length;
}

function renderTabs() {
  const c = counts();
  document.querySelectorAll("#tabs .tab").forEach(tab => { const key = tab.dataset.status; const el = tab.querySelector(".count"); if (el) el.textContent = c[key] || 0; });
}
function renderSidebarCounts() { document.getElementById("navAppCount").textContent = state.apps.length; document.getElementById("navCalCount").textContent = upcomingInterviewsCount(); }
function renderApplications() { renderStats(); renderTabs(); renderTable(); renderSidebarCounts(); }

const PRESETS = {
  "sdr-70":   { role: "SDR", salary: 70000, location: "Remote", remote: true },
  "bdr-75":   { role: "BDR", salary: 75000, location: "Remote", remote: true },
  "ae-100":   { role: "Account Executive", salary: 100000, location: "Remote", remote: true },
  "sdr-saas": { role: "SaaS SDR", salary: 80000, location: "Remote", remote: true },
};
function getSearchFields() { return { role: document.getElementById("sbRole").value.trim(), salary: Number(document.getElementById("sbSalary").value) || 0, location: document.getElementById("sbLocation").value.trim(), remote: document.getElementById("sbRemote").checked }; }
function buildSearchUrls() {
  const f = getSearchFields();
  const roleQ = encodeURIComponent(f.role);
  const locQ = encodeURIComponent(f.remote ? "Remote" : f.location);
  const salaryQ = encodeURIComponent(`${f.role} $${(f.salary || 0).toLocaleString()}`);
  const indeed = `https://www.indeed.com/jobs?q=${salaryQ}&l=${locQ}${f.remote ? "&sc=0kf%3Aattr%28DSQF7%29%3B" : ""}`;
  const wellfound = `https://wellfound.com/jobs?keywords=${roleQ}${f.remote ? "&remote=true" : ""}`;
  const builtin = `https://builtin.com/jobs?search=${roleQ}`;
  return { indeed, wellfound, builtin };
}
function refreshSearchLinks() { const u = buildSearchUrls(); document.getElementById("goIndeed").href = u.indeed; document.getElementById("goWellfound").href = u.wellfound; document.getElementById("goBuiltIn").href = u.builtin; }
function applyPreset(key) { const p = PRESETS[key]; if (!p) return; document.getElementById("sbRole").value = p.role; document.getElementById("sbSalary").value = p.salary; document.getElementById("sbLocation").value = p.location; document.getElementById("sbRemote").checked = p.remote; refreshSearchLinks(); }

function renderCalendar() {
  const cal = document.getElementById("calendar");
  const start = state.calAnchor;
  const end = addDays(start, 6);
  document.getElementById("calRangeLabel").textContent = `${start.toLocaleDateString(undefined,{month:"short",day:"numeric"})} – ${end.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}`;
  const today = new Date(); today.setHours(0,0,0,0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const items = state.apps.filter(a => (a.status === "interview" || a.status === "assessment") && a.date === isoDate(d)).sort((a,b) => (a.time||"").localeCompare(b.time||""));
    days.push(`<div class="cal-day ${isSameDay(d,today) ? "today" : ""}"><div class="cal-day-head"><span class="cal-dow">${d.toLocaleDateString(undefined,{weekday:"short"})}</span><span class="cal-num">${d.getDate()}</span></div><div class="cal-events">${items.map(it => `<div class="cal-event ev-${it.status}"><div class="ev-time">${escapeHtml(it.time || "All day")}</div><div class="ev-title">${escapeHtml(it.company)}</div><div class="ev-sub">${escapeHtml(it.role)}</div></div>`).join("") || `<div class="cal-empty">—</div>`}</div></div>`);
  }
  cal.innerHTML = days.join("");
  const todayItems = state.apps.filter(a => (a.status === "interview" || a.status === "assessment") && a.date === isoDate(today)).sort((a,b) => (a.time||"").localeCompare(b.time||""));
  document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  document.getElementById("todayList").innerHTML = todayItems.length ? todayItems.map(it => `<li><span class="t-time">${escapeHtml(it.time || "—")}</span><span class="status-pill status-${it.status}">${STATUS_LABEL[it.status]}</span><span class="t-title"><strong>${escapeHtml(it.company)}</strong> · ${escapeHtml(it.role)}</span><span class="t-loc">${escapeHtml(it.location || "")}</span></li>`).join("") : `<li class="cal-empty">Nothing scheduled today.</li>`;
}

function renderAnalytics() {
  const c = counts();
  const funnelSteps = STATUS_ORDER.map(k => ({ key: k, label: STATUS_LABEL[k], n: c[k] || 0 }));
  const max = Math.max(1, ...funnelSteps.map(s => s.n));
  document.getElementById("funnel").innerHTML = funnelSteps.map(s => `<div class="funnel-row"><div class="funnel-label">${s.label}</div><div class="funnel-bar"><div class="funnel-fill st-${s.key}" style="width:${(s.n/max)*100}%"></div></div><div class="funnel-num">${s.n}</div></div>`).join("");
  const weeks = [];
  const start = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(start, -i * 7);
    const we = addDays(ws, 6);
    const n = state.apps.filter(a => a.date && a.date >= isoDate(ws) && a.date <= isoDate(we)).length;
    weeks.push({ label: ws.toLocaleDateString(undefined,{month:"short",day:"numeric"}), n });
  }
  const wMax = Math.max(1, ...weeks.map(w => w.n));
  document.getElementById("bars").innerHTML = weeks.map(w => `<div class="bar"><div class="bar-fill" style="height:${(w.n/wMax)*100}%"></div><div class="bar-label">${w.label}</div><div class="bar-num">${w.n}</div></div>`).join("");
}

const modal = document.getElementById("modal");
const form = document.getElementById("appForm");
function openModal(app) {
  form.reset();
  document.getElementById("modalTitle").textContent = app ? "Edit Application" : "New Application";
  if (app) { for (const [k, v] of Object.entries(app)) { if (form.elements[k]) form.elements[k].value = v ?? ""; } }
  else { form.elements.date.value = isoDate(new Date()); }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const id = fd.get("id");
  const palette = ["#4f46e5","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6"];
  const data = { company: fd.get("company"), role: fd.get("role"), location: fd.get("location") || "", status: fd.get("status") || "applied", date: fd.get("date") || isoDate(new Date()), time: fd.get("time") || "", salary: fd.get("salary") || "", source: fd.get("source") || "", link: fd.get("link") || "" };
  if (id) { const idx = state.apps.findIndex(a => a.id === Number(id)); if (idx >= 0) state.apps[idx] = { ...state.apps[idx], ...data }; }
  else { state.apps.unshift({ id: Date.now(), color: palette[Math.floor(Math.random() * palette.length)], ...data }); }
  save(); closeModal(); renderApplications();
});

function bind() {
  document.querySelectorAll(".nav-item").forEach(item => { item.addEventListener("click", (e) => { e.preventDefault(); setView(item.dataset.route); }); });
  document.getElementById("tabs").addEventListener("click", (e) => { const btn = e.target.closest(".tab"); if (!btn) return; document.querySelectorAll("#tabs .tab").forEach(t => t.classList.remove("active")); btn.classList.add("active"); state.filter = btn.dataset.status; renderTable(); });
  document.getElementById("search").addEventListener("input", (e) => { state.query = e.target.value.trim(); renderTable(); });
  document.getElementById("sortBy").addEventListener("change", (e) => { state.sort = e.target.value; renderTable(); });
  document.getElementById("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest(".row-btn[data-action]");
    if (!btn) return;
    const tr = e.target.closest("tr");
    const id = Number(tr.dataset.id);
    if (btn.dataset.action === "delete") { if (!confirm("Delete this application?")) return; state.apps = state.apps.filter(a => a.id !== id); save(); renderApplications(); }
    else if (btn.dataset.action === "edit") { const app = state.apps.find(a => a.id === id); if (app) openModal(app); }
  });
  document.getElementById("selectAll").addEventListener("change", (e) => { document.querySelectorAll(".row-check").forEach(c => { c.checked = e.target.checked; }); });
  document.getElementById("addBtn").addEventListener("click", () => openModal());
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("cancelModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  ["sbRole","sbSalary","sbLocation","sbRemote"].forEach(id => { document.getElementById(id).addEventListener("input", refreshSearchLinks); document.getElementById(id).addEventListener("change", refreshSearchLinks); });
  document.querySelectorAll(".chip[data-preset]").forEach(btn => { btn.addEventListener("click", () => applyPreset(btn.dataset.preset)); });
  document.getElementById("qaSave").addEventListener("click", () => {
    const company = document.getElementById("qaCompany").value.trim();
    if (!company) { alert("Company is required."); return; }
    const palette = ["#4f46e5","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
    state.apps.unshift({ id: Date.now(), company, role: document.getElementById("qaRole").value.trim() || "SDR", location: document.getElementById("qaLocation").value.trim() || "Remote", status: "applied", date: isoDate(new Date()), time: "", salary: document.getElementById("qaSalary").value.trim(), source: "Job Search", link: document.getElementById("qaLink").value.trim(), color: palette[Math.floor(Math.random() * palette.length)] });
    save(); renderApplications();
    document.getElementById("qaCompany").value = ""; document.getElementById("qaLink").value = "";
    setView("applications");
  });
  document.getElementById("calPrev").addEventListener("click", () => { state.calAnchor = addDays(state.calAnchor, -7); renderCalendar(); });
  document.getElementById("calNext").addEventListener("click", () => { state.calAnchor = addDays(state.calAnchor, 7); renderCalendar(); });
  document.getElementById("calToday").addEventListener("click", () => { state.calAnchor = startOfWeek(new Date()); renderCalendar(); });
  document.getElementById("exportBtn").addEventListener("click", exportCsv);
  document.getElementById("exportJson").addEventListener("click", exportJson);
  document.getElementById("importJsonBtn").addEventListener("click", () => document.getElementById("importJson").click());
  document.getElementById("importJson").addEventListener("change", importJson);
  document.getElementById("resetData").addEventListener("click", () => { if (!confirm("Reset to sample data? This wipes your current list.")) return; state.apps = [...SEED]; save(); renderApplications(); });
}

function downloadFile(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function exportCsv() { const cols = ["company","role","location","status","date","time","salary","source","link"]; const head = cols.join(","); const body = state.apps.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g,'""')}"`).join(",")).join("\n"); downloadFile("jobstacking.csv", head + "\n" + body, "text/csv"); }
function exportJson() { downloadFile("jobstacking.json", JSON.stringify(state.apps, null, 2), "application/json"); }
function importJson(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { const data = JSON.parse(reader.result); if (!Array.isArray(data)) throw new Error("Expected an array"); state.apps = data; save(); renderApplications(); alert(`Imported ${data.length} applications.`); } catch (err) { alert("Import failed: " + err.message); } };
  reader.readAsText(file); e.target.value = "";
}

bind(); renderApplications(); refreshSearchLinks();
