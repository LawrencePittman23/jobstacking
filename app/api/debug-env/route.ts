import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    has_nextauth_url: !!process.env.NEXTAUTH_URL,
    has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    has_google_client_id: !!process.env.GOOGLE_CLIENT_ID,
    has_google_client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
    has_cron_secret: !!process.env.CRON_SECRET,
    has_postgres_url: !!process.env.POSTGRES_URL,
    has_adzuna_app_id: !!process.env.ADZUNA_APP_ID,
    has_adzuna_api_key: !!process.env.ADZUNA_API_KEY,
    has_rapidapi_key: !!process.env.RAPIDAPI_KEY,
    has_anthropic_api_key: !!process.env.ANTHROPIC_API_KEY,
    vercel_env: process.env.VERCEL_ENV,
  });
}
