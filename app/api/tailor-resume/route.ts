import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProfile } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in Vercel." },
      { status: 500 },
    );
  }

  const profile = await getProfile(session.user.email);
  if (!profile?.resume_text) {
    return NextResponse.json(
      { error: "Add your resume in Settings → Profile first." },
      { status: 400 },
    );
  }

  const body = await req.json();
  const { jobTitle, jobCompany, jobDescription, jobUrl } = body;
  if (!jobTitle || !jobCompany) {
    return NextResponse.json({ error: "jobTitle and jobCompany required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const system = `You are an expert resume tailor for SDR/BDR sales roles. You take a candidate's existing resume and rewrite/reorder it to maximally match a specific job description.

CRITICAL RULES — NON-NEGOTIABLE:
- NEVER invent jobs, companies, dates, schools, degrees, certifications, or achievements the candidate did not list. Only work with what is in their resume.
- You CAN rephrase, reorder, condense, expand, and choose which existing items to emphasize.
- You CAN translate existing experience into the language of the JD (e.g. "answered customer questions" becomes "qualified inbound leads").
- Use power verbs (Drove, Owned, Generated, Sourced, Booked, Closed). Quantify wherever the source resume has numbers — do not invent numbers.
- Keep the total content to roughly one page (5-7 bullets per role max, 3-5 skills, summary 2-3 sentences).
- Mirror keywords from the JD where they genuinely match the candidate's real experience.
- If the candidate did not provide an email, phone, LinkedIn, or location, leave those fields empty — NEVER fabricate contact info.

Output ONLY valid JSON matching this exact schema. No markdown fences, no commentary, no preamble:
{
  "name": "Full Name",
  "contact": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "summary": "2-3 sentence summary tailored to the role",
  "experiences": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "dates": "Jan 2023 - Present",
      "location": "City, ST",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "skills": ["Skill 1", "Skill 2"],
  "education": [
    { "school": "School", "degree": "Degree", "dates": "2018 - 2022", "details": "" }
  ]
}

If the source resume is missing a section entirely (e.g. no education listed), return that field as an empty array.`;

  const userMessage = [
    {
      type: "text" as const,
      text: `## Candidate's Existing Resume\n\n${profile.resume_text}${profile.background ? `\n\nAdditional context:\n${profile.background}` : ""}`,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: `## Job to Tailor To\n\nCompany: ${jobCompany}\nRole: ${jobTitle}${jobUrl ? `\nJob URL: ${jobUrl}` : ""}${jobDescription ? `\n\nJob Description:\n${jobDescription}` : ""}\n\nTailor my resume for this role. Output ONLY the JSON — no markdown fences, no commentary.`,
    },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    try {
      const resume = JSON.parse(cleaned);
      return NextResponse.json({ resume, usage: response.usage });
    } catch {
      return NextResponse.json(
        { error: "AI returned unparseable JSON. Try regenerating.", raw: cleaned.slice(0, 500) },
        { status: 500 },
      );
    }
  } catch (e: any) {
    console.error("resume tailor error", e);
    return NextResponse.json({ error: e?.message || "generation failed" }, { status: 500 });
  }
}
