# JobStacking — Setup Guide

This walks you through deploying JobStacking with real Gmail sync. Total time: ~30–45 min, mostly waiting.

You'll do four things:
1. **Google Cloud** — create OAuth credentials so the app can read your Gmail.
2. **Vercel** — host the app and create a Postgres database.
3. **Connect them** — paste credentials into Vercel env vars.
4. **First sign in + sync.**

---

## 1. Google Cloud Console

### 1a. Create a project
- Go to https://console.cloud.google.com/
- Top bar → project dropdown → **New Project**.
- Name: `JobStacking`. Click **Create**. Wait for it to finish, then select the project.

### 1b. Enable the Gmail API
- Search bar (top) → type `Gmail API` → click the result.
- Click **Enable**. Wait ~10 seconds.

### 1c. Configure OAuth consent screen
- Left nav → **APIs & Services** → **OAuth consent screen**.
- **User Type**: **External** → **Create**.
- Fill the required fields:
  - **App name**: `JobStacking`
  - **User support email**: your email
  - **Developer contact**: your email
- Click **Save and continue**.
- **Scopes** → **Add or remove scopes** → search `gmail.readonly` → check **`.../auth/gmail.readonly`** → **Update** → **Save and continue**.
- **Test users** → **Add users** → add your own Gmail address → **Save and continue**.
- Click **Back to dashboard**. You can leave it in "Testing" status — that's fine for personal use (up to 100 test users, no Google review needed).

### 1d. Create OAuth client credentials
- Left nav → **APIs & Services** → **Credentials**.
- **Create credentials** → **OAuth client ID**.
- **Application type**: **Web application**.
- **Name**: `JobStacking Web`.
- **Authorized redirect URIs** → **Add URI** → paste:
  ```
  https://YOUR-APP.vercel.app/api/auth/callback/google
  ```
  Use a placeholder for now — you'll come back and fix this after Vercel gives you the real domain.
- Click **Create**.
- A popup shows your **Client ID** and **Client secret**. **Copy both** to a notepad. (You can re-open this any time from the Credentials page.)

---

## 2. Vercel

### 2a. Connect the repo
- Go to https://vercel.com/new
- Sign in with GitHub.
- Find **`LawrencePittman23/jobstacking`** → **Import**.
- On the import screen:
  - **Framework Preset**: Next.js (auto-detected).
  - **Root Directory**: `./` (default).
  - Don't add env vars yet — click **Deploy**.
- First deploy will likely fail (missing env vars). That's expected.

### 2b. Note your Vercel URL
After the first deploy, Vercel shows your URL, something like:
```
https://jobstacking-xxxxx.vercel.app
```
Copy it.

### 2c. Update the Google redirect URI
- Back in Google Cloud → Credentials → click your OAuth client.
- Replace the placeholder URI with the real Vercel one:
  ```
  https://jobstacking-xxxxx.vercel.app/api/auth/callback/google
  ```
- Click **Save**.

### 2d. Create the Postgres database
- In your Vercel project → **Storage** tab → **Create Database** → **Postgres** → pick a region close to you → **Create**.
- Click **Connect Project** → select this project → it auto-adds the `POSTGRES_*` env vars.

### 2e. Add the rest of the env vars
- Vercel project → **Settings** → **Environment Variables**. Add each (Production + Preview + Development):

| Name | Value |
|---|---|
| `NEXTAUTH_URL` | `https://jobstacking-xxxxx.vercel.app` (your Vercel URL) |
| `NEXTAUTH_SECRET` | A random 32+ char string. Generate with `openssl rand -base64 32` or use https://generate-secret.vercel.app/32 |
| `GOOGLE_CLIENT_ID` | From step 1d |
| `GOOGLE_CLIENT_SECRET` | From step 1d |
| `CRON_SECRET` | Another random string (for the daily cron auth) |

### 2f. Redeploy
- **Deployments** tab → click the **...** on the latest deploy → **Redeploy** → confirm.
- Wait ~1 minute for the green check.

---

## 3. First sign-in

- Visit your Vercel URL.
- Click **Continue with Google**.
- Google shows a warning **"Google hasn't verified this app"** — that's normal for test-mode apps. Click **Advanced** → **Go to JobStacking (unsafe)**. (It's your own app; only your email is allowed.)
- Approve the Gmail read permission.
- You'll land in the dashboard.

## 4. First sync

- Click **Settings** (sidebar) → **Sync now**, OR click **↻ Sync Gmail** in the Applications top bar.
- It scans the last 60 days of emails, classifies application-related ones, and writes them to your tracker. Takes ~10–30s.
- After the first run, the app auto-syncs every 6 hours via cron.

---

## Troubleshooting

**"redirect_uri_mismatch" on sign-in** — The redirect URI in Google Cloud doesn't exactly match your Vercel URL. Fix in step 2c. Must include `/api/auth/callback/google` and use `https`.

**Sync returns 0 results** — Either no application emails in the last 60 days, OR the classifier missed them. You can:
- Manually add an application with "+ New".
- Tweak the keyword rules in `lib/classify.ts` and redeploy.

**"no refresh token; sign out and sign in again"** — Google didn't return a refresh token. This usually happens if you previously authorized the app and didn't re-consent. Sign out, then sign in again — the app forces `prompt: consent` to get a fresh refresh token.

**Cron isn't running** — Vercel cron is on Hobby tier; jobs run on a best-effort schedule. Check **Deployments → Cron Jobs** for run history. You can also hit `/api/cron/sync` manually with `Authorization: Bearer YOUR_CRON_SECRET`.

**Want to widen Gmail search** — Edit `GMAIL_QUERY` in `lib/gmail.ts` (e.g. `newer_than:90d`).

---

## Costs

All free for personal use:
- **Google Cloud**: $0 (Gmail API has a generous free quota).
- **Vercel Hobby**: $0 (covers small apps, includes cron + Postgres free tier).
- **Vercel Postgres free tier**: 60 hours of compute/month, plenty for this.
