"use client";
import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <div className="signin">
      <div className="signin-card">
        <div className="brand">
          <span className="brand-logo">JS</span>
          <span className="brand-name">JobStacking</span>
        </div>
        <h1>Sign in</h1>
        <p className="muted">
          Connect your Gmail to auto-track applications, interview requests, assessments, and offers.
        </p>
        <button className="btn btn-primary signin-btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Continue with Google
        </button>
        <p className="muted small">
          We request read-only Gmail access. Your emails stay on your device + Vercel—never shared.
        </p>
      </div>
    </div>
  );
}
