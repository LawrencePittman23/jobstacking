import type { Status } from "./types";

const RULES: Array<{ status: Status; patterns: RegExp[] }> = [
  {
    status: "offer",
    patterns: [
      /\boffer letter\b/i,
      /\bwe(?:'re| are) (?:excited|pleased|delighted) to offer\b/i,
      /\bwe(?:'d| would) like to (?:extend|offer)\b/i,
      /\bjob offer\b/i,
      /\boffer of employment\b/i,
      /\bcongratulations[, ].*offer\b/i,
    ],
  },
  {
    status: "rejected",
    patterns: [
      /\bunfortunately\b/i,
      /\bwe (?:have )?decided (?:to|not)\b/i,
      /\bmoving forward with (?:other|another)\b/i,
      /\bnot moving forward\b/i,
      /\bnot (?:be )?selected\b/i,
      /\bother candidates?\b/i,
      /\bnot (?:the )?right fit\b/i,
      /\bwe wish you (?:the best|luck)\b/i,
      /\bregret to inform\b/i,
    ],
  },
  {
    status: "assessment",
    patterns: [
      /\b(?:take[- ]?home|coding|technical)\s+(?:assessment|challenge|test|exercise)\b/i,
      /\bassessment\b/i,
      /\bonline test\b/i,
      /\bhacker ?rank\b/i,
      /\bcodility\b/i,
      /\btechnical screen\b/i,
      /\bskills?\s+(?:test|assessment)\b/i,
    ],
  },
  {
    status: "interview",
    patterns: [
      /\binterview\b/i,
      /\bphone screen\b/i,
      /\bschedule (?:a |an )?(?:call|chat|time|meeting)\b/i,
      /\b(?:like|love) to (?:chat|speak|connect|talk)\b/i,
      /\bnext steps?\b/i,
      /\blet'?s connect\b/i,
      /\bavailability\b.*\bcall\b/i,
    ],
  },
  {
    status: "applied",
    patterns: [
      /\b(?:thanks?|thank you) (?:for )?(?:your )?(?:applying|application|interest)\b/i,
      /\bapplication (?:received|submitted|confirmation)\b/i,
      /\bwe(?:'ve| have)? received your application\b/i,
      /\bthanks for applying\b/i,
      /\byour application (?:to|for)\b/i,
    ],
  },
];

const APPLICATION_HINT_RE = /\b(?:application|applied|applying|recruit(?:er|ing)|hiring|candidate|position|role|opening|opportunity|career)\b/i;

export interface Classified {
  status: Status | null;
  company: string;
  role: string;
}

export function classify(subject: string, body: string, fromName: string, fromEmail: string): Classified | null {
  const text = `${subject}\n${body}`;

  let status: Status | null = null;
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(text))) {
      status = rule.status;
      break;
    }
  }

  if (!status && !APPLICATION_HINT_RE.test(text)) return null;
  if (!status) status = "applied";

  const company = extractCompany(fromName, fromEmail, subject, body);
  const role = extractRole(subject, body);

  return { status, company, role };
}

const GENERIC_DOMAINS = new Set([
  "gmail.com","googlemail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","proton.me","protonmail.com",
  "greenhouse.io","lever.co","workday.com","myworkdayjobs.com","ashbyhq.com","smartrecruiters.com","jobvite.com",
  "wellfound.com","linkedin.com","indeed.com","builtin.com","glassdoor.com","ziprecruiter.com",
]);

function extractCompany(fromName: string, fromEmail: string, subject: string, body: string): string {
  const cleanedName = fromName.replace(/[<>"]/g, "").replace(/\s+team$/i, "").replace(/\s+recruit(?:ing|er|ment)$/i, "").trim();
  if (cleanedName && !/^careers?$|^recruit(?:ing|er)$|^talent$|^hr$|^no[- ]?reply$/i.test(cleanedName)) {
    return cleanedName;
  }

  const domain = (fromEmail.split("@")[1] || "").toLowerCase();
  if (domain && !GENERIC_DOMAINS.has(domain)) {
    const base = domain.replace(/^(careers|jobs|recruiting|talent|hire|hr|hello|info|noreply|no-reply)\./, "").split(".")[0];
    if (base) return capitalize(base);
  }

  const m = subject.match(/(?:at|with|from)\s+([A-Z][\w&. -]{1,40})/);
  if (m) return m[1].trim();

  const m2 = body.match(/at\s+([A-Z][\w&. -]{1,40})[\s.,!]/);
  if (m2) return m2[1].trim();

  return cleanedName || domain || "Unknown";
}

function extractRole(subject: string, body: string): string {
  const patterns: RegExp[] = [
    /\b(?:position|role|job)\s+(?:of|as|for)\s+([A-Z][\w \-/&]{2,60})/,
    /\bfor (?:the )?([A-Z][\w \-/&]{2,60})\s+(?:position|role|opening|opportunity)\b/i,
    /\b(?:applying|application) (?:for|to) (?:the )?([A-Z][\w \-/&]{2,60})\b/,
    /\b((?:Senior|Junior|Lead|Staff|Principal)?\s*(?:SDR|BDR|AE|Account Executive|Sales Development Rep(?:resentative)?|Business Development Rep(?:resentative)?))\b/i,
  ];
  for (const re of patterns) {
    const m = subject.match(re) || body.match(re);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return "";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
