import { google, gmail_v1 } from "googleapis";
import { classify } from "./classify";
import { upsertFromEmail, setLastSync } from "./db";

function oauthClient(refreshToken: string) {
  const c = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  c.setCredentials({ refresh_token: refreshToken });
  return c;
}

const GMAIL_QUERY = [
  "newer_than:60d",
  "-from:me",
  "-category:promotions",
  "-category:social",
  "(",
    "subject:(application OR interview OR offer OR assessment OR \"thank you for applying\" OR \"next steps\")",
    "OR",
    "from:(careers OR recruiting OR talent OR jobs OR no-reply OR hiring)",
  ")",
].join(" ");

function header(headers: gmail_v1.Schema$MessagePartHeader[] = [], name: string) {
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function parseFrom(fromHeader: string): { name: string; email: string } {
  const m = fromHeader.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: "", email: fromHeader.trim().toLowerCase() };
}

function bodyText(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const text = bodyText(p);
      if (text) return text;
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  return "";
}

const PALETTE = ["#4f46e5","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4"];
function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export async function syncForUser(userEmail: string, refreshToken: string): Promise<{ scanned: number; saved: number }> {
  const auth = oauthClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  let scanned = 0;
  let saved = 0;
  let pageToken: string | undefined;

  do {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: GMAIL_QUERY,
      maxResults: 50,
      pageToken,
    });
    const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
    pageToken = list.data.nextPageToken ?? undefined;

    for (const id of ids) {
      scanned++;
      try {
        const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const headers = msg.data.payload?.headers ?? [];
        const subject = header(headers, "Subject");
        const dateHdr = header(headers, "Date");
        const fromHdr = header(headers, "From");
        const { name: fromName, email: fromEmail } = parseFrom(fromHdr);
        const body = bodyText(msg.data.payload).slice(0, 4000);

        const result = classify(subject, body, fromName, fromEmail);
        if (!result) continue;

        const dateIso = dateHdr ? safeDate(dateHdr) : null;
        await upsertFromEmail(userEmail, {
          email_id: id,
          company: result.company,
          role: result.role,
          status: result.status ?? "applied",
          applied_at: dateIso,
          source: "Gmail",
          color: pickColor(result.company),
        });
        saved++;
      } catch (e) {
        console.error("sync msg error", id, e);
      }
    }
  } while (pageToken && scanned < 200);

  await setLastSync(userEmail, new Date());
  return { scanned, saved };
}

function safeDate(s: string): string | null {
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
