# JobStacking

Job application tracker with Gmail auto-sync. Built with Next.js, Vercel Postgres, and the Gmail API.

## What it does

- **Auto-imports** Applied / Interview / Assessment / Offer / Rejected emails from your Gmail into a tracker.
- **Calendar view** of upcoming interviews and assessments.
- **Job Search builder** that launches pre-filtered searches on Indeed, Wellfound, and Built In.
- **Analytics** — funnel + weekly volume.
- **Daily auto-sync** via Vercel Cron (every 6 hours).

## Setup

See **[SETUP.md](./SETUP.md)** for the full Google Cloud + Vercel walkthrough.

## Stack

- Next.js 14 (App Router) on Vercel
- NextAuth.js with Google OAuth (Gmail readonly scope)
- Vercel Postgres
- googleapis (Gmail API)

## Local dev

```bash
cp .env.example .env.local
# fill in your values
npm install
npm run dev
```
