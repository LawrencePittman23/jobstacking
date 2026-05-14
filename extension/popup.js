const FIELDS = [
  "firstName","lastName","email","phone","city","state","postalCode","country","street",
  "linkedin","website","github",
  "workAuth","sponsorship","yearsExperience",
  "gender","race","veteran","disability",
  "coverLetter",
];

async function load() {
  const data = await chrome.storage.sync.get("profile");
  const p = data.profile || {};
  for (const f of FIELDS) {
    const el = document.querySelector(`[name="${f}"]`);
    if (el && p[f] != null) el.value = p[f];
  }
}

function collect() {
  const profile = {};
  for (const f of FIELDS) {
    const el = document.querySelector(`[name="${f}"]`);
    if (el) profile[f] = el.value;
  }
  return profile;
}

function setStatus(msg, isError) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = isError ? "status error" : "status";
  if (!isError && msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 2500);
}

document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  await chrome.storage.sync.set({ profile: collect() });
  setStatus("✓ Profile saved");
});

document.getElementById("fill").addEventListener("click", async () => {
  await chrome.storage.sync.set({ profile: collect() });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "jobstacking:fill" });
    if (res && typeof res.filled === "number") {
      setStatus(`✨ Filled ${res.filled} field${res.filled === 1 ? "" : "s"}`);
      if (res.filled === 0) setStatus("No matching fields found on this page.", true);
    } else {
      setStatus("Couldn't reach the page — reload it and try again.", true);
    }
  } catch (e) {
    setStatus("Reload the page first, then try Fill.", true);
  }
});

load();
