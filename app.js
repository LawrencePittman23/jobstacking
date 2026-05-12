// Sample seed data for the dashboard
const SEED = [
  { id: 1,  company: "Stripe",      role: "Senior Frontend Engineer", location: "Remote (US)",        status: "interview", date: "2026-05-08", salary: "$185k", source: "LinkedIn",   color: "#635bff" },
  { id: 2,  company: "Linear",      role: "Product Engineer",         location: "San Francisco, CA",  status: "applied",   date: "2026-05-07", salary: "$170k", source: "Referral",   color: "#5e6ad2" },
  { id: 3,  company: "Vercel",      role: "Staff Engineer, DX",       location: "Remote",             status: "offer",     date: "2026-04-28", salary: "$220k", source: "Direct",     color: "#000000" },
  { id: 4,  company: "Notion",      role: "Full-Stack Engineer",      location: "New York, NY",       status: "interview", date: "2026-05-02", salary: "$165k", source: "LinkedIn",   color: "#1a1a1a" },
  { id: 5,  company: "Figma",       role: "Design Engineer",          location: "Remote",             status: "rejected",  date: "2026-04-20", salary: "$160k", source: "Website",    color: "#f24e1e" },
  { id: 6,  company: "Airbnb",      role: "Software Engineer II",     location: "Seattle, WA",        status: "applied",   date: "2026-05-05", salary: "$175k", source: "LinkedIn",   color: "#ff5a5f" },
  { id: 7,  company: "Datadog",     role: "Backend Engineer",         location: "Boston, MA",         status: "interview", date: "2026-05-01", salary: "$180k", source: "Recruiter",  color: "#632ca6" },
  { id: 8,  company: "Shopify",     role: "Frontend Developer",       location: "Remote (Canada)",    status: "applied",   date: "2026-05-09", salary: "$155k", source: "LinkedIn",   color: "#95bf47" },
  { id: 9,  company: "GitHub",      role: "Senior Engineer, Actions", location: "Remote",             status: "rejected",  date: "2026-04-15", salary: "$190k", source: "Referral",   color: "#24292f" },
  { id: 10, company: "Cloudflare",  role: "Systems Engineer",         location: "Austin, TX",         status: "applied",   date: "2026-05-10", salary: "$170k", source: "Website",    color: "#f6821f" },
  { id: 11, company: "Plaid",       role: "Platform Engineer",        location: "Remote",             status: "rejected",  date: "2026-04-12", salary: "$172k", source: "LinkedIn",   color: "#0a85ea" },
  { id: 12, company: "Discord",     role: "Client Engineer",          location: "San Francisco, CA",  status: "saved",     date: "2026-05-11", salary: "$168k", source: "Website",    color: "#5865f2" },
];

const STATUS_LABEL = {
  applied:   "Applied",
  interview: "Interview",
  offer:     "Offer",
  rejected:  "Rejected",
  saved:     "Saved",
};

const state = {
  apps: load(),
  filter: "all",
  query: "",
  sort: "date-desc",
};

function load() {
  try {
    const raw = localStorage.getItem("jobstacking.apps");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [...SEED];
}

function save() {
  try { localStorage.setItem("jobstacking.apps", JSON.stringify(state.apps)); } catch (e) {}
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function relativeDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)   return `${diff}d ago`;
  if (diff < 30)  return `${Math.floor(diff/7)}w ago`;
  return `${Math.floor(diff/30)}mo ago`;
}

function filtered() {
  let rows = state.apps.slice();
  if (state.filter !== "all") rows = rows.filter(r => r.status === state.filter);
  if (state.query) {
    const q = state.query.toLowerCase();
    rows = rows.filter(r =>
      r.company.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      (r.location || "").toLowerCase().includes(q)
    );
  }
  switch (state.sort) {
    case "date-asc":  rows.sort((a, b) => a.date.localeCompare(b.date)); break;
    case "company":   rows.sort((a, b) => a.company.localeCompare(b.company)); break;
    case "role":      rows.sort((a, b) => a.role.localeCompare(b.role)); break;
    default:          rows.sort((a, b) => b.date.localeCompare(a.date));
  }
  return rows;
}

function render() {
  const rows = filtered();
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><input type="checkbox" class="row-check" /></td>
      <td>
        <div class="company-cell">
          <div class="company-logo" style="background:${r.color || '#4f46e5'}">${initials(r.company)}</div>
          <div>
            <div class="company-name">${escapeHtml(r.company)}</div>
            <div class="company-tag">${escapeHtml(r.source || '')}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(r.role)}</td>
      <td>${escapeHtml(r.location || '—')}</td>
      <td><span class="status-pill status-${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
      <td>
        <div>${fmtDate(r.date)}</div>
        <div class="company-tag">${relativeDate(r.date)}</div>
      </td>
      <td>${escapeHtml(r.salary || '—')}</td>
      <td>${escapeHtml(r.source || '—')}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" data-action="view">View</button>
          <button class="row-btn danger" data-action="delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="9" style="padding:40px;text-align:center;color:var(--text-muted)">No applications match your filters.</td></tr>`;

  document.getElementById("shownCount").textContent = rows.length;
  document.getElementById("totalCount").textContent = state.apps.length;

  updateTabCounts();
}

function updateTabCounts() {
  const counts = { all: state.apps.length };
  for (const r of state.apps) counts[r.status] = (counts[r.status] || 0) + 1;
  document.querySelectorAll("#tabs .tab").forEach(tab => {
    const key = tab.dataset.status;
    const c = tab.querySelector(".count");
    if (c) c.textContent = counts[key] || 0;
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

/* ===== Events ===== */
document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll("#tabs .tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  state.filter = btn.dataset.status;
  render();
});

document.getElementById("search").addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  render();
});

document.getElementById("sortBy").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

document.getElementById("tbody").addEventListener("click", (e) => {
  const btn = e.target.closest(".row-btn");
  if (!btn) return;
  const tr = e.target.closest("tr");
  const id = Number(tr.dataset.id);
  if (btn.dataset.action === "delete") {
    state.apps = state.apps.filter(a => a.id !== id);
    save();
    render();
  } else if (btn.dataset.action === "view") {
    const app = state.apps.find(a => a.id === id);
    if (app) alert(`${app.company} — ${app.role}\nStatus: ${STATUS_LABEL[app.status]}\nApplied: ${fmtDate(app.date)}\nSalary: ${app.salary}\nLocation: ${app.location}`);
  }
});

document.getElementById("selectAll").addEventListener("change", (e) => {
  document.querySelectorAll(".row-check").forEach(c => { c.checked = e.target.checked; });
});

/* ===== Sidebar nav (visual only) ===== */
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", (e) => {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    item.classList.add("active");
  });
});

/* ===== Modal ===== */
const modal = document.getElementById("modal");
const form = document.getElementById("appForm");

function openModal() {
  form.reset();
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }

document.getElementById("addBtn").addEventListener("click", openModal);
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelModal").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const palette = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
  const next = {
    id: Date.now(),
    company: fd.get("company"),
    role: fd.get("role"),
    location: fd.get("location") || "",
    status: fd.get("status") || "applied",
    date: fd.get("date") || new Date().toISOString().slice(0, 10),
    salary: fd.get("salary") || "",
    source: fd.get("source") || "",
    color: palette[Math.floor(Math.random() * palette.length)],
  };
  state.apps.unshift(next);
  save();
  closeModal();
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

render();
