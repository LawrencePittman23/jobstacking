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
  const [downloading, setDownloading] = useState(false);

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

  async function downloadPDF() {
    if (!resume) return;
    setDownloading(true);
    try {
      // Lazy-import so jsPDF doesn't ship in the SSR/initial bundle
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addBody = (text: string, opts: { italic?: boolean; size?: number; color?: [number, number, number] } = {}) => {
        const size = opts.size || 10.5;
        const lineHeight = size * 1.35;
        doc.setFont("times", opts.italic ? "italic" : "normal");
        doc.setFontSize(size);
        if (opts.color) doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
        else doc.setTextColor(26, 26, 26);
        const lines = doc.splitTextToSize(text, contentWidth);
        ensureSpace(lines.length * lineHeight);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      };

      const addSectionTitle = (title: string) => {
        y += 8;
        ensureSpace(20);
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.setTextColor(26, 26, 26);
        doc.text(title.toUpperCase(), margin, y);
        y += 5;
        doc.setLineWidth(0.5);
        doc.setDrawColor(136, 136, 136);
        doc.line(margin, y, pageWidth - margin, y);
        y += 12;
      };

      // === HEADER: Name centered, uppercase ===
      doc.setFont("times", "bold");
      doc.setFontSize(20);
      doc.setTextColor(26, 26, 26);
      doc.text((resume.name || "").toUpperCase(), pageWidth / 2, y, { align: "center" });
      y += 22;

      // Contact line
      const contactParts = [resume.contact?.email, resume.contact?.phone, resume.contact?.location, resume.contact?.linkedin].filter(Boolean) as string[];
      if (contactParts.length) {
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.setTextColor(68, 68, 68);
        doc.text(contactParts.join("  ·  "), pageWidth / 2, y, { align: "center" });
        y += 14;
      }

      // Divider under header
      doc.setLineWidth(1.2);
      doc.setDrawColor(26, 26, 26);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;

      // === SUMMARY ===
      if (resume.summary) {
        addSectionTitle("Summary");
        addBody(resume.summary);
      }

      // === EXPERIENCE ===
      if (resume.experiences?.length > 0) {
        addSectionTitle("Experience");
        for (const exp of resume.experiences) {
          ensureSpace(40);

          // Title + company (bold left) ... dates + location (italic right)
          doc.setFont("times", "bold");
          doc.setFontSize(11);
          doc.setTextColor(26, 26, 26);
          const titleText = (exp.title || "") + (exp.company ? ` · ${exp.company}` : "");
          doc.text(titleText, margin, y);

          const meta = `${exp.dates || ""}${exp.location ? ` · ${exp.location}` : ""}`;
          if (meta) {
            doc.setFont("times", "italic");
            doc.setFontSize(9.5);
            doc.setTextColor(85, 85, 85);
            const metaWidth = doc.getTextWidth(meta);
            doc.text(meta, pageWidth - margin - metaWidth, y);
          }
          y += 14;

          // Bullets
          doc.setFont("times", "normal");
          doc.setFontSize(10.5);
          doc.setTextColor(26, 26, 26);
          const bulletIndent = 14;
          const bulletLineHeight = 10.5 * 1.35;
          for (const bullet of exp.bullets || []) {
            const wrapped = doc.splitTextToSize(bullet, contentWidth - bulletIndent);
            ensureSpace(wrapped.length * bulletLineHeight + 2);
            doc.text("•", margin + 4, y);
            doc.text(wrapped, margin + bulletIndent, y);
            y += wrapped.length * bulletLineHeight + 1;
          }
          y += 6;
        }
      }

      // === SKILLS ===
      if (resume.skills?.length > 0) {
        addSectionTitle("Skills");
        addBody(resume.skills.join("  ·  "));
      }

      // === EDUCATION ===
      if (resume.education?.length > 0) {
        addSectionTitle("Education");
        for (const edu of resume.education) {
          ensureSpace(22);
          doc.setFont("times", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(26, 26, 26);
          const eduText = (edu.degree || "") + (edu.school ? ` · ${edu.school}` : "");
          doc.text(eduText, margin, y);

          if (edu.dates) {
            doc.setFont("times", "italic");
            doc.setFontSize(9.5);
            doc.setTextColor(85, 85, 85);
            const datesWidth = doc.getTextWidth(edu.dates);
            doc.text(edu.dates, pageWidth - margin - datesWidth, y);
          }
          y += 13;

          if (edu.details) {
            addBody(edu.details, { size: 10, color: [85, 85, 85] });
          }
          y += 4;
        }
      }

      const safeName = (resume.name || "Resume").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Resume";
      const safeCompany = (job.company || "").replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const filename = `${safeName}${safeCompany ? " - " + safeCompany : ""}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
      alert("Couldn't generate the PDF. Try again, or use Cmd/Ctrl+P as a fallback.");
    } finally {
      setDownloading(false);
    }
  }

  async function applyNow() {
    if (!job.url) {
      alert("This job has no application URL.");
      return;
    }
    setApplying(true);
    try {
      window.open(job.url, "_blank", "noopener,noreferrer");
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
          notes: "Tailored resume generated.",
        }),
      });
      if (onApplied) onApplied();
      setTimeout(() => onClose(), 800);
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
          <button className="btn btn-ghost" onClick={downloadPDF} disabled={loading || !resume || downloading}>
            {downloading ? "Generating PDF…" : "📄 Download PDF"}
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
