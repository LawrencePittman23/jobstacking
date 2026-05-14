# JobStacking Autofill — Chrome Extension

One-click autofill for job application forms. Detects common fields (name, email, phone, location, LinkedIn, work authorization, EEO, cover letter) on Greenhouse, Lever, Ashby, Workday, and most other ATS forms.

## Install (1 minute)

1. Download or clone this folder to your computer.
2. In Chrome (or Edge / Brave / Arc), open `chrome://extensions/`
3. Toggle **Developer mode** on (top-right corner)
4. Click **Load unpacked**
5. Select the `extension/` folder from this repo
6. A small puzzle-piece-style extension appears — click the puzzle icon in Chrome's toolbar and **pin** JobStacking Autofill

## Setup (30 seconds)

1. Click the pinned JobStacking icon → popup opens
2. Fill out your profile fields:
   - First name / Last name
   - Email, phone
   - City, state, ZIP, street, country
   - LinkedIn URL, portfolio, GitHub
   - Work authorization (Yes / No)
   - Years of experience
   - EEO fields if you want them autofilled (race, gender, veteran, disability)
   - Optional: paste a default cover letter snippet
3. Click **Save profile**

Your profile is stored in Chrome's sync storage — it follows you across Chrome installs if you're signed in.

## Usage

On any job application page:

- **Click** the floating **✨ JS Fill** button in the bottom-right corner
  *or*
- Press **Alt + J** (keyboard shortcut)
  *or*
- Open the extension popup and click **✨ Fill form on this page**

The extension scans the page for input/textarea/select fields, matches them against your profile, and fills everything it recognizes. A toast confirms how many fields were filled.

## What it fills

- First / Last / Full name
- Email
- Phone
- City, State, ZIP, Country, Street address
- LinkedIn, Portfolio/Website, GitHub
- Years of experience
- Work authorization (Yes/No → mapped to dropdown or radio)
- Sponsorship requirement (Yes/No)
- EEO: Gender, Race / Ethnicity, Veteran status, Disability status
- Cover letter / "Why this role" / additional info textarea

## What it won't fill

- Resume PDF upload (browsers block programmatic file selection — still manual)
- Questions specific to one role ("What excites you about Stripe?")
- Multi-step / wizard forms beyond the first page
- Forms inside an iframe that the extension can't reach

## Privacy

- Profile data lives in Chrome's `chrome.storage.sync` — synced through your Google account, never sent to JobStacking servers.
- No data is sent to any external service.
- The content script runs on every page (`<all_urls>`) but only writes to fields when you click Fill.

## Updating the extension

When you pull new code from this repo:

1. Go to `chrome://extensions/`
2. Find **JobStacking Autofill**
3. Click the **refresh / reload** icon on its card

## Troubleshooting

- **"No matching fields found"** — The page uses unusual field names. Open DevTools, inspect a field, and let me know the `name`/`id`/label so I can add a rule.
- **Fill button doesn't appear** — The page might not have a recognizable form. Try clicking the extension icon → **✨ Fill form on this page** as a fallback.
- **Filled the wrong value** — Field detection is heuristic. Open the popup, double-check your saved profile values, and re-fill.
- **React forms reset after fill** — Some ATSes (especially Workday) use complex state machines. Fill again after the page settles, or fill field-by-field manually.
