"use client";
import { useEffect, useState } from "react";

export interface CoverLetterJob {
  title: string;
  company: string;
  url?: string;
  description?: string;
}

export default function CoverLetterModal({
  job,
  onClose,
}: {
  job: CoverLetterJob;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    setText("");
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: job.title,
          jobCompany: job.company,
          jobUrl: job.url,
          jobDescription: job.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "generation failed");
      setText(data.coverLetter || "");
    } catch (e: any) {
      setError(e.message || "generation failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    /* eslint-disable-next-line */
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Couldn't copy to clipboard. Select and copy manually.");
    }
  }

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cover-letter-card">
        <div className="modal-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Cover Letter ✨</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              {job.title} · {job.company}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: "18px 20px" }}>
          {loading ? (
            <div className="cover-loading">
              <div className="cover-spinner" />
              <div className="muted">Tailoring your cover letter… ~10-20s</div>
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ marginBottom: 0 }}>
              {error}
              {error.includes("resume") && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Go to <strong>Settings → Profile</strong> and paste your resume to enable cover letters.
                </div>
              )}
              {error.includes("ANTHROPIC_API_KEY") && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Add your Anthropic API key to Vercel: Settings → Environment Variables → add <code>ANTHROPIC_API_KEY</code>.
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea
                className="cover-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck
              />
              <div className="cover-meta">
                <span className="muted">{text.split(/\s+/).filter(Boolean).length} words</span>
                <span className="muted">Edit before copying — always read first</span>
              </div>
            </>
          )}
        </div>

        <div className="cover-actions">
          <button className="btn btn-ghost" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "↻ Regenerate"}
          </button>
          <button className="btn btn-primary" onClick={copy} disabled={loading || !text}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
