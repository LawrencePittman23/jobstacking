import { sql } from "@vercel/postgres";
import type { Application, Status, User } from "./types";

let initialized = false;
let profileInitialized = false;
let jobsCacheInitialized = false;
let timeSessionsInitialized = false;

export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      email           text PRIMARY KEY,
      refresh_token   text,
      last_sync_at    timestamptz,
      last_history_id text,
      created_at      timestamptz DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id          serial PRIMARY KEY,
      user_email  text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      company     text NOT NULL,
      role        text NOT NULL DEFAULT '',
      location    text,
      status      text NOT NULL DEFAULT 'applied',
      applied_at  date,
      event_time  text,
      salary      text,
      source      text,
      link        text,
      email_id    text,
      color       text,
      notes       text,
      created_at  timestamptz DEFAULT now(),
      updated_at  timestamptz DEFAULT now(),
      UNIQUE (user_email, email_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(user_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(user_email, status)`;
  initialized = true;
}

export async function ensureProfileSchema() {
  if (profileInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS user_profiles (
      email        text PRIMARY KEY,
      full_name    text,
      resume_text  text,
      background   text,
      updated_at   timestamptz DEFAULT now()
    )
  `;
  profileInitialized = true;
}

export async function ensureJobsCacheSchema() {
  if (jobsCacheInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS jobs_cache (
      key         text PRIMARY KEY,
      payload     jsonb NOT NULL,
      fetched_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  jobsCacheInitialized = true;
}

export async function ensureTimeSessionsSchema() {
  if (timeSessionsInitialized) return;
  // Make sure users table exists first since we FK to it.
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS time_sessions (
      id          serial PRIMARY KEY,
      user_email  text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      started_at  timestamptz NOT NULL,
      ended_at    timestamptz,
      notes       text,
      created_at  timestamptz DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_time_sessions_user_started ON time_sessions(user_email, started_at DESC)`;
  // Partial unique: at most one active session per user (no ended_at)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_sessions_active ON time_sessions(user_email) WHERE ended_at IS NULL`;
  timeSessionsInitialized = true;
}

export interface JobsCacheEntry {
  payload: any;
  fetched_at: string;
  age_minutes: number;
}

export async function getJobsCache(key: string): Promise<JobsCacheEntry | null> {
  await ensureJobsCacheSchema();
  const { rows } = await sql<{ payload: any; fetched_at: string; age_minutes: number }>`
    SELECT payload,
           fetched_at,
           EXTRACT(EPOCH FROM (now() - fetched_at)) / 60 AS age_minutes
    FROM jobs_cache WHERE key = ${key}
  `;
  return rows[0] ?? null;
}

export async function setJobsCache(key: string, payload: any) {
  await ensureJobsCacheSchema();
  await sql`
    INSERT INTO jobs_cache (key, payload, fetched_at)
    VALUES (${key}, ${JSON.stringify(payload)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET
      payload    = EXCLUDED.payload,
      fetched_at = now()
  `;
}

export interface Profile {
  email: string;
  full_name: string | null;
  resume_text: string | null;
  background: string | null;
  updated_at?: string;
}

export async function getProfile(email: string): Promise<Profile | null> {
  await ensureProfileSchema();
  const { rows } = await sql<Profile>`
    SELECT email, full_name, resume_text, background
    FROM user_profiles WHERE email = ${email}
  `;
  return rows[0] ?? null;
}

export async function upsertProfile(email: string, p: Partial<Profile>) {
  await ensureProfileSchema();
  await sql`
    INSERT INTO user_profiles (email, full_name, resume_text, background)
    VALUES (${email}, ${p.full_name ?? null}, ${p.resume_text ?? null}, ${p.background ?? null})
    ON CONFLICT (email) DO UPDATE SET
      full_name   = EXCLUDED.full_name,
      resume_text = EXCLUDED.resume_text,
      background  = EXCLUDED.background,
      updated_at  = now()
  `;
}

export async function upsertUser(email: string, refreshToken?: string | null) {
  await ensureSchema();
  if (refreshToken) {
    await sql`
      INSERT INTO users (email, refresh_token)
      VALUES (${email}, ${refreshToken})
      ON CONFLICT (email) DO UPDATE SET refresh_token = EXCLUDED.refresh_token
    `;
  } else {
    await sql`
      INSERT INTO users (email) VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `;
  }
}

export async function getUser(email: string): Promise<User | null> {
  await ensureSchema();
  const { rows } = await sql<User>`SELECT email, refresh_token, last_sync_at, last_history_id FROM users WHERE email = ${email}`;
  return rows[0] ?? null;
}

export async function setLastSync(email: string, at: Date) {
  await sql`UPDATE users SET last_sync_at = ${at.toISOString()} WHERE email = ${email}`;
}

export async function listApplications(email: string): Promise<Application[]> {
  await ensureSchema();
  const { rows } = await sql<Application>`
    SELECT id, user_email, company, role, location, status,
           to_char(applied_at, 'YYYY-MM-DD') AS applied_at,
           event_time, salary, source, link, email_id, color, notes
    FROM applications
    WHERE user_email = ${email}
    ORDER BY applied_at DESC NULLS LAST, id DESC
  `;
  return rows;
}

export interface AppInput {
  company: string;
  role?: string;
  location?: string;
  status?: Status;
  applied_at?: string | null;
  event_time?: string | null;
  salary?: string | null;
  source?: string | null;
  link?: string | null;
  email_id?: string | null;
  color?: string | null;
  notes?: string | null;
}

export async function createApplication(email: string, a: AppInput): Promise<Application> {
  await ensureSchema();
  const { rows } = await sql<Application>`
    INSERT INTO applications
      (user_email, company, role, location, status, applied_at, event_time, salary, source, link, email_id, color, notes)
    VALUES
      (${email}, ${a.company}, ${a.role ?? ""}, ${a.location ?? null}, ${a.status ?? "applied"},
       ${a.applied_at ?? null}, ${a.event_time ?? null}, ${a.salary ?? null}, ${a.source ?? null},
       ${a.link ?? null}, ${a.email_id ?? null}, ${a.color ?? null}, ${a.notes ?? null})
    RETURNING id, user_email, company, role, location, status,
              to_char(applied_at, 'YYYY-MM-DD') AS applied_at,
              event_time, salary, source, link, email_id, color, notes
  `;
  return rows[0];
}

export async function updateApplication(email: string, id: number, a: Partial<AppInput>): Promise<Application | null> {
  await ensureSchema();
  const { rows } = await sql<Application>`
    UPDATE applications SET
      company    = COALESCE(${a.company ?? null}, company),
      role       = COALESCE(${a.role ?? null}, role),
      location   = COALESCE(${a.location ?? null}, location),
      status     = COALESCE(${a.status ?? null}, status),
      applied_at = COALESCE(${a.applied_at ?? null}, applied_at),
      event_time = COALESCE(${a.event_time ?? null}, event_time),
      salary     = COALESCE(${a.salary ?? null}, salary),
      source     = COALESCE(${a.source ?? null}, source),
      link       = COALESCE(${a.link ?? null}, link),
      notes      = COALESCE(${a.notes ?? null}, notes),
      updated_at = now()
    WHERE id = ${id} AND user_email = ${email}
    RETURNING id, user_email, company, role, location, status,
              to_char(applied_at, 'YYYY-MM-DD') AS applied_at,
              event_time, salary, source, link, email_id, color, notes
  `;
  return rows[0] ?? null;
}

export async function deleteApplication(email: string, id: number) {
  await ensureSchema();
  await sql`DELETE FROM applications WHERE id = ${id} AND user_email = ${email}`;
}

export async function upsertFromEmail(email: string, a: AppInput & { email_id: string }) {
  await ensureSchema();
  await sql`
    INSERT INTO applications
      (user_email, company, role, location, status, applied_at, source, email_id, color)
    VALUES
      (${email}, ${a.company}, ${a.role ?? ""}, ${a.location ?? null},
       ${a.status ?? "applied"}, ${a.applied_at ?? null}, ${a.source ?? "Gmail"},
       ${a.email_id}, ${a.color ?? null})
    ON CONFLICT (user_email, email_id) DO UPDATE SET
      status = CASE
        WHEN ${rankWeight(a.status)} > ${rankWeight(undefined)}
        THEN EXCLUDED.status ELSE applications.status END,
      updated_at = now()
  `;
}

function rankWeight(s?: Status | string) {
  const order: Record<string, number> = { saved: 0, applied: 1, interview: 2, assessment: 2, offer: 3, rejected: 0 };
  return s ? order[s] ?? 0 : 0;
}

export async function listAllUsersWithRefreshTokens(): Promise<User[]> {
  await ensureSchema();
  const { rows } = await sql<User>`SELECT email, refresh_token, last_sync_at, last_history_id FROM users WHERE refresh_token IS NOT NULL`;
  return rows;
}

// === Time tracking sessions ===

export interface TimeSession {
  id: number;
  user_email: string;
  started_at: string; // ISO UTC
  ended_at: string | null;
  notes: string | null;
}

const TIME_SESSION_SELECT = `
  id, user_email,
  to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
  CASE WHEN ended_at IS NULL THEN NULL
       ELSE to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END AS ended_at,
  notes
`;

export async function listTimeSessions(email: string, limit = 500): Promise<TimeSession[]> {
  await ensureTimeSessionsSchema();
  const { rows } = await sql<TimeSession>`
    SELECT id, user_email,
           to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
           CASE WHEN ended_at IS NULL THEN NULL
                ELSE to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END AS ended_at,
           notes
    FROM time_sessions
    WHERE user_email = ${email}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function startTimeSession(email: string, notes?: string | null): Promise<TimeSession> {
  await ensureTimeSessionsSchema();
  // End any existing active session first so we don't violate the partial unique index.
  await sql`UPDATE time_sessions SET ended_at = now() WHERE user_email = ${email} AND ended_at IS NULL`;
  const { rows } = await sql<TimeSession>`
    INSERT INTO time_sessions (user_email, started_at, notes)
    VALUES (${email}, now(), ${notes ?? null})
    RETURNING
      id, user_email,
      to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
      NULL::text AS ended_at,
      notes
  `;
  return rows[0];
}

export async function endActiveTimeSessions(email: string): Promise<number> {
  await ensureTimeSessionsSchema();
  const res = await sql`UPDATE time_sessions SET ended_at = now() WHERE user_email = ${email} AND ended_at IS NULL`;
  return res.rowCount ?? 0;
}

export async function deleteTimeSession(email: string, id: number) {
  await ensureTimeSessionsSchema();
  await sql`DELETE FROM time_sessions WHERE id = ${id} AND user_email = ${email}`;
}

export async function updateTimeSession(
  email: string,
  id: number,
  patch: { started_at?: string; ended_at?: string | null; notes?: string | null }
): Promise<TimeSession | null> {
  await ensureTimeSessionsSchema();
  // Allow explicit null for ended_at (un-end a session) or a new value.
  const setEnded = patch.ended_at !== undefined;
  const { rows } = await sql<TimeSession>`
    UPDATE time_sessions SET
      started_at = COALESCE(${patch.started_at ?? null}::timestamptz, started_at),
      ended_at   = CASE WHEN ${setEnded} THEN ${patch.ended_at ?? null}::timestamptz ELSE ended_at END,
      notes      = CASE WHEN ${patch.notes !== undefined} THEN ${patch.notes ?? null} ELSE notes END
    WHERE id = ${id} AND user_email = ${email}
    RETURNING
      id, user_email,
      to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
      CASE WHEN ended_at IS NULL THEN NULL
           ELSE to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END AS ended_at,
      notes
  `;
  return rows[0] ?? null;
}

export async function createManualTimeSession(
  email: string,
  started_at: string,
  ended_at: string,
  notes?: string | null
): Promise<TimeSession> {
  await ensureTimeSessionsSchema();
  const { rows } = await sql<TimeSession>`
    INSERT INTO time_sessions (user_email, started_at, ended_at, notes)
    VALUES (${email}, ${started_at}::timestamptz, ${ended_at}::timestamptz, ${notes ?? null})
    RETURNING
      id, user_email,
      to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
      to_char(ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ended_at,
      notes
  `;
  return rows[0];
}
