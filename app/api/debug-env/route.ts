import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    has_nextauth_url: !!process.env.NEXTAUTH_URL,
    nextauth_url_value: process.env.NEXTAUTH_URL || null,
    has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    has_google_client_id: !!process.env.GOOGLE_CLIENT_ID,
    has_google_client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
    has_cron_secret: !!process.env.CRON_SECRET,
    has_postgres_url: !!process.env.POSTGRES_URL,
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
    vercel_url: process.env.VERCEL_URL,
  });
}
