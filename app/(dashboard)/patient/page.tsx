"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import {
  type PatientGender,
  type PatientStatus,
  type AnalysisType,
  type Patient,
  patientAvatarColors,
  emptyPatientForm,
  patientInitialsFromObj,
  severityStyle,
  analysisTypeColor,
} from "@/lib/data";

// ─── Type Icon ───────────────────────────────────────────────────────────────
function TypeIcon({ t }: { t: AnalysisType }) {
  if (t === "analysis") return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
  if (t === "report") return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ─── Add Patient Modal ───────────────────────────────────────────────────────
function AddPatientModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: Patient) => void }) {
  const [form, setForm] = useState(emptyPatientForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.dob) {
      setError("First name, last name and date of birth are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      if (!doctor?.id) { setError("Not logged in"); return; }

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId:    doctor.id,
          firstName:   form.firstName,
          lastName:    form.lastName,
          dateOfBirth: form.dob,
          gender:      form.gender,
          phone:       form.phone,
          email:       form.email,
          condition:   form.condition,
          notes:       form.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      const p = data.patient;
      const age = new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear();
      onAdd({
        id:        p.id,
        firstName: p.firstName,
        lastName:  p.lastName,
        dob:       p.dateOfBirth,
        gender:    p.gender as PatientGender,
        phone:     p.phone,
        email:     p.email,
        condition: p.condition,
        notes:     p.notes,
        status:    p.status as PatientStatus,
        age,
        lastVisit: p.createdAt?.split("T")[0] ?? "",
        analyses:  [],
      });
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Add New Patient</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-form-grid-2">
          <div className="modal-field">
            <label className="modal-label">First Name *</label>
            <input className="modal-input" value={form.firstName} onChange={set("firstName")} placeholder="First name" />
          </div>
          <div className="modal-field">
            <label className="modal-label">Last Name *</label>
            <input className="modal-input" value={form.lastName} onChange={set("lastName")} placeholder="Last name" />
          </div>
        </div>

        <div className="modal-form-grid-2">
          <div className="modal-field">
            <label className="modal-label">Date of Birth *</label>
            <input className="modal-input" type="date" value={form.dob} onChange={set("dob")} />
          </div>
          <div className="modal-field">
            <label className="modal-label">Gender</label>
            <select className="modal-input" value={form.gender} onChange={set("gender")}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>

        <div className="modal-form-grid-2">
          <div className="modal-field">
            <label className="modal-label">Phone</label>
            <input className="modal-input" value={form.phone} onChange={set("phone")} placeholder="+213 ..." />
          </div>
          <div className="modal-field">
            <label className="modal-label">Email</label>
            <input className="modal-input" type="email" value={form.email} onChange={set("email")} placeholder="patient@email.com" />
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Primary Condition</label>
          <input className="modal-input" value={form.condition} onChange={set("condition")} placeholder="e.g. Gastric Ulcer, GERD…" />
        </div>

        <div className="modal-field" style={{ marginBottom: "1.5rem" }}>
          <label className="modal-label">Clinical Notes</label>
          <textarea className="modal-input modal-textarea" rows={3} value={form.notes} onChange={set("notes")} placeholder="Initial observations…" />
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: "13px", marginBottom: "1rem" }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-modal-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding..." : "Add Patient"}
          </button>
          <button type="button" className="btn-modal-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Analysis Modal ──────────────────────────────────────────────────────
function NewAnalysisModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [visitType, setVisitType] = useState("Colonoscopy");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      if (!doctor?.id) { setError("Not logged in"); return; }

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          doctorId:  doctor.id,
          visitDate,
          visitType,
          notes,
          status: "Pending",
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create visit"); return; }

      window.location.href = `/live?visitId=${data.visit.id}`;
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">New Analysis</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Patient summary */}
        <div style={{
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px",
          padding: "12px 16px", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#e0f2fe", color: "#0284c7",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 600,
          }}>
            {patient.firstName[0]}{patient.lastName[0]}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
              {patient.firstName} {patient.lastName}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              {patient.age} yrs · {patient.condition || "No condition noted"}
            </p>
          </div>
        </div>

        <div className="modal-field">
          <label className="modal-label">Visit Type</label>
          <select className="modal-input" value={visitType} onChange={e => setVisitType(e.target.value)}>
            <option value="Colonoscopy">Colonoscopy</option>
            <option value="Gastroscopy">Gastroscopy</option>
          </select>
        </div>

        <div className="modal-field">
          <label className="modal-label">Visit Date</label>
          <input className="modal-input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
        </div>

        <div className="modal-field" style={{ marginBottom: "1.5rem" }}>
          <label className="modal-label">Pre-visit Notes</label>
          <textarea className="modal-input modal-textarea" rows={3} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="Initial observations, symptoms…" />
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: "13px", marginBottom: "1rem" }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-modal-submit" onClick={handleStart} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {loading ? "Creating visit…" : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Start Analysis
              </>
            )}
          </button>
          <button type="button" className="btn-modal-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────
interface PatientSummary {
  totalVisits: number;
  totalAnalyses: number;
  totalLesions: number;
  avgConfidence: number;
  firstVisitDate: string | null;
  lastVisitDate: string | null;
  visitTypeBreakdown: Record<string, number>;
  riskDist: { high: number; moderate: number; low: number };
  lesionEvolution: {
    type: string; occurrences: number;
    firstDate: string; lastDate: string;
    firstSeverity: string; lastSeverity: string;
    firstRisk: string; lastRisk: string;
    firstConf: number; lastConf: number;
    trend: "worsening" | "improving" | "stable";
  }[];
  overallTrend: "improving" | "worsening" | "stable" | "insufficient";
  riskProgression: { date: string; risk: string; visitType: string; conf: number }[];
  recentVisits: {
    id: string; visitDate: string; visitType: string; status: string;
    risk: string | null; analysisCount: number; findings: string[];
  }[];
  lastAnalysisRisk: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function buildClinicalNarrative(p: Patient, s: PatientSummary): string[] {
  const paragraphs: string[] = [];
  if (s.totalVisits === 0) return ["No endoscopic procedures have been recorded for this patient yet."];

  // ── Sentence 1: procedure history ──
  const since = s.firstVisitDate ? ` since ${fmtDate(s.firstVisitDate)}` : "";
  paragraphs.push(
    `${p.firstName} ${p.lastName} has undergone ${s.totalVisits} endoscopic procedure${s.totalVisits > 1 ? "s" : ""}${since}.`
  );

  // ── Sentence 2: primary finding evolution ──
  const primary = s.lesionEvolution[0];
  if (primary) {
    const riskLabel = (r: string) => r === "high" ? "high risk" : r === "moderate" ? "moderate risk" : "low risk";
    const isSingleOccurrence = primary.occurrences === 1;
    if (isSingleOccurrence) {
      paragraphs.push(
        `${primary.type} was detected on ${fmtDate(primary.firstDate)}, classified as ${riskLabel(primary.lastRisk)} with ${primary.lastConf}% model confidence.`
      );
    } else {
      const trendPhrase =
        primary.trend === "worsening"  ? "showing a progressive escalation in severity" :
        primary.trend === "improving"  ? "demonstrating gradual risk reduction over subsequent visits" :
                                         "maintaining a consistent risk level across all visits";
      paragraphs.push(
        `${primary.type} was first detected on ${fmtDate(primary.firstDate)} at ${riskLabel(primary.firstRisk)} (${primary.firstConf}% conf.), ` +
        `${trendPhrase} — most recently classified as ${riskLabel(primary.lastRisk)} (${primary.lastConf}% conf.) on ${fmtDate(primary.lastDate)}.`
      );
    }
  }

  // ── Sentence 3: secondary findings ──
  if (s.lesionEvolution.length > 1) {
    const others = s.lesionEvolution.slice(1, 3)
      .map(l => `${l.type} (${l.occurrences}×)`)
      .join(", ");
    paragraphs.push(`Additional findings include: ${others}.`);
  }

  // ── Sentence 4: overall trend ──
  if (s.totalAnalyses >= 2) {
    const trendSentence =
      s.overallTrend === "worsening"    ? "⚠ The overall risk trajectory is worsening — closer monitoring is advised." :
      s.overallTrend === "improving"    ? "The overall clinical picture is improving across recent analyses." :
      s.overallTrend === "stable"       ? "Risk levels have remained stable across recent analyses." :
      `${s.totalAnalyses} analysis session${s.totalAnalyses > 1 ? "s" : ""} recorded in total.`;
    paragraphs.push(trendSentence);
  }

  return paragraphs;
}

function OverviewTab({ patient, onNewAnalysis }: { patient: Patient; onNewAnalysis: () => void }) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSummary(null);
    setLoading(true);
    fetch(`/api/patients/${patient.id}/summary`)
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patient.id]);

  if (loading) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading clinical summary…</div>
  );
  if (!summary) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Failed to load summary.</div>
  );

  const riskColor = (r: string | null) =>
    r === "high" ? "#ef4444" : r === "moderate" ? "#f97316" : r === "low" ? "#2563EB" : "#94a3b8";
  const riskBg = (r: string | null) =>
    r === "high" ? "#fef2f2" : r === "moderate" ? "#fff7ed" : r === "low" ? "#eff6ff" : "#f1f5f9";
  const riskLabel = (r: string | null) =>
    r === "high" ? "High Risk" : r === "moderate" ? "Moderate" : r === "low" ? "Normal" : "—";

  const trendMeta = {
    worsening:   { icon: "↑", color: "#ef4444" },
    improving:   { icon: "↓", color: "#16a34a" },
    stable:      { icon: "→", color: "#f97316" },
    insufficient:{ icon: "·", color: "#94a3b8" },
  }[summary.overallTrend];

  const lesionTrendMeta = (t: string) => ({
    worsening: { icon: "↗", color: "#ef4444", label: "Escalating" },
    improving: { icon: "↘", color: "#16a34a", label: "Improving"  },
    stable:    { icon: "→", color: "#64748b", label: "Stable"     },
  })[t as "worsening" | "improving" | "stable"] ?? { icon: "·", color: "#94a3b8", label: "—" };

  const narrative = buildClinicalNarrative(patient, summary);
  const hasData = summary.totalVisits > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Clinical Synopsis ── */}
      {hasData && <div style={{
        background: "linear-gradient(135deg, #f0f6ff 0%, #fafafa 100%)",
        border: "1px solid rgba(37,99,235,0.14)",
        borderRadius: 14, padding: "18px 20px",
        position: "relative", overflow: "hidden",
      }}>
        {/* accent bar */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, #2563EB, #1D4ED8)", borderRadius: "14px 0 0 14px" }} />

        <div style={{ paddingLeft: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#2563EB" }}>
              Clinical Synopsis
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {narrative.map((para, i) => (
              <p key={i} style={{
                margin: 0, fontSize: 13, lineHeight: 1.65,
                fontWeight: i === narrative.length - 1 && summary.overallTrend === "worsening" ? 600 : 400,
                color: i === narrative.length - 1 && summary.overallTrend === "worsening" ? "#DC2626" : "#1e293b",
              }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>}

      {/* ── Quick stats ── */}
      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "Procedures",   value: summary.totalVisits,   sub: "total visits" },
            { label: "Findings",     value: summary.totalLesions,  sub: "lesions detected" },
            { label: "Avg. Confidence", value: summary.avgConfidence ? `${summary.avgConfidence}%` : "—", sub: "model accuracy" },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 11, padding: "12px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0a0f1e", fontFamily: "var(--font-display, inherit)", letterSpacing: "-0.5px" }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: "#2563EB", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Finding Evolution ── */}
      {summary.lesionEvolution.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#64748b" }}>
              Finding Evolution
            </span>
          </div>

          <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {summary.lesionEvolution.map((l) => {
              const tm = lesionTrendMeta(l.trend);
              const sameDate = l.firstDate === l.lastDate;
              return (
                <div key={l.type} style={{
                  background: "#f8fafc", borderRadius: 10, padding: "12px 14px",
                  border: "1px solid #f1f5f9",
                }}>
                  {/* top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>{l.type}</span>
                    <span style={{ fontSize: 11, color: tm.color, fontWeight: 700 }}>{tm.icon} {tm.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                      color: riskColor(l.lastRisk), background: riskBg(l.lastRisk),
                    }}>
                      {riskLabel(l.lastRisk)}
                    </span>
                  </div>

                  {/* timeline bar */}
                  <div style={{ position: "relative", margin: "6px 0 10px" }}>
                    {/* line */}
                    <div style={{ height: 2, background: "#e2e8f0", borderRadius: 2, position: "relative" }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: sameDate ? "100%" : "100%",
                        background: `linear-gradient(90deg, ${riskColor(l.firstRisk)}, ${riskColor(l.lastRisk)})`,
                        borderRadius: 2,
                      }} />
                    </div>
                    {/* dots */}
                    <div style={{ position: "absolute", top: -5, left: 0, width: 12, height: 12, borderRadius: "50%", background: riskColor(l.firstRisk), border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                    {!sameDate && (
                      <div style={{ position: "absolute", top: -5, right: 0, width: 12, height: 12, borderRadius: "50%", background: riskColor(l.lastRisk), border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                    )}
                  </div>

                  {/* dates row */}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>First detected</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{fmtDate(l.firstDate)}</div>
                      <div style={{ fontSize: 10, color: riskColor(l.firstRisk) }}>{riskLabel(l.firstRisk)} · {l.firstConf}%</div>
                    </div>
                    {!sameDate && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>Last seen</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{fmtDate(l.lastDate)}</div>
                        <div style={{ fontSize: 10, color: riskColor(l.lastRisk) }}>{riskLabel(l.lastRisk)} · {l.lastConf}%</div>
                      </div>
                    )}
                  </div>

                  {l.occurrences > 1 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                      Detected across {l.occurrences} analysis session{l.occurrences > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Risk Progression dots ── */}
      {summary.riskProgression.length > 1 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#64748b" }}>
                Risk Progression
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 18, color: trendMeta.color, fontWeight: 900 }}>{trendMeta.icon}</span>
              <span style={{ fontSize: 10, color: trendMeta.color, fontWeight: 700, textTransform: "uppercase" }}>
                {summary.overallTrend === "insufficient" ? "Insufficient data" : summary.overallTrend}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {summary.riskProgression.map((pt, i) => (
              <React.Fragment key={i}>
                <div title={`${pt.visitType} · ${riskLabel(pt.risk)} · ${pt.conf}% · ${fmtDate(pt.date)}`}
                  style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: riskColor(pt.risk),
                    cursor: "default", flexShrink: 0,
                    boxShadow: `0 0 0 2px ${riskBg(pt.risk)}`,
                  }}
                />
                {i < summary.riskProgression.length - 1 && (
                  <div style={{ flex: 1, height: 1.5, background: "#e2e8f0", minWidth: 6 }} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: "#cbd5e1" }}>
              {summary.firstVisitDate ? fmtDate(summary.firstVisitDate) : "First visit"}
            </span>
            <span style={{ fontSize: 10, color: "#cbd5e1" }}>
              {summary.lastVisitDate ? fmtDate(summary.lastVisitDate) : "Last visit"}
            </span>
          </div>
        </div>
      )}


      {!hasData && (
        <div style={{
          padding: "2.5rem", textAlign: "center", color: "#94a3b8", fontSize: 13,
          background: "#f8fafc", borderRadius: 14, border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, color: "#64748b", marginBottom: 4 }}>No clinical data yet</div>
          <div style={{ marginBottom: 18 }}>Start a new analysis to build this patient's clinical record.</div>
          <button type="button" onClick={onNewAnalysis} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
            color: "#fff", border: "none", borderRadius: 9,
            padding: "10px 22px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 14px rgba(23,37,84,0.32)",
            fontFamily: "inherit",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Start First Analysis
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Patient Detail Panel ────────────────────────────────────────────────────
function PatientDetail({ patient, colorPair, onClose, onArchive }: {
  patient: Patient;
  colorPair: [string, string];
  onClose: () => void;
  onArchive: (id: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "info" | "history">("overview");
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [deletingAnalysis, setDeletingAnalysis] = useState<string | null>(null);

  // Reset to overview when switching patients
  useEffect(() => { setTab("overview"); }, [patient.id]);

  useEffect(() => {
    if (tab !== "history") return;
    setAnalysesLoading(true);
    fetch(`/api/analysis?patientId=${patient.id}`)
      .then(r => r.json())
      .then(d => setAnalyses(d.analyses ?? []))
      .catch(() => {})
      .finally(() => setAnalysesLoading(false));
  }, [tab, patient.id]);

  const handleDeleteAnalysis = async (analysisId: string) => {
    setDeletingAnalysis(analysisId);
    try {
      await fetch(`/api/analysis/${analysisId}`, { method: "DELETE" });
      setAnalyses(prev => prev.filter(a => a.id !== analysisId));
    } finally {
      setDeletingAnalysis(null);
    }
  };

  return (
    <>
      {showAnalysisModal && (
        <NewAnalysisModal patient={patient} onClose={() => setShowAnalysisModal(false)} />
      )}

      <div className="patient-detail-panel">
        {/* Header */}
        <div className="patient-detail-header">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="patient-detail-avatar" style={{ background: colorPair[0], color: colorPair[1] }}>
              {patientInitialsFromObj(patient)}
            </div>
            <div>
              <p className="patient-detail-name">{patient.firstName} {patient.lastName}</p>
              <p className="patient-detail-sub">{patient.age} yrs · {patient.gender} · {patient.condition}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="patient-status-badge" style={{
              background: patient.status === "Active" ? "#f0fdf4" : "#f9fafb",
              color:      patient.status === "Active" ? "#2563EB" : "#9ca3af",
            }}>{patient.status}</span>
            <button type="button" onClick={() => setShowAnalysisModal(true)} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "7px 14px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 3px 10px rgba(23,37,84,0.28)",
              whiteSpace: "nowrap",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              New Analysis
            </button>
            <button type="button" className="patient-detail-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="patient-detail-tabs">
          {(["overview", "info", "history"] as const).map(t => (
            <button key={t} type="button"
              className={`patient-detail-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "overview" ? "Overview" : t === "info" ? "Patient Info" : "Analysis History"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="patient-detail-body">
          {tab === "overview" ? (
            <OverviewTab patient={patient} onNewAnalysis={() => setShowAnalysisModal(true)} />
          ) : tab === "info" ? (
            <>
              <div className="patient-info-grid">
                {([
                  ["Date of Birth", patient.dob],
                  ["Age",           `${patient.age} years old`],
                  ["Gender",        patient.gender],
                  ["Phone",         patient.phone],
                  ["Email",         patient.email],
                  ["Last Visit",    patient.lastVisit],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="patient-info-item-label">{label}</p>
                    <p className="patient-info-item-value">{value || "—"}</p>
                  </div>
                ))}
              </div>

              <div className="patient-notes-box">
                <p className="patient-notes-label">Clinical Notes</p>
                <p className="patient-notes-text">{patient.notes || "No notes added."}</p>
              </div>

              <div className="patient-detail-actions">
                <button type="button" className="btn-new-analysis" onClick={() => setShowAnalysisModal(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  New Analysis
                </button>
                <button type="button" className="btn-archive-patient" onClick={() => onArchive(patient.id)}>
                  {patient.status === "Active" ? "Archive" : "Restore"}
                </button>
              </div>
            </>
          ) : (
            <>
              {analysesLoading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
              ) : analyses.length === 0 ? (
                <div className="analysis-empty">
                  <p className="analysis-empty-title">No analyses yet</p>
                  <p className="analysis-empty-sub">Start a new analysis for this patient.</p>
                </div>
              ) : (
                <div className="analysis-history-list">
                  {analyses.map((a: any) => {
                    const risk = a.overallRisk === "high" ? { color: "#ef4444", bg: "#fef2f2", label: "High Risk" }
                              : a.overallRisk === "moderate" ? { color: "#f97316", bg: "#fff7ed", label: "Moderate" }
                              : { color: "#2563EB", bg: "#f0fdf4", label: "Normal" };
                    const topLesion = a.detectedLesions?.[0];
                    return (
                      <div key={a.id} className="analysis-history-item" style={{ position: "relative" }}>
                        <div className="analysis-type-icon" style={{ background: "#eff6ff", color: "#2563EB" }}>
                          <TypeIcon t="analysis" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p className="analysis-item-label">
                            {a.analysisType === "segmentation" ? "Lesion Segmentation" : "CAD Detection"}
                          </p>
                          <p className="analysis-item-result">
                            {topLesion ? topLesion.lesionType : "No findings"} · {Math.round(a.overallConfidence)}% conf.
                          </p>
                        </div>
                        <div className="analysis-item-right">
                          <span className="analysis-severity-badge" style={{ color: risk.color, background: risk.bg }}>
                            {risk.label}
                          </span>
                          <span className="analysis-item-date">
                            {new Date(a.analyzedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <button type="button" onClick={() => handleDeleteAnalysis(a.id)}
                            disabled={deletingAnalysis === a.id}
                            title="Delete this analysis"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: deletingAnalysis === a.id ? "#d1d5db" : "#ef4444", opacity: deletingAnalysis === a.id ? 0.5 : 1, flexShrink: 0 }}>
                            {deletingAnalysis === a.id
                              ? <span style={{ width: 12, height: 12, border: "2px solid #d1d5db", borderTopColor: "#ef4444", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────
function DeleteConfirmModal({ patient, deleting, onConfirm, onCancel }: {
  patient: { firstName: string; lastName: string };
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "2rem",
        width: "100%", maxWidth: 400,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", gap: "1.25rem",
      }}>
        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "#fef2f2", border: "1px solid #fecaca",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
        </div>

        {/* Text */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: "0 0 0.4rem", fontFamily: "var(--font-display, inherit)" }}>
            Delete Patient
          </p>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.55 }}>
            You are about to permanently delete{" "}
            <strong style={{ color: "#1e293b" }}>{patient.firstName} {patient.lastName}</strong>{" "}
            and all their visits, analyses, and reports. This action cannot be undone.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button type="button" onClick={onCancel} disabled={deleting}
            style={{
              flex: 1, padding: "0.65rem", borderRadius: 9,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#374151", fontSize: 13, fontWeight: 600,
              cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            style={{
              flex: 1, padding: "0.65rem", borderRadius: 9,
              border: "none",
              background: deleting ? "#fca5a5" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
              boxShadow: deleting ? "none" : "0 4px 14px rgba(239,68,68,0.4)",
              transition: "all 0.15s",
            }}>
            {deleting ? (
              <>
                <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                Deleting…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PatientsPage() {
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<"All" | PatientStatus>("All");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showModal, setShowModal]       = useState(false);
  const [loading, setLoading]           = useState(true);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    const doctor = stored ? JSON.parse(stored) : null;
    if (!doctor?.id) { setLoading(false); return; }

    fetch(`/api/patients?doctorId=${doctor.id}`)
      .then(r => r.json())
      .then(data => {
        const mapped: Patient[] = (data.patients ?? []).map((p: any) => ({
          id:        p.id,
          firstName: p.firstName,
          lastName:  p.lastName,
          dob:       p.dateOfBirth,
          gender:    p.gender as PatientGender,
          phone:     p.phone,
          email:     p.email,
          condition: p.condition,
          notes:     p.notes,
          status:    p.status as PatientStatus,
          age:       new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear(),
          lastVisit: p.updatedAt?.split("T")[0] ?? "",
          analyses:  [],
        }));
        setPatients(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p => {
    const matchSearch = `${p.firstName} ${p.lastName} ${p.condition}`
      .toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" || p.status === filter;
    return matchSearch && matchFilter;
  });

  const selected      = patients.find(p => p.id === selectedId) ?? null;
  const selectedIndex = patients.findIndex(p => p.id === selectedId);

  const handleAdd = (p: Patient) => {
    setPatients(prev => [p, ...prev]);
    setSelectedId(p.id);
  };

  const handleArchive = async (id: string) => {
    const patient = patients.find(p => p.id === id);
    if (!patient) return;
    const newStatus = patient.status === "Active" ? "Archived" : "Active";
    await fetch(`/api/patients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setPatients(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const handleDelete = (id: string) => setConfirmDelete(id);

  const confirmDeletePatient = async () => {
    const id = confirmDelete;
    if (!id) return;
    setDeleting(id);
    let success = false;
    try {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail ?? data.error ?? "Failed to delete patient. Please try again.");
        return;
      }
      success = true;
    } catch {
      alert("Connection error — please check your network and try again.");
      return;
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
    if (success) {
      setPatients(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  return (
    <>
      {showModal && <AddPatientModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {confirmDelete && (() => {
        const p = patients.find(pt => pt.id === confirmDelete);
        return p ? (
          <DeleteConfirmModal
            patient={p}
            deleting={deleting === confirmDelete}
            onConfirm={confirmDeletePatient}
            onCancel={() => { if (!deleting) setConfirmDelete(null); }}
          />
        ) : null;
      })()}

      <div className="patients-page-wrap">
        {/* Header */}
        <div className="patients-header">
          <h1 className="patients-page-title">
            Patients
            <span>{patients.filter(p => p.status === "Active").length} active</span>
          </h1>
          <button type="button" className="btn-add-patient" onClick={() => setShowModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Patient
          </button>
        </div>

        {/* Controls */}
        <div className="patients-controls">
          <div className="patients-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="patients-search-input" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or condition…" />
          </div>
          <div className="patients-filter-group">
            {(["All", "Active", "Archived"] as const).map(f => (
              <button key={f} type="button"
                className={`patients-filter-btn${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Layout */}
        <div className="patients-layout">
          {/* List */}
          <div className="patients-list-panel">
            <div className="patients-list-header">
              <p className="patients-list-count">
                {filtered.length} patient{filtered.length !== 1 ? "s" : ""} found
              </p>
            </div>

            {loading ? (
              <div className="patients-empty">
                <p className="patients-empty-title">Loading patients...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="patients-empty">
                <p className="patients-empty-title">No patients found</p>
                <p className="patients-empty-sub">Try adjusting your search or filter.</p>
              </div>
            ) : (
              filtered.map((p, i) => {
                const [bg, fg] = patientAvatarColors[i % patientAvatarColors.length];
                return (
                  <div key={p.id}
                    className={`patient-card${selectedId === p.id ? " selected" : ""}`}
                    onClick={() => setSelectedId(p.id)}>
                    <div className="patient-card-avatar" style={{ background: bg, color: fg }}>
                      {patientInitialsFromObj(p)}
                    </div>
                    <div className="patient-card-info">
                      <div className="patient-card-name">{p.firstName} {p.lastName}</div>
                      <div className="patient-card-meta">{p.age} yrs · {p.condition || "—"}</div>
                    </div>
                    <div className="patient-card-actions">
                      <span className="patient-status-badge" style={{
                        background: p.status === "Active" ? "#f0fdf4" : "#f9fafb",
                        color:      p.status === "Active" ? "#2563EB" : "#9ca3af",
                      }}>{p.status}</span>
                      <button type="button" className="btn-delete-patient"
                        disabled={deleting === p.id}
                        onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>
                        {deleting === p.id ? (
                          <span style={{ width: 11, height: 11, border: "1.5px solid #ef4444", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <PatientDetail
                patient={selected}
                colorPair={patientAvatarColors[selectedIndex % patientAvatarColors.length]}
                onClose={() => setSelectedId(null)}
                onArchive={handleArchive}
              />
            ) : (
              <div className="patient-no-selection">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e2e5eb"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ margin: "0 auto 1rem", display: "block" }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <p className="patient-no-selection-title">No patient selected</p>
                <p className="patient-no-selection-sub">Click on a patient from the list to view their details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}