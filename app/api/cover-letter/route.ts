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
      { error: "ANTHROPIC_API_KEY is not set in Vercel environment variables. Add it in Settings." },
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

  const system = [
    {
      type: "text" as const,
      text: `You are an expert cover letter writer specializing in SDR/BDR sales roles. Write tailored, concise cover letters that:
- Sound natural and human — NO AI tells like "I am writing to express my interest", "I would be a great fit", or "I am excited about this opportunity"
- Lead with a specific reason the candidate is excited about THIS company (not generic praise)
- Highlight 1-2 most relevant pieces of the candidate's background that map directly to the role
- Show concrete understanding of the company's product or mission with one specific detail
- End with a clear next-step ask (e.g. "Open to a 15-min call this week?")
- Are 200-300 words total — short enough to actually be read
- Use short paragraphs (2-3 sentences each)
- Never include placeholders like [Hiring Manager], [Company Name], or [Your Name]
- Address "Hi [Company] team" or just dive into the body
- Sound like a confident SDR/BDR candidate who has done their homework`,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const userMessage = [
    {
      type: "text" as const,
      text: `## My Background\n\nName: ${profile.full_name || "(see resume)"}\n\nResume:\n${profile.resume_text}${profile.background ? `\n\nAdditional context:\n${profile.background}` : ""}`,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: `## The Role I'm Applying To\n\nCompany: ${jobCompany}\nRole: ${jobTitle}${jobUrl ? `\nJob URL: ${jobUrl}` : ""}${jobDescription ? `\n\nJob Description:\n${jobDescription}` : ""}\n\nWrite my cover letter for this role. Output ONLY the cover letter body — no preamble like "Here's your cover letter:" or any commentary. Start directly with the salutation.`,
    },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ coverLetter: text, usage: response.usage });
  } catch (e: any) {
    console.error("cover letter generation error", e);
    return NextResponse.json({ error: e?.message || "generation failed" }, { status: 500 });
  }
}
