import { sql } from "@vercel/postgres";
import type { Application, Status, User } from "./types";

let initialized = false;

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
