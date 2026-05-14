"use client";
import { useEffect, useState } from "react";

export interface TailorResumeJob {
  title: string;
  company: string;
  url?: string;
  description?: string;
}

interface TailoredResume {
  name: string;
  contact: { email?: string; phone?: string; location?: string; linkedin?: string };
  summary: string;
  experiences: Array<{ company: string; title: string; dates: string; location?: string; bullets: string[] }>;
  skills: string[];
  education: Array<{ school: string; degree: string; dates: string; details?: string }>;
}

export default function ResumeModal({
  job,
  onClose,
  onApplied,
}: {
  job: TailorResumeJob;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    setResume(null);
    try {
      const res = await fetch("/api/tailor-resume", {
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
      setResume(data.resume);
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

  function downloadPDF() {
    document.body.classList.add("printing-resume");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-resume"), 500);
  }

  async function applyNow() {
    if (!job.url) {
      alert("This job has no application URL.");
      return;
    }
    setApplying(true);
    try {
      // Trigger the print dialog so user can save the PDF
      downloadPDF();
      // Small delay so the print dialog isn't blocked by the new-tab open
      setTimeout(() => {
        window.open(job.url, "_blank", "noopener,noreferrer");
      }, 300);
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: job.company,
          role: job.title,
          status: "applied",
          applied_at: new Date().toISOString().slice(0, 10),
          source: "Apply Flow",
          link: job.url,
          notes: "Tailored resume generated; PDF print dialog opened.",
        }),
      });
      if (onApplied) onApplied();
      setTimeout(() => onClose(), 1500);
    } catch {
      alert("Couldn't log the application. The job page opened anyway.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="modal resume-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card resume-card">
        <div className="modal-header no-print">
          <div>
            <h2 style={{ marginBottom: 4 }}>Tailored Resume 📄</h2>
            <div className="muted" style={{ fontSize: 13 }}>{job.title} · {job.company}</div>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="resume-body">
          {loading ? (
            <div className="cover-loading">
              <div className="cover-spinner" />
              <div className="muted">Tailoring your resume… ~15-30s</div>
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ margin: 20 }}>
              {error}
              {error.includes("resume") && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  Go to <strong>Settings → Profile</strong> and paste your resume first.
                </div>
              )}
            </div>
          ) : resume ? (
            <div id="resume-printable" className="resume-printable">
              <header className="r-header">
                <h1 className="r-name">{resume.name || ""}</h1>
                <div className="r-contact">
                  {[resume.contact?.email, resume.contact?.phone, resume.contact?.location, resume.contact?.linkedin]
                    .filter(Boolean)
                    .join("  ·  ")}
                </div>
              </header>

              {resume.summary && (
                <section className="r-section">
                  <h2 className="r-section-title">Summary</h2>
                  <p className="r-summary">{resume.summary}</p>
                </section>
              )}

              {resume.experiences?.length > 0 && (
                <section className="r-section">
                  <h2 className="r-section-title">Experience</h2>
                  {resume.experiences.map((exp, i) => (
                    <div key={i} className="r-exp">
                      <div className="r-exp-head">
                        <div>
                          <span className="r-exp-title">{exp.title}</span>
                          {exp.company && <span className="r-exp-company"> · {exp.company}</span>}
                        </div>
                        <div className="r-exp-meta">
                          {exp.dates}{exp.location ? ` · ${exp.location}` : ""}
                        </div>
                      </div>
                      <ul className="r-bullets">
                        {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </section>
              )}

              {resume.skills?.length > 0 && (
                <section className="r-section">
                  <h2 className="r-section-title">Skills</h2>
                  <div className="r-skills">{resume.skills.join("  ·  ")}</div>
                </section>
              )}

              {resume.education?.length > 0 && (
                <section className="r-section">
                  <h2 className="r-section-title">Education</h2>
                  {resume.education.map((edu, i) => (
                    <div key={i} className="r-edu">
                      <div className="r-edu-head">
                        <span className="r-edu-degree">{edu.degree}</span>
                        {edu.school && <span className="r-edu-school"> · {edu.school}</span>}
                        <span className="r-edu-dates">{edu.dates}</span>
                      </div>
                      {edu.details && <div className="r-edu-details">{edu.details}</div>}
                    </div>
                  ))}
                </section>
              )}
            </div>
          ) : null}
        </div>

        <div className="cover-actions no-print">
          <button className="btn btn-ghost" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "↻ Regenerate"}
          </button>
          <button className="btn btn-ghost" onClick={downloadPDF} disabled={loading || !resume}>
            📄 Download PDF
          </button>
          {job.url && (
            <button className="btn btn-primary" onClick={applyNow} disabled={loading || !resume || applying}>
              {applying ? "Opening…" : "🚀 Apply now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
