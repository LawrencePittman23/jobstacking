(() => {
  if (window.__jobstackingFillerLoaded) return;
  window.__jobstackingFillerLoaded = true;

  // --- Field detection rules ----------------------------------------------
  // Each rule maps a profile key to a list of regex patterns matched against
  // the input's name, id, autocomplete, placeholder, aria-label, and the
  // text of its <label>. First match wins.
  const RULES = [
    { key: "firstName",      patterns: [/\bfirst[\s_-]?name\b/i, /\bgiven[\s_-]?name\b/i, /first$/i] },
    { key: "lastName",       patterns: [/\blast[\s_-]?name\b/i, /\bfamily[\s_-]?name\b/i, /\bsurname\b/i, /last$/i] },
    { key: "fullName",       patterns: [/\bfull[\s_-]?name\b/i, /\byour[\s_-]?name\b/i, /^name$/i] },
    { key: "email",          patterns: [/\bemail\b/i, /e[-_]?mail/i] },
    { key: "phone",          patterns: [/\bphone\b/i, /\btelephone\b/i, /\bmobile\b/i, /\bcell\b/i] },
    { key: "city",           patterns: [/\bcity\b/i, /current[\s_-]?location/i, /\btown\b/i] },
    { key: "state",          patterns: [/\bstate\b/i, /\bregion\b/i, /\bprovince\b/i] },
    { key: "postalCode",     patterns: [/\b(zip|postal)([\s_-]?code)?\b/i] },
    { key: "country",        patterns: [/\bcountry\b/i] },
    { key: "street",         patterns: [/\b(street|address(?:[\s_-]?line[\s_-]?1)?)\b/i, /address1/i] },
    { key: "linkedin",       patterns: [/\blinkedin\b/i, /linked[\s_-]?in/i] },
    { key: "github",         patterns: [/\bgithub\b/i] },
    { key: "website",        patterns: [/\b(website|portfolio|personal[\s_-]?site|url)\b/i] },
    { key: "workAuth",       patterns: [/legally[\s_-]?authorized/i, /authorized[\s_-]?to[\s_-]?work/i, /work[\s_-]?authorization/i, /eligible[\s_-]?to[\s_-]?work/i] },
    { key: "sponsorship",    patterns: [/sponsor[a-z]*/i, /visa[\s_-]?sponsorship/i, /require[\s_-]?sponsorship/i] },
    { key: "yearsExperience",patterns: [/years?[\s_-]?of[\s_-]?experience/i, /\byrs?[\s_-]?exp\b/i] },
    { key: "gender",         patterns: [/\bgender\b/i] },
    { key: "race",           patterns: [/\b(race|ethnicity)\b/i, /race[\s_-]?(?:and|or)?[\s_-]?ethnicity/i] },
    { key: "veteran",        patterns: [/\bveteran\b/i] },
    { key: "disability",     patterns: [/\bdisabilit/i] },
    { key: "coverLetter",    patterns: [/cover[\s_-]?letter/i, /why.*(interest|role|company|position)/i, /tell[\s_-]?us[\s_-]?(?:about|why)/i, /additional[\s_-]?(info|information)/i] },
  ];

  // Map a single profile to all aliases. fullName is computed from first+last
  // if missing. Some forms use only one field, others split.
  function expandProfile(p) {
    const out = { ...p };
    if (!out.fullName && (out.firstName || out.lastName)) {
      out.fullName = `${out.firstName || ""} ${out.lastName || ""}`.trim();
    }
    return out;
  }

  function getLabelText(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.innerText || lbl.textContent || "";
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.innerText || parentLabel.textContent || "";
    // Heuristic: look up the DOM for adjacent label-ish text
    let prev = el.previousElementSibling;
    while (prev && !/h[1-6]|p|div|span|label/i.test(prev.tagName)) prev = prev.previousElementSibling;
    if (prev && (prev.tagName.toLowerCase() === "label" || /label/i.test(prev.className))) {
      return prev.innerText || prev.textContent || "";
    }
    return "";
  }

  function describe(el) {
    const parts = [
      el.name || "",
      el.id || "",
      el.getAttribute("autocomplete") || "",
      el.placeholder || "",
      el.getAttribute("aria-label") || "",
      getLabelText(el),
    ];
    return parts.join(" ");
  }

  function detectKey(el) {
    const desc = describe(el);
    for (const rule of RULES) {
      if (rule.patterns.some((re) => re.test(desc))) return rule.key;
    }
    return null;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(el, value) {
    if (!value) return false;
    const v = String(value).toLowerCase().trim();
    const opts = Array.from(el.options);
    // exact match, then contains, then startsWith
    const exact = opts.find((o) => o.value.toLowerCase() === v || o.text.toLowerCase().trim() === v);
    const partial = exact || opts.find((o) => o.text.toLowerCase().includes(v) || o.value.toLowerCase().includes(v));
    if (!partial) return false;
    el.value = partial.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillRadioGroup(name, value) {
    if (!name || !value) return false;
    const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
    const v = String(value).toLowerCase().trim();
    for (const r of radios) {
      const lbl = getLabelText(r).toLowerCase();
      if (r.value.toLowerCase() === v || lbl.includes(v)) {
        r.checked = true;
        r.dispatchEvent(new Event("change", { bubbles: true }));
        r.dispatchEvent(new Event("click", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function fillCheckbox(el, value) {
    const want = /^(yes|true|1|on|checked)$/i.test(String(value));
    if (el.checked !== want) el.click();
    return true;
  }

  function fillForm(profile) {
    const p = expandProfile(profile);
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    let filled = 0;
    const seenRadioGroups = new Set();
    for (const el of inputs) {
      // Skip hidden / disabled / readonly / file inputs
      if (el.disabled || el.readOnly) continue;
      if (el.type === "hidden" || el.type === "file" || el.type === "submit" || el.type === "button" || el.type === "password") continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const key = detectKey(el);
      if (!key) continue;
      const value = p[key];
      if (value == null || value === "") continue;

      try {
        if (el.tagName === "SELECT") {
          if (fillSelect(el, value)) filled++;
        } else if (el.type === "radio") {
          if (seenRadioGroups.has(el.name)) continue;
          seenRadioGroups.add(el.name);
          if (fillRadioGroup(el.name, value)) filled++;
        } else if (el.type === "checkbox") {
          if (fillCheckbox(el, value)) filled++;
        } else {
          setNativeValue(el, String(value));
          filled++;
        }
      } catch {}
    }
    return filled;
  }

  async function fill() {
    const data = await chrome.storage.sync.get("profile");
    if (!data.profile) {
      showToast("No profile saved. Open the extension and add yours.", true);
      return 0;
    }
    const n = fillForm(data.profile);
    showToast(n > 0 ? `✨ Filled ${n} field${n === 1 ? "" : "s"}` : "No matching fields found on this page.", n === 0);
    return n;
  }

  function showToast(msg, isError) {
    let t = document.getElementById("__js-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__js-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = isError ? "__js-toast __js-error" : "__js-toast";
    t.style.opacity = "1";
    setTimeout(() => { t.style.opacity = "0"; }, 2400);
  }

  // Detect application-form pages and show a floating Fill button.
  function hasApplicationForm() {
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
    const real = inputs.filter((el) => el.type !== "hidden" && el.type !== "submit" && el.type !== "button");
    if (real.length < 3) return false;
    // Need at least an email-like field somewhere
    return real.some((el) => /email/i.test(describe(el)));
  }

  function mountButton() {
    if (document.getElementById("__js-fill-btn")) return;
    if (!hasApplicationForm()) return;
    const btn = document.createElement("button");
    btn.id = "__js-fill-btn";
    btn.type = "button";
    btn.innerHTML = "<span>✨</span> JS Fill";
    btn.title = "Fill this form from your JobStacking profile (Alt+J)";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fill();
    });
    document.body.appendChild(btn);
  }

  // Re-check after dynamic loads (React/Vue ATSes)
  const obs = new MutationObserver(() => mountButton());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  mountButton();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "jobstacking:fill") {
      fill().then((filled) => sendResponse({ filled })).catch(() => sendResponse({ filled: 0 }));
      return true;
    }
  });
})();
