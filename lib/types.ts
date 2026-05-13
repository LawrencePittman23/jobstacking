export type Status = "saved" | "applied" | "interview" | "assessment" | "offer" | "rejected";

export interface Application {
  id: number;
  user_email: string;
  company: string;
  role: string;
  location: string | null;
  status: Status;
  applied_at: string | null; // ISO date
  event_time: string | null; // HH:MM
  salary: string | null;
  source: string | null;
  link: string | null;
  email_id: string | null;
  color: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  email: string;
  refresh_token: string | null;
  last_sync_at: string | null;
  last_history_id: string | null;
}
