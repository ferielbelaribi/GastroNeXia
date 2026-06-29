// // "use client";

// // import React, { useState, useEffect, useCallback, ChangeEvent } from "react";

// // // ─── Types ─────────────────────────────────────────────────────────────────────
// // type ReportStatus = "draft" | "final";
// // type SortKey = "date" | "patient" | "status" | "risk";
// // type FilterStatus = "All" | ReportStatus;
// // type Severity = "low" | "medium" | "high";

// // interface DetectedLesion {
// //   id: string;
// //   lesionType: string;
// //   classification: string;
// //   confidence: number;
// //   severity: string;
// //   description: string;
// //   location: string;
// // }

// // interface ReportData {
// //   id: string;
// //   title: string;
// //   status: ReportStatus;
// //   clinicalNotes: string;
// //   conclusion: string;
// //   recommendation: string;
// //   pdfUrl: string;
// //   generatedAt: string;
// //   patient: {
// //     id: string;
// //     firstName: string;
// //     lastName: string;
// //     dateOfBirth: string;
// //     gender: string;
// //     condition: string;
// //   };
// //   doctor: {
// //     id: string;
// //     firstName: string;
// //     lastName: string;
// //     specialty: string;
// //   };
// //   visit: {
// //     id: string;
// //     visitDate: string;
// //     visitType: string;
// //     notes: string;
// //     media?: { storageUrl: string; mediaType: string; filename: string }[];
// //   };
// //   analysis: {
// //     id: string;
// //     analysisType: string;
// //     modelVersion: string;
// //     overallRisk: string;
// //     overallConfidence: number;
// //     status: string;
// //     analyzedAt: string;
// //     detectedLesions: DetectedLesion[];
// //     media?: { storageUrl: string; mediaType: string; filename: string } | null;
// //   };
// // }

// // // ─── Helpers ───────────────────────────────────────────────────────────────────
// // function patientFullName(p: ReportData["patient"]) {
// //   return `${p.firstName} ${p.lastName}`;
// // }

// // function patientAge(dob: string) {
// //   const diff = Date.now() - new Date(dob).getTime();
// //   return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
// // }

// // function patientInitials(p: ReportData["patient"]) {
// //   return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
// // }

// // function doctorName(d: ReportData["doctor"]) {
// //   return `Dr. ${d.firstName} ${d.lastName}`;
// // }

// // function formatDate(dateStr: string) {
// //   return new Date(dateStr).toLocaleDateString("en-GB", {
// //     day: "numeric", month: "long", year: "numeric",
// //   });
// // }

// // function relativeDate(dateStr: string) {
// //   const date = new Date(dateStr);
// //   const now = new Date();
// //   const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
// //   if (diffDays === 0) return "Today";
// //   if (diffDays === 1) return "Yesterday";
// //   if (diffDays < 7) return `${diffDays}d ago`;
// //   if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
// //   return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
// // }

// // const avatarGradients: [string, string][] = [
// //   ["#2563EB", "#818cf8"], ["#f97316", "#fb923c"], ["#2563EB", "#4ade80"],
// //   ["#a855f7", "#c084fc"], ["#ef4444", "#f87171"], ["#06b6d4", "#22d3ee"],
// //   ["#eab308", "#facc15"], ["#ec4899", "#f472b6"],
// // ];

// // function severityStyle(sev: string) {
// //   if (sev === "high")   return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "High Risk" };
// //   if (sev === "medium") return { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316", label: "Medium Risk" };
// //   return                       { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", dot: "#2563EB", label: "Low Risk" };
// // }

// // function statusStyle(status: string) {
// //   if (status === "final") return { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", label: "Final" };
// //   return                          { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", icon: "✎", label: "Draft" };
// // }

// // // ─── Edit Modal ────────────────────────────────────────────────────────────────
// // function EditReportModal({
// //   report,
// //   onClose,
// //   onSaved,
// // }: {
// //   report: ReportData;
// //   onClose: () => void;
// //   onSaved: (updated: ReportData) => void;
// // }) {
// //   const [form, setForm] = useState({
// //     clinicalNotes:  report.clinicalNotes  ?? "",
// //     conclusion:     report.conclusion     ?? "",
// //     recommendation: report.recommendation ?? "",
// //     status:         report.status,
// //   });
// //   const [saving, setSaving] = useState(false);
// //   const [error,  setError]  = useState("");

// //   const handleSave = async () => {
// //     setSaving(true);
// //     setError("");
// //     try {
// //       const res = await fetch(`/api/reports/${report.id}`, {
// //         method: "PATCH",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify(form),
// //       });
// //       if (!res.ok) {
// //         const d = await res.json().catch(() => ({}));
// //         setError(d.error ?? "Failed to save");
// //         return;
// //       }
// //       const data = await res.json();
// //       const updatedReport: ReportData = { ...report, ...form, ...(data.report ?? {}) };
// //       onSaved(updatedReport);
// //       onClose();
// //     } catch {
// //       setError("Network error");
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   return (
// //     <div style={{
// //       position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
// //       display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
// //     }}>
// //       <div style={{
// //         background: "var(--bg, #fff)", borderRadius: 16, padding: "1.5rem",
// //         width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
// //       }}>
// //         {/* Header */}
// //         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
// //           <div>
// //             <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink, #111)" }}>Edit Report</h3>
// //             <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#9ca3af" }}>
// //               {patientFullName(report.patient)} · {formatDate(report.visit.visitDate)}
// //             </p>
// //           </div>
// //           <button onClick={onClose} style={{
// //             background: "none", border: "none", cursor: "pointer",
// //             fontSize: 20, color: "#9ca3af", lineHeight: 1,
// //           }}>×</button>
// //         </div>

// //         {/* Fields */}
// //         <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
// //           {[
// //             { key: "clinicalNotes",  label: "Clinical Notes",  rows: 3 },
// //             { key: "conclusion",     label: "Conclusion",      rows: 2 },
// //             { key: "recommendation", label: "Recommendation",  rows: 2 },
// //           ].map(({ key, label, rows }) => (
// //             <div key={key}>
// //               <label style={{
// //                 fontSize: 12, fontWeight: 600, color: "#6b7280",
// //                 textTransform: "uppercase", letterSpacing: "0.05em",
// //                 display: "block", marginBottom: 6,
// //               }}>
// //                 {label}
// //               </label>
// //               <textarea
// //                 rows={rows}
// //                 value={form[key as keyof typeof form] as string}
// //                 onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
// //                 style={{
// //                   width: "100%", borderRadius: 8, border: "1px solid #e5e7eb",
// //                   padding: "0.6rem 0.75rem", fontSize: 13, resize: "vertical",
// //                   fontFamily: "inherit", boxSizing: "border-box",
// //                   outline: "none", transition: "border-color 0.15s",
// //                 }}
// //                 onFocus={(e) => (e.currentTarget.style.borderColor = "#2563EB")}
// //                 onBlur={(e)  => (e.currentTarget.style.borderColor = "#e5e7eb")}
// //               />
// //             </div>
// //           ))}

// //           <div>
// //             <label style={{
// //               fontSize: 12, fontWeight: 600, color: "#6b7280",
// //               textTransform: "uppercase", letterSpacing: "0.05em",
// //               display: "block", marginBottom: 6,
// //             }}>
// //               Status
// //             </label>
// //             <select
// //               value={form.status}
// //               onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ReportStatus }))}
// //               style={{
// //                 borderRadius: 8, border: "1px solid #e5e7eb",
// //                 padding: "0.5rem 0.75rem", fontSize: 13,
// //                 fontFamily: "inherit", background: "#fff", cursor: "pointer",
// //               }}
// //             >
// //               <option value="draft">Draft</option>
// //               <option value="final">Final</option>
// //             </select>
// //           </div>
// //         </div>

// //         {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0.75rem 0 0" }}>{error}</p>}

// //         <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
// //           <button onClick={onClose} style={{
// //             padding: "0.55rem 1.2rem", borderRadius: 8,
// //             border: "1px solid #e5e7eb", background: "#fff",
// //             fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151",
// //           }}>
// //             Cancel
// //           </button>
// //           <button onClick={handleSave} disabled={saving} style={{
// //             padding: "0.55rem 1.4rem", borderRadius: 8, border: "none",
// //             background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700,
// //             cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
// //           }}>
// //             {saving ? "Saving…" : "Save Changes"}
// //           </button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // // ─── Report Preview Panel ──────────────────────────────────────────────────────
// // function ReportPreview({
// //   report: initialReport,
// //   onClose,
// //   onUpdate,
// // }: {
// //   report: ReportData;
// //   onClose: () => void;
// //   onUpdate: (r: ReportData) => void;
// // }) {
// //   const [report,  setReport]  = useState(initialReport);
// //   const [editing, setEditing] = useState(false);
// //   const [validating, setValidating] = useState(false);

// //   useEffect(() => { setReport(initialReport); }, [initialReport]);

// //   const handleSaved = (updated: ReportData) => {
// //     setReport(updated);
// //     onUpdate(updated);
// //   };

// //   const handleValidate = async () => {
// //     setValidating(true);
// //     try {
// //       const res = await fetch(`/api/reports/${report.id}`, {
// //         method: "PATCH",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({ status: "final" }),
// //       });
// //       if (res.ok) {
// //         const updated = { ...report, status: "final" as ReportStatus };
// //         setReport(updated);
// //         onUpdate(updated);
// //       }
// //     } finally {
// //       setValidating(false);
// //     }
// //   };

// //   const st  = statusStyle(report.status);
// //   const sev = severityStyle(report.analysis.overallRisk);
// //   const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
// //   const [bg, fg] = avatarGradients[idx];
// //   const age = patientAge(report.patient.dateOfBirth);

// //   // Resolve image URL: analysis.media (object) first, then visit.media[0]
// //   const imageUrl =
// //     report.analysis?.media?.storageUrl ??
// //     report.visit?.media?.[0]?.storageUrl ??
// //     null;

// //   return (
// //     <>
// //       {editing && (
// //         <EditReportModal
// //           report={report}
// //           onClose={() => setEditing(false)}
// //           onSaved={handleSaved}
// //         />
// //       )}

// //       <div className="report-preview-panel">
// //         {/* Top color bar */}
// //         <div
// //           className="report-preview-colorbar"
// //           style={{ background: `linear-gradient(90deg, ${sev.dot}, ${sev.dot}55)` }}
// //         />

// //         {/* Header */}
// //         <div className="report-preview-header">
// //           <div className="report-preview-badges">
// //             <div className="report-preview-badge-group">
// //               <span
// //                 className="report-status-pill"
// //                 style={{ color: st.color, background: st.bg, borderColor: st.border }}
// //               >
// //                 {st.icon} {st.label}
// //               </span>
// //               <span style={{
// //                 fontSize: 11, fontWeight: 600, color: "#6b7280",
// //                 background: "#f3f4f6", border: "1px solid #e5e7eb",
// //                 borderRadius: 5, padding: "2px 8px",
// //               }}>
// //                 {report.visit.visitType}
// //               </span>
// //               <span style={{
// //                 fontSize: 11, fontWeight: 600, color: "#6b7280",
// //                 background: "#f3f4f6", border: "1px solid #e5e7eb",
// //                 borderRadius: 5, padding: "2px 8px",
// //               }}>
// //                 {report.analysis.analysisType === "detection" ? "Detection" : "Segmentation"}
// //               </span>
// //             </div>
// //             <button type="button" className="report-close-btn" onClick={onClose}>×</button>
// //           </div>

// //           {/* Patient strip */}
// //           <div className="report-patient-strip" style={{ marginTop: "0.85rem" }}>
// //             <div
// //               className="report-patient-avatar"
// //               style={{ background: `linear-gradient(135deg, ${bg}, ${fg}44)`, color: fg }}
// //             >
// //               {patientInitials(report.patient)}
// //             </div>
// //             <div style={{ flex: 1 }}>
// //               <p className="report-patient-fullname">{patientFullName(report.patient)}</p>
// //               <p className="report-patient-meta">
// //                 {age} years old · {report.patient.gender}
// //                 {report.patient.condition ? ` · ${report.patient.condition}` : ""}
// //               </p>
// //             </div>
// //             <span
// //               className="report-risk-badge"
// //               style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
// //             >
// //               {sev.label}
// //             </span>
// //           </div>

// //           {/* Doctor + Date */}
// //           <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
// //             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
// //               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
// //                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
// //                 <circle cx="12" cy="7" r="4" />
// //               </svg>
// //               <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
// //                 {doctorName(report.doctor)}
// //               </span>
// //               {report.doctor.specialty && (
// //                 <span style={{ fontSize: 11, color: "#9ca3af" }}>· {report.doctor.specialty}</span>
// //               )}
// //             </div>
// //             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
// //               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
// //                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                 <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
// //                 <line x1="16" y1="2" x2="16" y2="6" />
// //                 <line x1="8" y1="2" x2="8" y2="6" />
// //                 <line x1="3" y1="10" x2="21" y2="10" />
// //               </svg>
// //               <span style={{ fontSize: 12, color: "#374151" }}>
// //                 {formatDate(report.visit.visitDate)}
// //               </span>
// //             </div>
// //           </div>
// //         </div>

// //         {/* Body */}
// //         <div className="report-preview-body">

// //           {/* Endoscopy Image */}
// //           {imageUrl && (
// //             <div className="report-section">
// //               <p className="report-section-label">Endoscopy Image</p>
// //               <div style={{
// //                 borderRadius: 10, overflow: "hidden",
// //                 border: "1px solid #e5e7eb", background: "#000",
// //               }}>
// //                 <img
// //                   src={imageUrl}
// //                   alt="Endoscopy"
// //                   style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }}
// //                 />
// //               </div>
// //             </div>
// //           )}

// //           {/* Clinical Notes */}
// //           {report.clinicalNotes && (
// //             <div className="report-section">
// //               <p className="report-section-label">Clinical Notes</p>
// //               <p className="report-summary-text">{report.clinicalNotes}</p>
// //             </div>
// //           )}

// //           {/* Conclusion */}
// //           {report.conclusion && (
// //             <div className="report-section">
// //               <p className="report-section-label">Conclusion</p>
// //               <p className="report-summary-text">{report.conclusion}</p>
// //             </div>
// //           )}

// //           {/* Findings */}
// //           {report.analysis.detectedLesions.length > 0 ? (
// //             <div className="report-section">
// //               <p className="report-section-label">
// //                 Findings ({report.analysis.detectedLesions.length})
// //               </p>
// //               <div className="report-findings-list">
// //                 {report.analysis.detectedLesions.map((lesion) => {
// //                   const fs = severityStyle(lesion.severity);
// //                   return (
// //                     <div
// //                       key={lesion.id}
// //                       className="report-finding-item"
// //                       style={{ borderColor: fs.border }}
// //                     >
// //                       <span className="report-finding-dot" style={{ background: fs.dot }} />
// //                       <div style={{ flex: 1 }}>
// //                         <div style={{
// //                           display: "flex", justifyContent: "space-between",
// //                           alignItems: "center", marginBottom: "0.15rem",
// //                         }}>
// //                           <p className="report-finding-name">{lesion.lesionType}</p>
// //                           <span
// //                             className="report-finding-badge"
// //                             style={{ color: fs.color, background: fs.bg }}
// //                           >
// //                             {fs.label}
// //                           </span>
// //                         </div>
// //                         {lesion.location && (
// //                           <p className="report-finding-detail">Location: {lesion.location}</p>
// //                         )}
// //                         {lesion.description && (
// //                           <p className="report-finding-detail">{lesion.description}</p>
// //                         )}
// //                         <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}>
// //                           <div style={{ flex: 1, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
// //                             <div style={{ width: `${lesion.confidence}%`, height: "100%", background: fs.dot, borderRadius: 2 }} />
// //                           </div>
// //                           <span style={{ fontSize: 10, color: fs.color, fontWeight: 700, minWidth: 32 }}>
// //                             {Math.round(lesion.confidence)}%
// //                           </span>
// //                         </div>
// //                       </div>
// //                     </div>
// //                   );
// //                 })}
// //               </div>
// //             </div>
// //           ) : (
// //             <div className="report-section">
// //               <div style={{
// //                 background: "#f0fdf4", border: "1px solid #bbf7d0",
// //                 borderRadius: 10, padding: "1rem",
// //                 display: "flex", alignItems: "center", gap: "0.75rem",
// //               }}>
// //                 <span style={{ fontSize: 20 }}>✓</span>
// //                 <div>
// //                   <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#15803d" }}>
// //                     No significant findings
// //                   </p>
// //                   <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#16a34a" }}>
// //                     The analysis did not detect any lesions.
// //                   </p>
// //                 </div>
// //               </div>
// //             </div>
// //           )}

// //           {/* Recommendation */}
// //           {report.recommendation && (
// //             <div className="report-section">
// //               <p className="report-section-label">Recommendation</p>
// //               <div
// //                 className="report-recommendation-box"
// //                 style={{ background: sev.bg, borderColor: sev.border }}
// //               >
// //                 <p className="report-recommendation-text">{report.recommendation}</p>
// //               </div>
// //             </div>
// //           )}

// //           {/* Analysis Meta */}
// //           <div className="report-section">
// //             <p className="report-section-label">Analysis Info</p>
// //             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
// //               {[
// //                 ["Model",      report.analysis.modelVersion],
// //                 ["Type",       report.analysis.analysisType],
// //                 ["Confidence", `${Math.round(report.analysis.overallConfidence)}%`],
// //                 ["Analyzed",   formatDate(report.analysis.analyzedAt)],
// //               ].map(([label, value]) => (
// //                 <div key={label} style={{
// //                   background: "#f9fafb", border: "1px solid #f3f4f6",
// //                   borderRadius: 7, padding: "0.45rem 0.6rem",
// //                 }}>
// //                   <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
// //                     {label}
// //                   </p>
// //                   <p style={{ fontSize: 12, color: "#374151", fontWeight: 600, margin: "0.15rem 0 0" }}>
// //                     {value}
// //                   </p>
// //                 </div>
// //               ))}
// //             </div>
// //           </div>
// //         </div>

// //         {/* Footer */}
// //         <div className="report-preview-footer">
// //           {report.pdfUrl && (
// //             <a
// //               href={report.pdfUrl}
// //               target="_blank"
// //               rel="noreferrer"
// //               className="btn-download-pdf"
// //             >
// //               <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
// //                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
// //                 <polyline points="7 10 12 15 17 10" />
// //                 <line x1="12" y1="15" x2="12" y2="3" />
// //               </svg>
// //               Download PDF
// //             </a>
// //           )}

// //           {report.status === "draft" && (
// //             <button
// //               type="button"
// //               className="btn-validate"
// //               onClick={handleValidate}
// //               disabled={validating}
// //               style={{ opacity: validating ? 0.7 : 1, cursor: validating ? "not-allowed" : "pointer" }}
// //             >
// //               <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
// //                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                 <polyline points="20 6 9 17 4 12" />
// //               </svg>
// //               {validating ? "Validating…" : "Validate"}
// //             </button>
// //           )}

// //           {report.status === "final" && (
// //             <button type="button" className="btn-send-patient">
// //               <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
// //                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                 <line x1="22" y1="2" x2="11" y2="13" />
// //                 <polygon points="22 2 15 22 11 13 2 9 22 2" />
// //               </svg>
// //               Send to Patient
// //             </button>
// //           )}

// //           <button
// //             type="button"
// //             className="btn-edit-report"
// //             onClick={() => setEditing(true)}
// //             title="Edit Report"
// //           >
// //             <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
// //               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
// //               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
// //             </svg>
// //           </button>
// //         </div>
// //       </div>
// //     </>
// //   );
// // }

// // // ─── Report List Item ──────────────────────────────────────────────────────────
// // function ReportListItem({
// //   report,
// //   isSelected,
// //   onClick,
// // }: {
// //   report: ReportData;
// //   isSelected: boolean;
// //   onClick: () => void;
// // }) {
// //   const st  = statusStyle(report.status);
// //   const sev = severityStyle(report.analysis.overallRisk);
// //   const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
// //   const [bg, fg] = avatarGradients[idx];

// //   return (
// //     <div
// //       className={`report-list-item${isSelected ? " selected" : ""}`}
// //       onClick={onClick}
// //     >
// //       <div style={{
// //         width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
// //         background: `linear-gradient(135deg, ${bg}, ${fg}44)`,
// //         display: "flex", alignItems: "center", justifyContent: "center",
// //         fontSize: "0.65rem", fontWeight: 800, color: fg,
// //       }}>
// //         {patientInitials(report.patient)}
// //       </div>
// //       <div style={{ flex: 1, minWidth: 0 }}>
// //         <p className="report-list-title">
// //           {report.patient.firstName} {report.patient.lastName}
// //         </p>
// //         <p style={{
// //           fontSize: 11, color: "#9ca3af", margin: "0.1rem 0 0",
// //           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
// //         }}>
// //           {report.visit.visitType} · {doctorName(report.doctor)}
// //         </p>
// //       </div>
// //       <div className="report-list-right">
// //         <span
// //           className="report-status-badge"
// //           style={{ color: st.color, background: st.bg, borderColor: st.border }}
// //         >
// //           {st.icon} {st.label}
// //         </span>
// //         <div className="report-date-row">
// //           <span className="report-date-dot" style={{ background: sev.dot }} />
// //           <span className="report-date-text">{relativeDate(report.generatedAt)}</span>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // // ─── Main Page ─────────────────────────────────────────────────────────────────
// // export default function ReportsPage() {
// //   const [reports,       setReports]       = useState<ReportData[]>([]);
// //   const [loading,       setLoading]       = useState(true);
// //   const [error,         setError]         = useState<string | null>(null);
// //   const [selected,      setSelected]      = useState<ReportData | null>(null);
// //   const [search,        setSearch]        = useState("");
// //   const [statusFilter,  setStatusFilter]  = useState<FilterStatus>("All");
// //   const [riskFilter,    setRiskFilter]    = useState<"All" | Severity>("All");
// //   const [sortKey,       setSortKey]       = useState<SortKey>("date");

// //   const fetchReports = useCallback(async () => {
// //   try {
// //     setLoading(true);
// //     setError(null);

// //     // قرا doctorId من localStorage
// //     const stored = localStorage.getItem("doctor");
// //     const doctor = stored ? JSON.parse(stored) : null;
// //     const url = doctor?.id
// //       ? `/api/reports?doctorId=${doctor.id}`
// //       : "/api/reports";

// //     const res = await fetch(url);
// //     if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
// //     const data: ReportData[] = await res.json();
// //     setReports(data);
// //     setSelected((prev) => (prev ? prev : data[0] ?? null));
// //   } catch (err: unknown) {
// //     setError(err instanceof Error ? err.message : "Unknown error");
// //   } finally {
// //     setLoading(false);
// //   }
// // }, []);

// //   useEffect(() => { fetchReports(); }, [fetchReports]);

// //   const handleUpdate = (updated: ReportData) => {
// //     setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
// //     setSelected((prev) => (prev?.id === updated.id ? updated : prev));
// //   };

// //   const filtered = reports
// //     .filter((r) => {
// //       const q    = search.toLowerCase();
// //       const name = patientFullName(r.patient).toLowerCase();
// //       const doc  = doctorName(r.doctor).toLowerCase();
// //       return (
// //         (r.title.toLowerCase().includes(q) || name.includes(q) || doc.includes(q)) &&
// //         (statusFilter === "All" || r.status === statusFilter) &&
// //         (riskFilter   === "All" || r.analysis.overallRisk === riskFilter)
// //       );
// //     })
// //     .sort((a, b) => {
// //       if (sortKey === "date")    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
// //       if (sortKey === "patient") return patientFullName(a.patient).localeCompare(patientFullName(b.patient));
// //       if (sortKey === "status")  return a.status.localeCompare(b.status);
// //       return a.analysis.overallRisk.localeCompare(b.analysis.overallRisk);
// //     });

// //   return (
// //     <div className="reports-wrap">
// //       {/* ── Page Header ── */}
// //       <div className="reports-header">
// //         <div>
// //           <h1 className="reports-title">Reports</h1>
// //           <p className="reports-subtitle">
// //             View, validate, and manage all endoscopy diagnostic reports.
// //           </p>
// //         </div>
// //       </div>

// //       {/* ── Toolbar ── */}
// //       <div className="reports-toolbar">
// //         <div className="reports-search-box">
// //           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
// //             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //             <circle cx="11" cy="11" r="8" />
// //             <line x1="21" y1="21" x2="16.65" y2="16.65" />
// //           </svg>
// //           <input
// //             className="reports-search-input"
// //             value={search}
// //             onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
// //             placeholder="Search by patient, doctor…"
// //           />
// //           {search && (
// //             <button type="button" className="reports-search-clear" onClick={() => setSearch("")}>
// //               ×
// //             </button>
// //           )}
// //         </div>

// //         {/* Status filters */}
// //         <div className="reports-filter-group">
// //           {(["All", "draft", "final"] as FilterStatus[]).map((f) => (
// //             <button
// //               key={f}
// //               type="button"
// //               className={`reports-filter-btn${statusFilter === f ? " active" : ""}`}
// //               onClick={() => setStatusFilter(f)}
// //             >
// //               {f === "All" ? "All" : statusStyle(f as ReportStatus).label}
// //             </button>
// //           ))}
// //         </div>

// //         {/* Risk filters */}
// //         <div className="reports-filter-group">
// //           {(["All", "high", "medium", "low"] as const).map((f) => {
// //             const s = f === "All" ? null : severityStyle(f);
// //             return (
// //               <button
// //                 key={f}
// //                 type="button"
// //                 className={`reports-filter-btn${riskFilter === f ? " active" : ""}`}
// //                 onClick={() => setRiskFilter(f)}
// //                 style={
// //                   riskFilter === f && s
// //                     ? { background: s.bg, color: s.color, borderColor: s.border }
// //                     : {}
// //                 }
// //               >
// //                 {f === "All" ? "All Risk" : s!.label}
// //               </button>
// //             );
// //           })}
// //         </div>

// //         <select
// //           className="reports-sort-select"
// //           value={sortKey}
// //           onChange={(e) => setSortKey(e.target.value as SortKey)}
// //         >
// //           <option value="date">Latest</option>
// //           <option value="patient">Patient</option>
// //           <option value="status">Status</option>
// //           <option value="risk">Risk</option>
// //         </select>
// //       </div>

// //       {/* ── Layout ── */}
// //       <div className="reports-layout">
// //         {/* Left: List */}
// //         <div className="reports-list-panel">
// //           <div className="reports-list-header">
// //             <span className="reports-list-meta">
// //               {filtered.length} report{filtered.length !== 1 ? "s" : ""}
// //             </span>
// //           </div>
// //           <div className="reports-list-scroll">
// //             {loading ? (
// //               <div className="reports-empty">
// //                 <div className="reports-empty-icon">⏳</div>
// //                 <p className="reports-empty-title">Loading reports…</p>
// //               </div>
// //             ) : error ? (
// //               <div className="reports-empty">
// //                 <div className="reports-empty-icon">⚠️</div>
// //                 <p className="reports-empty-title">Error loading reports</p>
// //                 <p className="reports-empty-sub">{error}</p>
// //               </div>
// //             ) : filtered.length === 0 ? (
// //               <div className="reports-empty">
// //                 <div className="reports-empty-icon">📄</div>
// //                 <p className="reports-empty-title">No reports found</p>
// //                 <p className="reports-empty-sub">
// //                   {reports.length === 0
// //                     ? "Generate a report from the Analysis page."
// //                     : "Try adjusting your filters."}
// //                 </p>
// //               </div>
// //             ) : (
// //               filtered.map((r) => (
// //                 <ReportListItem
// //                   key={r.id}
// //                   report={r}
// //                   isSelected={selected?.id === r.id}
// //                   onClick={() => setSelected(r)}
// //                 />
// //               ))
// //             )}
// //           </div>
// //         </div>

// //         {/* Right: Preview */}
// //         {selected ? (
// //           <ReportPreview
// //             report={selected}
// //             onClose={() => setSelected(null)}
// //             onUpdate={handleUpdate}
// //           />
// //         ) : (
// //           <div className="report-no-selection">
// //             <div className="report-no-selection-icon">📋</div>
// //             <p className="report-no-selection-title">No report selected</p>
// //             <p className="report-no-selection-sub">
// //               Select a report from the list to preview it.
// //             </p>
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }

// "use client";

// import React, { useState, useEffect, useCallback, ChangeEvent } from "react";

// // ─── Types ─────────────────────────────────────────────────────────────────────
// type ReportStatus = "draft" | "final";
// type SortKey = "date" | "patient" | "status" | "risk";
// type FilterStatus = "All" | ReportStatus;
// type Severity = "low" | "medium" | "high";

// interface DetectedLesion {
//   id: string;
//   lesionType: string;
//   classification: string;
//   confidence: number;
//   severity: string;
//   description: string;
//   location: string;
// }

// // ✅ أضفنا الحقول الجديدة للميديا
// interface MediaRecord {
//   storageUrl:    string;
//   annotatedUrl?: string;
//   gradcamUrl?:   string;
//   overlayUrl?:   string;
//   mediaType:     string;
//   filename:      string;
// }

// interface ReportData {
//   id: string;
//   title: string;
//   status: ReportStatus;
//   clinicalNotes: string;
//   conclusion: string;
//   recommendation: string;
//   pdfUrl: string;
//   generatedAt: string;
//   patient: {
//     id: string;
//     firstName: string;
//     lastName: string;
//     dateOfBirth: string;
//     gender: string;
//     condition: string;
//   };
//   doctor: {
//     id: string;
//     firstName: string;
//     lastName: string;
//     specialty: string;
//   };
//   visit: {
//     id: string;
//     visitDate: string;
//     visitType: string;
//     notes: string;
//     media?: MediaRecord[];
//   };
//   analysis: {
//     id: string;
//     analysisType: string;
//     modelVersion: string;
//     overallRisk: string;
//     overallConfidence: number;
//     status: string;
//     analyzedAt: string;
//     detectedLesions: DetectedLesion[];
//     media?: MediaRecord | null;
//   };
// }

// // ─── Helpers ───────────────────────────────────────────────────────────────────
// function patientFullName(p: ReportData["patient"]) {
//   return `${p.firstName} ${p.lastName}`;
// }

// function patientAge(dob: string) {
//   const diff = Date.now() - new Date(dob).getTime();
//   return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
// }

// function patientInitials(p: ReportData["patient"]) {
//   return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
// }

// function doctorName(d: ReportData["doctor"]) {
//   return `Dr. ${d.firstName} ${d.lastName}`;
// }

// function formatDate(dateStr: string) {
//   return new Date(dateStr).toLocaleDateString("en-GB", {
//     day: "numeric", month: "long", year: "numeric",
//   });
// }

// function relativeDate(dateStr: string) {
//   const date = new Date(dateStr);
//   const now = new Date();
//   const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
//   if (diffDays === 0) return "Today";
//   if (diffDays === 1) return "Yesterday";
//   if (diffDays < 7) return `${diffDays}d ago`;
//   if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
//   return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
// }

// const avatarGradients: [string, string][] = [
//   ["#2563EB", "#818cf8"], ["#f97316", "#fb923c"], ["#2563EB", "#4ade80"],
//   ["#a855f7", "#c084fc"], ["#ef4444", "#f87171"], ["#06b6d4", "#22d3ee"],
//   ["#eab308", "#facc15"], ["#ec4899", "#f472b6"],
// ];

// function severityStyle(sev: string) {
//   if (sev === "high")   return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "High Risk" };
//   if (sev === "medium") return { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316", label: "Medium Risk" };
//   return                       { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", dot: "#2563EB", label: "Low Risk" };
// }

// function statusStyle(status: string) {
//   if (status === "final") return { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", label: "Final" };
//   return                          { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", icon: "✎", label: "Draft" };
// }

// // ✅ دالة مساعدة: تختار الصورة الصحيحة حسب نوع التحليل ووجود ليزيون
// function resolveReportImage(report: ReportData): {
//   primary: string | null;
//   secondary: string | null;
//   primaryLabel: string;
//   secondaryLabel: string;
// } {
//   const media = report.analysis?.media ?? report.visit?.media?.[0] ?? null;
//   const hasLesions = report.analysis.detectedLesions.length > 0;
//   const analysisType = report.analysis.analysisType;

//   if (!media) return { primary: null, secondary: null, primaryLabel: "", secondaryLabel: "" };

//   if (analysisType === "segmentation") {
//     // للسيقمونطاسيون: overlay (mask) كصورة رئيسية، أصلية ثانوية
//     return {
//       primary:       media.overlayUrl   || media.storageUrl,
//       secondary:     media.overlayUrl ? media.storageUrl : null,
//       primaryLabel:  media.overlayUrl ? "Segmentation Mask" : "Endoscopy Image",
//       secondaryLabel: "Original",
//     };
//   }

//   // للديتاكشن
//   if (hasLesions) {
//     return {
//       primary:        media.annotatedUrl || media.storageUrl,
//       secondary:      media.gradcamUrl   || null,
//       primaryLabel:   media.annotatedUrl ? "Detection Result" : "Endoscopy Image",
//       secondaryLabel: media.gradcamUrl   ? "Grad-CAM" : "",
//     };
//   }

//   // لا يوجد ليزيون: الصورة الأصلية فقط
//   return {
//     primary:       media.storageUrl,
//     secondary:     null,
//     primaryLabel:  "Endoscopy Image",
//     secondaryLabel: "",
//   };
// }

// // ─── Edit Modal ────────────────────────────────────────────────────────────────
// function EditReportModal({
//   report,
//   onClose,
//   onSaved,
// }: {
//   report: ReportData;
//   onClose: () => void;
//   onSaved: (updated: ReportData) => void;
// }) {
//   const [form, setForm] = useState({
//     clinicalNotes:  report.clinicalNotes  ?? "",
//     conclusion:     report.conclusion     ?? "",
//     recommendation: report.recommendation ?? "",
//     status:         report.status,
//   });
//   const [saving, setSaving] = useState(false);
//   const [error,  setError]  = useState("");

//   const handleSave = async () => {
//     setSaving(true);
//     setError("");
//     try {
//       const res = await fetch(`/api/reports/${report.id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(form),
//       });
//       if (!res.ok) {
//         const d = await res.json().catch(() => ({}));
//         setError(d.error ?? "Failed to save");
//         return;
//       }
//       const data = await res.json();
//       const updatedReport: ReportData = { ...report, ...form, ...(data.report ?? {}) };
//       onSaved(updatedReport);
//       onClose();
//     } catch {
//       setError("Network error");
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div style={{
//       position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
//       display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
//     }}>
//       <div style={{
//         background: "var(--bg, #fff)", borderRadius: 16, padding: "1.5rem",
//         width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
//       }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
//           <div>
//             <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink, #111)" }}>Edit Report</h3>
//             <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#9ca3af" }}>
//               {patientFullName(report.patient)} · {formatDate(report.visit.visitDate)}
//             </p>
//           </div>
//           <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af", lineHeight: 1 }}>×</button>
//         </div>

//         <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
//           {[
//             { key: "clinicalNotes",  label: "Clinical Notes",  rows: 3 },
//             { key: "conclusion",     label: "Conclusion",      rows: 2 },
//             { key: "recommendation", label: "Recommendation",  rows: 2 },
//           ].map(({ key, label, rows }) => (
//             <div key={key}>
//               <label style={{
//                 fontSize: 12, fontWeight: 600, color: "#6b7280",
//                 textTransform: "uppercase", letterSpacing: "0.05em",
//                 display: "block", marginBottom: 6,
//               }}>
//                 {label}
//               </label>
//               <textarea
//                 rows={rows}
//                 value={form[key as keyof typeof form] as string}
//                 onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
//                 style={{
//                   width: "100%", borderRadius: 8, border: "1px solid #e5e7eb",
//                   padding: "0.6rem 0.75rem", fontSize: 13, resize: "vertical",
//                   fontFamily: "inherit", boxSizing: "border-box",
//                   outline: "none", transition: "border-color 0.15s",
//                 }}
//                 onFocus={(e) => (e.currentTarget.style.borderColor = "#2563EB")}
//                 onBlur={(e)  => (e.currentTarget.style.borderColor = "#e5e7eb")}
//               />
//             </div>
//           ))}

//           <div>
//             <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
//               Status
//             </label>
//             <select
//               value={form.status}
//               onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ReportStatus }))}
//               style={{ borderRadius: 8, border: "1px solid #e5e7eb", padding: "0.5rem 0.75rem", fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
//             >
//               <option value="draft">Draft</option>
//               <option value="final">Final</option>
//             </select>
//           </div>
//         </div>

//         {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0.75rem 0 0" }}>{error}</p>}

//         <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
//           <button onClick={onClose} style={{ padding: "0.55rem 1.2rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
//             Cancel
//           </button>
//           <button onClick={handleSave} disabled={saving} style={{ padding: "0.55rem 1.4rem", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
//             {saving ? "Saving…" : "Save Changes"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Report Preview Panel ──────────────────────────────────────────────────────
// function ReportPreview({
//   report: initialReport,
//   onClose,
//   onUpdate,
// }: {
//   report: ReportData;
//   onClose: () => void;
//   onUpdate: (r: ReportData) => void;
// }) {
//   const [report,     setReport]     = useState(initialReport);
//   const [editing,    setEditing]    = useState(false);
//   const [validating, setValidating] = useState(false);
//   // ✅ toggle بين الصورة الرئيسية والثانوية
//   const [showSecondary, setShowSecondary] = useState(false);

//   useEffect(() => { setReport(initialReport); setShowSecondary(false); }, [initialReport]);

//   const handleSaved = (updated: ReportData) => {
//     setReport(updated);
//     onUpdate(updated);
//   };

//   const handleValidate = async () => {
//     setValidating(true);
//     try {
//       const res = await fetch(`/api/reports/${report.id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ status: "final" }),
//       });
//       if (res.ok) {
//         const updated = { ...report, status: "final" as ReportStatus };
//         setReport(updated);
//         onUpdate(updated);
//       }
//     } finally {
//       setValidating(false);
//     }
//   };

//   const st  = statusStyle(report.status);
//   const sev = severityStyle(report.analysis.overallRisk);
//   const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
//   const [bg, fg] = avatarGradients[idx];
//   const age = patientAge(report.patient.dateOfBirth);

//   // ✅ استخدام الدالة الجديدة
//   const { primary, secondary, primaryLabel, secondaryLabel } = resolveReportImage(report);
//   const displayUrl = showSecondary && secondary ? secondary : primary;
//   const displayLabel = showSecondary && secondary ? secondaryLabel : primaryLabel;

//   return (
//     <>
//       {editing && (
//         <EditReportModal
//           report={report}
//           onClose={() => setEditing(false)}
//           onSaved={handleSaved}
//         />
//       )}

//       <div className="report-preview-panel">
//         <div
//           className="report-preview-colorbar"
//           style={{ background: `linear-gradient(90deg, ${sev.dot}, ${sev.dot}55)` }}
//         />

//         {/* Header */}
//         <div className="report-preview-header">
//           <div className="report-preview-badges">
//             <div className="report-preview-badge-group">
//               <span className="report-status-pill" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
//                 {st.icon} {st.label}
//               </span>
//               <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 8px" }}>
//                 {report.visit.visitType}
//               </span>
//               <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 8px" }}>
//                 {report.analysis.analysisType === "detection" ? "Detection" : "Segmentation"}
//               </span>
//             </div>
//             <button type="button" className="report-close-btn" onClick={onClose}>×</button>
//           </div>

//           <div className="report-patient-strip" style={{ marginTop: "0.85rem" }}>
//             <div className="report-patient-avatar" style={{ background: `linear-gradient(135deg, ${bg}, ${fg}44)`, color: fg }}>
//               {patientInitials(report.patient)}
//             </div>
//             <div style={{ flex: 1 }}>
//               <p className="report-patient-fullname">{patientFullName(report.patient)}</p>
//               <p className="report-patient-meta">
//                 {age} years old · {report.patient.gender}
//                 {report.patient.condition ? ` · ${report.patient.condition}` : ""}
//               </p>
//             </div>
//             <span className="report-risk-badge" style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
//               {sev.label}
//             </span>
//           </div>

//           <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
//             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
//               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
//               </svg>
//               <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{doctorName(report.doctor)}</span>
//               {report.doctor.specialty && <span style={{ fontSize: 11, color: "#9ca3af" }}>· {report.doctor.specialty}</span>}
//             </div>
//             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
//               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
//                 <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
//               </svg>
//               <span style={{ fontSize: 12, color: "#374151" }}>{formatDate(report.visit.visitDate)}</span>
//             </div>
//           </div>
//         </div>

//         {/* Body */}
//         <div className="report-preview-body">

//           {/* ✅ صورة الإندوسكوبي مع التحكم */}
//           {primary && (
//             <div className="report-section">
//               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
//                 <p className="report-section-label" style={{ margin: 0 }}>{displayLabel}</p>
//                 {/* زر التبديل بين الصورتين */}
//                 {secondary && (
//                   <button
//                     type="button"
//                     onClick={() => setShowSecondary(!showSecondary)}
//                     style={{
//                       fontSize: 11, fontWeight: 600, cursor: "pointer",
//                       padding: "2px 10px", borderRadius: 5,
//                       border: `1px solid ${showSecondary ? "#2563EB" : "#e5e7eb"}`,
//                       background: showSecondary ? "#eff6ff" : "#f9fafb",
//                       color: showSecondary ? "#2563eb" : "#6b7280",
//                     }}
//                   >
//                     {showSecondary ? `← ${primaryLabel}` : `${secondaryLabel} →`}
//                   </button>
//                 )}
//               </div>
//               <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb", background: "#000" }}>
//                 <img
//                   src={displayUrl ?? ""}
//                   alt={displayLabel}
//                   style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }}
//                 />
//               </div>
//               {/* ✅ عرض الصورتين معاً إذا كانتا موجودتين */}
//               {secondary && !showSecondary && (
//                 <div style={{ marginTop: "0.5rem", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", background: "#000" }}>
//                   <div style={{ padding: "4px 8px", background: "#1e293b", fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>
//                     {secondaryLabel}
//                   </div>
//                   <img
//                     src={secondary}
//                     alt={secondaryLabel}
//                     style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }}
//                   />
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Clinical Notes */}
//           {report.clinicalNotes && (
//             <div className="report-section">
//               <p className="report-section-label">Clinical Notes</p>
//               <p className="report-summary-text">{report.clinicalNotes}</p>
//             </div>
//           )}

//           {/* Conclusion */}
//           {report.conclusion && (
//             <div className="report-section">
//               <p className="report-section-label">Conclusion</p>
//               <p className="report-summary-text">{report.conclusion}</p>
//             </div>
//           )}

//           {/* Findings */}
//           {report.analysis.detectedLesions.length > 0 ? (
//             <div className="report-section">
//               <p className="report-section-label">Findings ({report.analysis.detectedLesions.length})</p>
//               <div className="report-findings-list">
//                 {report.analysis.detectedLesions.map((lesion) => {
//                   const fs = severityStyle(lesion.severity);
//                   return (
//                     <div key={lesion.id} className="report-finding-item" style={{ borderColor: fs.border }}>
//                       <span className="report-finding-dot" style={{ background: fs.dot }} />
//                       <div style={{ flex: 1 }}>
//                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
//                           <p className="report-finding-name">{lesion.lesionType}</p>
//                           <span className="report-finding-badge" style={{ color: fs.color, background: fs.bg }}>{fs.label}</span>
//                         </div>
//                         {lesion.location && <p className="report-finding-detail">Location: {lesion.location}</p>}
//                         {lesion.description && <p className="report-finding-detail">{lesion.description}</p>}
//                         <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}>
//                           <div style={{ flex: 1, height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
//                             <div style={{ width: `${lesion.confidence}%`, height: "100%", background: fs.dot, borderRadius: 2 }} />
//                           </div>
//                           <span style={{ fontSize: 10, color: fs.color, fontWeight: 700, minWidth: 32 }}>
//                             {Math.round(lesion.confidence)}%
//                           </span>
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           ) : (
//             <div className="report-section">
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
//                 <span style={{ fontSize: 20 }}>✓</span>
//                 <div>
//                   <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#15803d" }}>No significant findings</p>
//                   <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#16a34a" }}>The analysis did not detect any lesions.</p>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Recommendation */}
//           {report.recommendation && (
//             <div className="report-section">
//               <p className="report-section-label">Recommendation</p>
//               <div className="report-recommendation-box" style={{ background: sev.bg, borderColor: sev.border }}>
//                 <p className="report-recommendation-text">{report.recommendation}</p>
//               </div>
//             </div>
//           )}

//           {/* Analysis Meta */}
//           <div className="report-section">
//             <p className="report-section-label">Analysis Info</p>
//             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
//               {[
//                 ["Model",      report.analysis.modelVersion],
//                 ["Type",       report.analysis.analysisType],
//                 ["Confidence", `${Math.round(report.analysis.overallConfidence)}%`],
//                 ["Analyzed",   formatDate(report.analysis.analyzedAt)],
//               ].map(([label, value]) => (
//                 <div key={label} style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 7, padding: "0.45rem 0.6rem" }}>
//                   <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{label}</p>
//                   <p style={{ fontSize: 12, color: "#374151", fontWeight: 600, margin: "0.15rem 0 0" }}>{value}</p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="report-preview-footer">
//           {report.pdfUrl && (
//             <a href={report.pdfUrl} target="_blank" rel="noreferrer" className="btn-download-pdf">
//               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
//                 <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
//               </svg>
//               Download PDF
//             </a>
//           )}
//           {report.status === "draft" && (
//             <button type="button" className="btn-validate" onClick={handleValidate} disabled={validating} style={{ opacity: validating ? 0.7 : 1, cursor: validating ? "not-allowed" : "pointer" }}>
//               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <polyline points="20 6 9 17 4 12" />
//               </svg>
//               {validating ? "Validating…" : "Validate"}
//             </button>
//           )}
//           {report.status === "final" && (
//             <button type="button" className="btn-send-patient">
//               <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                 <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
//               </svg>
//               Send to Patient
//             </button>
//           )}
//           <button type="button" className="btn-edit-report" onClick={() => setEditing(true)} title="Edit Report">
//             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
//               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
//             </svg>
//           </button>
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Report List Item ──────────────────────────────────────────────────────────
// function ReportListItem({ report, isSelected, onClick }: { report: ReportData; isSelected: boolean; onClick: () => void }) {
//   const st  = statusStyle(report.status);
//   const sev = severityStyle(report.analysis.overallRisk);
//   const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
//   const [bg, fg] = avatarGradients[idx];

//   return (
//     <div className={`report-list-item${isSelected ? " selected" : ""}`} onClick={onClick}>
//       <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${bg}, ${fg}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: fg }}>
//         {patientInitials(report.patient)}
//       </div>
//       <div style={{ flex: 1, minWidth: 0 }}>
//         <p className="report-list-title">{report.patient.firstName} {report.patient.lastName}</p>
//         <p style={{ fontSize: 11, color: "#9ca3af", margin: "0.1rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
//           {report.visit.visitType} · {doctorName(report.doctor)}
//         </p>
//       </div>
//       <div className="report-list-right">
//         <span className="report-status-badge" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
//           {st.icon} {st.label}
//         </span>
//         <div className="report-date-row">
//           <span className="report-date-dot" style={{ background: sev.dot }} />
//           <span className="report-date-text">{relativeDate(report.generatedAt)}</span>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Main Page ─────────────────────────────────────────────────────────────────
// export default function ReportsPage() {
//   const [reports,      setReports]      = useState<ReportData[]>([]);
//   const [loading,      setLoading]      = useState(true);
//   const [error,        setError]        = useState<string | null>(null);
//   const [selected,     setSelected]     = useState<ReportData | null>(null);
//   const [search,       setSearch]       = useState("");
//   const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
//   const [riskFilter,   setRiskFilter]   = useState<"All" | Severity>("All");
//   const [sortKey,      setSortKey]      = useState<SortKey>("date");

//   const fetchReports = useCallback(async () => {
//     try {
//       setLoading(true); setError(null);
//       const stored = localStorage.getItem("doctor");
//       const doctor = stored ? JSON.parse(stored) : null;
//       const url = doctor?.id ? `/api/reports?doctorId=${doctor.id}` : "/api/reports";
//       const res = await fetch(url);
//       if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
//       const data: ReportData[] = await res.json();
//       setReports(data);
//       setSelected((prev) => (prev ? prev : data[0] ?? null));
//     } catch (err: unknown) {
//       setError(err instanceof Error ? err.message : "Unknown error");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => { fetchReports(); }, [fetchReports]);

//   const handleUpdate = (updated: ReportData) => {
//     setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
//     setSelected((prev) => (prev?.id === updated.id ? updated : prev));
//   };

//   const filtered = reports
//     .filter((r) => {
//       const q = search.toLowerCase();
//       return (
//         (r.title.toLowerCase().includes(q) || patientFullName(r.patient).toLowerCase().includes(q) || doctorName(r.doctor).toLowerCase().includes(q)) &&
//         (statusFilter === "All" || r.status === statusFilter) &&
//         (riskFilter === "All" || r.analysis.overallRisk === riskFilter)
//       );
//     })
//     .sort((a, b) => {
//       if (sortKey === "date")    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
//       if (sortKey === "patient") return patientFullName(a.patient).localeCompare(patientFullName(b.patient));
//       if (sortKey === "status")  return a.status.localeCompare(b.status);
//       return a.analysis.overallRisk.localeCompare(b.analysis.overallRisk);
//     });

//   return (
//     <div className="reports-wrap">
//       <div className="reports-header">
//         <div>
//           <h1 className="reports-title">Reports</h1>
//           <p className="reports-subtitle">View, validate, and manage all endoscopy diagnostic reports.</p>
//         </div>
//       </div>

//       <div className="reports-toolbar">
//         <div className="reports-search-box">
//           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//             <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
//           </svg>
//           <input className="reports-search-input" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Search by patient, doctor…" />
//           {search && <button type="button" className="reports-search-clear" onClick={() => setSearch("")}>×</button>}
//         </div>

//         <div className="reports-filter-group">
//           {(["All", "draft", "final"] as FilterStatus[]).map((f) => (
//             <button key={f} type="button" className={`reports-filter-btn${statusFilter === f ? " active" : ""}`} onClick={() => setStatusFilter(f)}>
//               {f === "All" ? "All" : statusStyle(f as ReportStatus).label}
//             </button>
//           ))}
//         </div>

//         <div className="reports-filter-group">
//           {(["All", "high", "medium", "low"] as const).map((f) => {
//             const s = f === "All" ? null : severityStyle(f);
//             return (
//               <button key={f} type="button" className={`reports-filter-btn${riskFilter === f ? " active" : ""}`} onClick={() => setRiskFilter(f)} style={riskFilter === f && s ? { background: s.bg, color: s.color, borderColor: s.border } : {}}>
//                 {f === "All" ? "All Risk" : s!.label}
//               </button>
//             );
//           })}
//         </div>

//         <select className="reports-sort-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
//           <option value="date">Latest</option>
//           <option value="patient">Patient</option>
//           <option value="status">Status</option>
//           <option value="risk">Risk</option>
//         </select>
//       </div>

//       <div className="reports-layout">
//         <div className="reports-list-panel">
//           <div className="reports-list-header">
//             <span className="reports-list-meta">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
//           </div>
//           <div className="reports-list-scroll">
//             {loading ? (
//               <div className="reports-empty"><div className="reports-empty-icon">⏳</div><p className="reports-empty-title">Loading reports…</p></div>
//             ) : error ? (
//               <div className="reports-empty"><div className="reports-empty-icon">⚠️</div><p className="reports-empty-title">Error loading reports</p><p className="reports-empty-sub">{error}</p></div>
//             ) : filtered.length === 0 ? (
//               <div className="reports-empty">
//                 <div className="reports-empty-icon">📄</div>
//                 <p className="reports-empty-title">No reports found</p>
//                 <p className="reports-empty-sub">{reports.length === 0 ? "Generate a report from the Analysis page." : "Try adjusting your filters."}</p>
//               </div>
//             ) : (
//               filtered.map((r) => (
//                 <ReportListItem key={r.id} report={r} isSelected={selected?.id === r.id} onClick={() => setSelected(r)} />
//               ))
//             )}
//           </div>
//         </div>

//         {selected ? (
//           <ReportPreview report={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />
//         ) : (
//           <div className="report-no-selection">
//             <div className="report-no-selection-icon">📋</div>
//             <p className="report-no-selection-title">No report selected</p>
//             <p className="report-no-selection-sub">Select a report from the list to preview it.</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


"use client";

import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";


type ReportStatus = "draft" | "final";
type SortKey = "date" | "patient" | "status" | "risk";
type FilterStatus = "All" | ReportStatus;
type Severity = "low" | "medium" | "high" | "normal" | "moderate";

interface DetectedLesion {
  id: string; lesionType: string; classification: string;
  confidence: number; severity: string; description: string; location: string;
}

interface MediaRecord {
  id: string; storageUrl: string; annotatedUrl?: string;
  gradcamUrl?: string; overlayUrl?: string;
  mediaType: string; filename: string;
}

interface ReportData {
  id: string; title: string; status: ReportStatus;
  clinicalNotes: string; conclusion: string; recommendation: string;
  pdfUrl: string; generatedAt: string;
  gradcamInterpretation?: string;
  mediaIds?: string;
  patient: { id: string; firstName: string; lastName: string; dateOfBirth: string; gender: string; condition: string; };
  doctor:  { id: string; firstName: string; lastName: string; specialty: string; };
  visit:   { id: string; visitDate: string; visitType: string; notes: string; media?: MediaRecord[]; };
  analysis: {
    id: string; analysisType: string; modelVersion: string;
    overallRisk: string; overallConfidence: number;
    status: string; analyzedAt: string;
    detectedLesions: DetectedLesion[];
    media?: MediaRecord | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function patientFullName(p: ReportData["patient"]) { return `${p.firstName} ${p.lastName}`; }
function patientAge(dob: string) { return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)); }
function patientInitials(p: ReportData["patient"]) { return `${p.firstName[0]}${p.lastName[0]}`.toUpperCase(); }
function doctorName(d: ReportData["doctor"]) { return `Dr. ${d.firstName} ${d.lastName}`; }
function formatDate(dateStr: string) { return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
function relativeDate(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "Today"; if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`; if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const avatarGradients: [string, string][] = [
  ["#2563EB","#818cf8"],["#f97316","#fb923c"],["#2563EB","#4ade80"],
  ["#a855f7","#c084fc"],["#ef4444","#f87171"],["#06b6d4","#22d3ee"],
  ["#eab308","#facc15"],["#ec4899","#f472b6"],
];

function severityStyle(sev: string) {
  if (sev === "high")     return { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "High Risk" };
  if (sev === "moderate") return { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", dot: "#f97316", label: "Moderate" };
  return                         { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", dot: "#2563EB", label: "Normal" };
}

function statusStyle(status: string) {
  if (status === "final") return { color: "#2563EB", bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", label: "Final" };
  return                          { color: "#f97316", bg: "#fff7ed", border: "#fed7aa", icon: "✎", label: "Draft" };
}

// Resolve all session images from visit.media[]
type ImagePanel = { src: string | null; label: string; color: string };
type ResolvedImage = { index: number; panels: ImagePanel[] };

function resolveAllReportImages(report: ReportData): ResolvedImage[] {
  const mediaList = report.visit?.media ?? [];
  const analysisType = report.analysis.analysisType;
  if (analysisType === "video") return [];

  const raw = mediaList.length > 0
    ? mediaList
    : report.analysis?.media ? [report.analysis.media] : [];

  const storedIds: string[] = (() => {
    try { return JSON.parse(report.mediaIds ?? "[]"); } catch { return []; }
  })();
  const scoped = storedIds.length > 0 ? raw.filter(m => storedIds.includes(m.id)) : raw;
  const effective = scoped.filter(m => !!(m.storageUrl || m.annotatedUrl || m.gradcamUrl || m.overlayUrl));

  return effective.map((media, i) => {
    const panels: ImagePanel[] = [
      { src: media.storageUrl   ?? null, label: "Original",        color: "#6b7280" },
      { src: media.annotatedUrl ?? null, label: "Detection",        color: "#3b82f6" },
      { src: media.gradcamUrl   ?? null, label: "Activation Map",   color: "#f59e0b" },
      { src: media.overlayUrl   ?? null, label: "Mucosal Analysis", color: "#a855f7" },
    ];
    return { index: i, panels };
  });
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditReportModal({ report, onClose, onSaved }: { report: ReportData; onClose: () => void; onSaved: (r: ReportData) => void; }) {
  const [form, setForm] = useState({ clinicalNotes: report.clinicalNotes ?? "", conclusion: report.conclusion ?? "", recommendation: report.recommendation ?? "", status: report.status });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); return; }
      const data = await res.json();
      onSaved({ ...report, ...form, ...(data.report ?? {}) });
      onClose();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>Edit Report</h3>
            <p style={{ margin: "0.2rem 0 0", fontSize: 12, color: "#9ca3af" }}>{patientFullName(report.patient)} · {formatDate(report.visit.visitDate)}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[{ key: "clinicalNotes", label: "Clinical Observations", rows: 3 }, { key: "conclusion", label: "Conclusion", rows: 2 }, { key: "recommendation", label: "Clinical Recommendation", rows: 2 }].map(({ key, label, rows }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>{label}</label>
              <textarea rows={rows} value={form[key as keyof typeof form] as string}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb", padding: "0.6rem 0.75rem", fontSize: 13, resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const, outline: "none" }}
                onFocus={e => e.currentTarget.style.borderColor = "#2563EB"}
                onBlur={e  => e.currentTarget.style.borderColor = "#e5e7eb"}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ReportStatus }))}
              style={{ borderRadius: 8, border: "1px solid #e5e7eb", padding: "0.5rem 0.75rem", fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </div>
        </div>
        {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0.75rem 0 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "0.55rem 1.2rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "0.55rem 1.4rem", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Preview Panel ─────────────────────────────────────────────────────
function ReportPreview({ report: initialReport, onClose, onUpdate }: {
  report: ReportData; onClose: () => void; onUpdate: (r: ReportData) => void;
}) {
  const [report,      setReport]      = useState(initialReport);
  const [editing,    setEditing]    = useState(false);
  const [validating, setValidating] = useState(false);
  const [showInterp, setShowInterp] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sync lightweight list data when the selected report changes
  useEffect(() => { setReport(initialReport); }, [initialReport]);

  // Lazy-load full media details (visit.media + analysis.media) from /api/reports/[id].
  // The list query omits visit.media to stay lightweight, so `media` key is absent.
  useEffect(() => {
    let cancelled = false;
    // "media" key is absent when coming from the lightweight list query
    const needsDetail = !("media" in (initialReport.visit ?? {}));
    if (!needsDetail) return;
    setDetailLoading(true);
    fetch(`/api/reports/${initialReport.id}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.report) setReport(data.report as ReportData);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [initialReport.id]);

  const handleSaved = (updated: ReportData) => { setReport(updated); onUpdate(updated); };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "final" }) });
      if (res.ok) { const updated = { ...report, status: "final" as ReportStatus }; setReport(updated); onUpdate(updated); }
    } finally { setValidating(false); }
  };

  // ✅ Téléchargement PDF — ouvre le HTML dans un nouvel onglet avec ?print=1
  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      // Ouvre le rapport HTML dans un nouvel onglet pour impression
      window.open(`/api/reports/${report.id}/pdf?print=1`, "_blank");
    } finally {
      setTimeout(() => setPdfLoading(false), 1000);
    }
  };

  const st  = statusStyle(report.status);
  const sev = severityStyle(report.analysis.overallRisk);
  const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
  const [bg, fg] = avatarGradients[idx];
  const age = patientAge(report.patient.dateOfBirth);
  const allImages = resolveAllReportImages(report);

  return (
    <>
      {editing && <EditReportModal report={report} onClose={() => setEditing(false)} onSaved={handleSaved} />}

      <div className="report-preview-panel">
        <div className="report-preview-colorbar" style={{ background: `linear-gradient(90deg, ${sev.dot}, ${sev.dot}55)` }} />

        {/* Header */}
        <div className="report-preview-header">
          <div className="report-preview-badges">
            <div className="report-preview-badge-group">
              <span className="report-status-pill" style={{ color: st.color, background: st.bg, borderColor: st.border }}>{st.icon} {st.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 7px" }}>{report.visit.visitType}</span>
              {report.analysis.analysisType === "video" ? (
                <span style={{ fontSize: 10, fontWeight: 600, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
                  Live Monitoring
                </span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "2px 7px" }}>
                  {report.analysis.analysisType === "detection" ? "CAD Detection" : report.analysis.analysisType === "segmentation-esophagitis" ? "Esophagitis" : "Segmentation"}
                </span>
              )}
            </div>
            <button type="button" className="report-close-btn" onClick={onClose}>×</button>
          </div>

          <div className="report-patient-strip" style={{ marginTop: "0.85rem" }}>
            <div className="report-patient-avatar" style={{ background: `linear-gradient(135deg, ${bg}, ${fg}44)`, color: "#fff" }}>{patientInitials(report.patient)}</div>
            <div style={{ flex: 1 }}>
              <p className="report-patient-fullname">{patientFullName(report.patient)}</p>
              <p className="report-patient-meta">{age} years old · {report.patient.gender}{report.patient.condition ? ` · ${report.patient.condition}` : ""}</p>
            </div>
            <span className="report-risk-badge" style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>{sev.label}</span>
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{doctorName(report.doctor)}</span>
              {report.doctor.specialty && <span style={{ fontSize: 11, color: "#9ca3af" }}>· {report.doctor.specialty}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontSize: 12, color: "#374151" }}>{formatDate(report.visit.visitDate)}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="report-preview-body">

          {/* Images — lazy-loaded; show spinner while fetching */}
          {detailLoading && (
            <div className="report-section" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 0" }}>
              <span style={{ width: 13, height: 13, border: "2px solid #e5e7eb", borderTopColor: "#2563EB", borderRadius: "50%", animation: "report-spin 0.7s linear infinite", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>Loading images…</span>
              <style>{`@keyframes report-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {!detailLoading && allImages.length > 0 && (
            <div className="report-section">
              {allImages.map((img, i) => (
                <div key={i} style={{ marginBottom: i < allImages.length - 1 ? "1rem" : 0 }}>
                  {allImages.length > 1 && (
                    <p style={{ margin: "0 0 0.5rem", fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>
                      Image {i + 1} / {allImages.length}
                    </p>
                  )}
                  {(() => {
                    const visible = img.panels.filter(p => p.src);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: visible.length === 1 ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
                        {visible.map(panel => (
                          <div key={panel.label} style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${panel.color}44`, background: "#0f172a", position: "relative" }}>
                            <img src={panel.src!} alt={panel.label}
                              style={{ width: "100%", aspectRatio: "4/3", objectFit: "contain", display: "block" }} />
                            <div style={{ position: "absolute", bottom: "0.35rem", left: "0.35rem", background: `${panel.color}dd`, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.03em" }}>
                              {panel.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Key Frames selected by the doctor */}
          {(report as any).selectedFrames?.length > 0 && (
            <div className="report-section">
              <p className="report-section-label" style={{ marginBottom: "0.5rem" }}>
                Documented Findings — Reference Frames ({(report as any).selectedFrames.length})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                {(report as any).selectedFrames.map((sf: any, i: number) => {
                  const frame = sf.frame;
                  if (!frame?.frameUrl) return null;
                  const dets: any[] = frame.frameDetections ?? [];
                  const DET_COLORS = ["#ef4444","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#f97316","#ec4899","#10b981"];
                  return (
                    <div key={sf.id ?? i} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", background: "#0f172a", position: "relative" }}>
                      <img src={frame.frameUrl} alt={`Key frame ${i + 1}`}
                        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />

                      {/* Bounding boxes */}
                      {sf.includeAnnotation && dets.length > 0 && (
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                          {dets.map((d: any, di: number) => {
                            let bb: any = {};
                            try { bb = JSON.parse(d.boundingBox ?? "{}"); } catch {}
                            const x = bb.x ?? d.x ?? 10, y = bb.y ?? d.y ?? 10;
                            const w = bb.w ?? d.w ?? 20, h = bb.h ?? d.h ?? 20;
                            const color = DET_COLORS[di % DET_COLORS.length];
                            return (
                              <g key={di}>
                                <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth="1.2" rx="1" />
                                <rect x={x} y={Math.max(0, y - 6)} width={w} height="6" fill={color} opacity="0.9" rx="0.8" />
                                <text x={x + w / 2} y={Math.max(0, y - 6) + 4.5} textAnchor="middle"
                                  fontSize="3.5" fill="#fff" fontWeight="bold" fontFamily="sans-serif">
                                  {d.label} {Math.round(d.confidence ?? 0)}%
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}

                      {/* Timestamp badge */}
                      <div style={{ position: "absolute", bottom: "0.3rem", left: "0.3rem", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace" }}>
                        {`${String(Math.floor((frame.timestampSeconds ?? 0) / 60)).padStart(2,"0")}:${String(Math.floor((frame.timestampSeconds ?? 0) % 60)).padStart(2,"0")}`}
                      </div>
                      <div style={{ position: "absolute", top: "0.3rem", left: "0.3rem", background: "rgba(37,99,235,0.85)", color: "#fff", fontSize: 7, fontWeight: 700, padding: "1px 6px", borderRadius: 3 }}>
                        Frame {i + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ✅ Grad-CAM Interpretation */}
          {report.gradcamInterpretation && (
            <div className="report-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <p className="report-section-label" style={{ margin: 0 }}>🧠 Saliency Map Interpretation</p>
                <button type="button" onClick={() => setShowInterp(!showInterp)}
                  style={{ fontSize: 10, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
                  {showInterp ? "Hide" : "Show"}
                </button>
              </div>
              {showInterp && (
                <div style={{ background: "linear-gradient(135deg, #eff6ff, #f0fdf4)", border: "1px solid #bfdbfe", borderRadius: 9, padding: "0.75rem 0.85rem" }}>
                  <p style={{ fontSize: 11.5, lineHeight: 1.65, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>
                    {report.gradcamInterpretation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Clinical Notes */}
          {report.clinicalNotes && (
            <div className="report-section">
              <p className="report-section-label">Clinical Observations</p>
              <p className="report-summary-text">{report.clinicalNotes}</p>
            </div>
          )}

          {/* Conclusion */}
          {report.conclusion && (
            <div className="report-section">
              <p className="report-section-label">Conclusion</p>
              <p className="report-summary-text">{report.conclusion}</p>
            </div>
          )}

          {/* Findings */}
          {report.analysis.detectedLesions.length > 0 ? (
            <div className="report-section">
              <p className="report-section-label">Detected Lesions ({report.analysis.detectedLesions.length})</p>
              <div className="report-findings-list">
                {report.analysis.detectedLesions.map(lesion => {
                  const fs = severityStyle(lesion.severity);
                  return (
                    <div key={lesion.id} className="report-finding-item" style={{ borderColor: fs.border }}>
                      <span className="report-finding-dot" style={{ background: fs.dot }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <p className="report-finding-name">{lesion.lesionType}</p>
                            {(lesion as any).imageLabel && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#2563EB", background: "#eff6ff", padding: "1px 6px", borderRadius: 4 }}>
                                {(lesion as any).imageLabel}
                              </span>
                            )}
                          </div>
                          <span className="report-finding-badge" style={{ color: fs.color, background: fs.bg }}>{fs.label}</span>
                        </div>
                        {lesion.location    && <p className="report-finding-detail">Location: {lesion.location}</p>}
                        {lesion.description && <p className="report-finding-detail">{lesion.description}</p>}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}>
                          <div style={{ flex: 1, height: 3, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${lesion.confidence}%`, height: "100%", background: fs.dot, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: fs.color, fontWeight: 700, minWidth: 30 }}>{Math.round(lesion.confidence)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="report-section">
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, padding: "0.85rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 12, color: "#15803d" }}>No pathological findings</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: 11, color: "#16a34a" }}>Normal endoscopic appearance. No lesions detected by AI analysis.</p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {report.recommendation && (
            <div className="report-section">
              <p className="report-section-label">Clinical Recommendation</p>
              <div className="report-recommendation-box" style={{ background: sev.bg, borderColor: sev.border }}>
                <p className="report-recommendation-text">{report.recommendation}</p>
              </div>
            </div>
          )}

          {/* Analysis Info */}
        </div>

        {/* ✅ Footer — PDF download instead of Send to Patient */}
        <div className="report-preview-footer">
          {/* ✅ Bouton PDF — toujours visible */}
          <button type="button" onClick={handleDownloadPdf} disabled={pdfLoading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1rem", borderRadius: 8, border: "1px solid #e5e7eb", background: pdfLoading ? "#f9fafb" : "#fff", fontSize: 12, fontWeight: 600, cursor: pdfLoading ? "not-allowed" : "pointer", color: "#374151", fontFamily: "inherit", opacity: pdfLoading ? 0.7 : 1 }}>
            {pdfLoading ? (
              <span style={{ width: 12, height: 12, border: "2px solid #d1d5db", borderTopColor: "#374151", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {pdfLoading ? "Opening…" : "Download PDF"}
          </button>

          {/* Validate (draft only) */}
          {report.status === "draft" && (
            <button type="button" className="btn-validate" onClick={handleValidate} disabled={validating}
              style={{ opacity: validating ? 0.7 : 1, cursor: validating ? "not-allowed" : "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {validating ? "Validating…" : "Validate Report"}
            </button>
          )}

          {/* Edit */}
          <button type="button" className="btn-edit-report" onClick={() => setEditing(true)} title="Edit Report">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ─── Patient Folder Card ──────────────────────────────────────────────────────
function PatientFolderCard({ patient, reports, onClick }: {
  patient: ReportData["patient"];
  reports: ReportData[];
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const idx = patient.id.charCodeAt(0) % avatarGradients.length;
  const [bg, fg] = avatarGradients[idx];
  const latest = reports.reduce((a, b) => new Date(a.generatedAt) > new Date(b.generatedAt) ? a : b);
  const detCount  = reports.filter(r => r.analysis.analysisType === "detection").length;
  const segCount  = reports.filter(r => r.analysis.analysisType === "segmentation").length;
  const liveCount = reports.filter(r => r.analysis.analysisType === "video").length;
  const hasFinal = reports.some(r => r.status === "final");
  const worstRisk = reports.some(r => r.analysis.overallRisk === "high")     ? "high"
                  : reports.some(r => r.analysis.overallRisk === "moderate") ? "moderate" : "normal";
  const sev = severityStyle(worstRisk);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 12,
        border: `1.5px solid ${hov ? "#2563EB" : "#e5e7eb"}`,
        background: "#fff",
        cursor: "pointer",
        padding: "1rem 1.1rem",
        display: "flex", alignItems: "center", gap: "0.85rem",
        boxShadow: hov ? "0 4px 20px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-1px)" : "none",
        transition: "all 0.18s",
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${bg}, ${fg}55)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.7rem", fontWeight: 800, color: "#fff",
      }}>
        {patientInitials(patient)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {patient.firstName} {patient.lastName}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.35rem" }}>
          {liveCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
              {liveCount} Live
            </span>
          )}
          {detCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 6px" }}>
              {detCount} Detection
            </span>
          )}
          {segCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: "#1D4ED8", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 4, padding: "1px 6px" }}>
              {segCount} Segmentation
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: sev.dot, display: "inline-block" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: sev.color }}>{sev.label}</span>
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{relativeDate(latest.generatedAt)}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: hasFinal ? "#15803d" : "#f97316", background: hasFinal ? "#f0fdf4" : "#fff7ed", border: `1px solid ${hasFinal ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 4, padding: "1px 6px" }}>
          {reports.length} report{reports.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Arrow */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

// ─── Delete Report Modal ──────────────────────────────────────────────────────
function DeleteReportModal({ report, deleting, onConfirm, onCancel }: {
  report: ReportData;
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
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: "0 0 0.4rem", fontFamily: "var(--font-display, inherit)" }}>
            Delete Report
          </p>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.55 }}>
            You are about to permanently delete the report for{" "}
            <strong style={{ color: "#1e293b" }}>{report.patient.firstName} {report.patient.lastName}</strong>.
            {" "}This action cannot be undone.
          </p>
        </div>
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
              flex: 1, padding: "0.65rem", borderRadius: 9, border: "none",
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

// ─── Report List Item ─────────────────────────────────────────────────────────
function ReportListItem({ report, isSelected, onClick, onDelete }: { report: ReportData; isSelected: boolean; onClick: () => void; onDelete: (id: string) => void; }) {
  const st  = statusStyle(report.status);
  const sev = severityStyle(report.analysis.overallRisk);
  const idx = report.patient.id.charCodeAt(0) % avatarGradients.length;
  const [bg, fg] = avatarGradients[idx];
  const [confirm,  setConfirm]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirm(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/reports/${report.id}`, { method: "DELETE" });
      onDelete(report.id);
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <div className={`report-list-item${isSelected ? " selected" : ""}`} onClick={onClick} style={{ position: "relative" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${bg}, ${fg}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>
          {patientInitials(report.patient)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="report-list-title">{report.patient.firstName} {report.patient.lastName}</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0.1rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {report.visit.visitType} · {doctorName(report.doctor)}
          </p>
        </div>
        <div className="report-list-right">
          {report.analysis.analysisType === "video" ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
              Live
            </span>
          ) : report.analysis.analysisType === "detection" ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.02em" }}>Detection</span>
          ) : report.analysis.analysisType === "segmentation-esophagitis" ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.02em" }}>Esophagitis</span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.02em" }}>Segmentation</span>
          )}
          <span className="report-status-badge" style={{ color: st.color, background: st.bg, borderColor: st.border }}>{st.icon} {st.label}</span>
          <div className="report-date-row">
            <span className="report-date-dot" style={{ background: sev.dot }} />
            <span className="report-date-text">{relativeDate(report.generatedAt)}</span>
          </div>
          <button type="button" onClick={handleDelete} disabled={deleting} title="Delete report"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#ef4444", opacity: deleting ? 0.4 : 0.7, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = deleting ? "0.4" : "0.7")}>
            {deleting
              ? <span style={{ width: 12, height: 12, border: "2px solid #fca5a5", borderTopColor: "#ef4444", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            }
          </button>
        </div>
      </div>

      {confirm && (
        <DeleteReportModal
          report={report}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => { if (!deleting) setConfirm(false); }}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
// ─── Source Folder Card ───────────────────────────────────────────────────────
function SourceFolderCard({ icon, title, subtitle, count, accentColor, bgColor, borderColor, onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; count: number;
  accentColor: string; bgColor: string; borderColor: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 14, border: `1.5px solid ${hov ? accentColor : borderColor}`,
        background: hov ? bgColor : "#fff",
        cursor: "pointer", padding: "1.4rem 1.5rem",
        display: "flex", alignItems: "center", gap: "1rem",
        boxShadow: hov ? `0 6px 24px ${accentColor}22` : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hov ? "translateY(-2px)" : "none",
        transition: "all 0.18s",
        flex: 1, minWidth: 240,
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 12, background: bgColor, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "0.2rem 0 0" }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: accentColor, lineHeight: 1 }}>{count}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>report{count !== 1 ? "s" : ""}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

export default function ReportsPage() {
  const searchParams      = useSearchParams();
  const [reports,         setReports]         = useState<ReportData[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [selected,        setSelected]        = useState<ReportData | null>(null);
  const [activeSource,    setActiveSource]    = useState<"live" | "image" | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState<FilterStatus>("All");
  const [riskFilter,      setRiskFilter]      = useState<"All" | Severity>("All");
  const [sortKey,         setSortKey]         = useState<SortKey>("date");

  // Categorise a report: "video" analysisType → live; everything else → image
  const getSource = (r: ReportData): "live" | "image" =>
    r.analysis?.analysisType === "video" ? "live" : "image";

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      const url = doctor?.id ? `/api/reports?doctorId=${doctor.id}` : "/api/reports";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: ReportData[] = await res.json();
      setReports(data);
      // Auto-navigate when coming from live/image page with ?patientId=&reportId=
      const qPatient = searchParams.get("patientId");
      const qReport  = searchParams.get("reportId");
      if (qPatient || qReport) {
        const targetReport = qReport ? data.find(r => r.id === qReport) ?? null : null;
        const source: "live" | "image" = targetReport
          ? (targetReport.analysis?.analysisType === "video" ? "live" : "image")
          : "image";
        if (qPatient) { setActivePatientId(qPatient); setActiveSource(source); }
        if (targetReport) setSelected(targetReport);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }, [searchParams]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleUpdate = (updated: ReportData) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelected(prev => prev?.id === updated.id ? updated : prev);
  };

  const handleDeleteReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    setSelected(prev => prev?.id === id ? null : prev);
  };

  // Split reports by source
  const liveReports  = reports.filter(r => getSource(r) === "live");
  const imageReports = reports.filter(r => getSource(r) === "image");

  // Source-filtered report set
  const sourceReports = activeSource === "live" ? liveReports
                      : activeSource === "image" ? imageReports
                      : reports;

  // Group source reports by patient
  const patientMap = new Map<string, { patient: ReportData["patient"]; reports: ReportData[] }>();
  for (const r of sourceReports) {
    if (!patientMap.has(r.patient.id)) patientMap.set(r.patient.id, { patient: r.patient, reports: [] });
    patientMap.get(r.patient.id)!.reports.push(r);
  }
  const patientFolders = Array.from(patientMap.values());

  // Filter patient folders by search
  const filteredFolders = patientFolders.filter(({ patient }) => {
    const q = search.toLowerCase();
    return q === "" || `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(q);
  });

  // Reports for the active patient (with filters applied)
  const activePatientReports = (activePatientId ? (patientMap.get(activePatientId)?.reports ?? []) : [])
    .filter(r =>
      (statusFilter === "All" || r.status === statusFilter) &&
      (riskFilter   === "All" || r.analysis.overallRisk === riskFilter)
    )
    .sort((a, b) => {
      if (sortKey === "date")    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      if (sortKey === "patient") return patientFullName(a.patient).localeCompare(patientFullName(b.patient));
      if (sortKey === "status")  return a.status.localeCompare(b.status);
      return a.analysis.overallRisk.localeCompare(b.analysis.overallRisk);
    });

  const activePatient = activePatientId ? patientMap.get(activePatientId)?.patient : null;

  const handleOpenSource = (src: "live" | "image") => {
    setActiveSource(src); setActivePatientId(null); setSelected(null);
    setSearch(""); setStatusFilter("All"); setRiskFilter("All");
  };

  const handleOpenFolder = (patientId: string) => {
    setActivePatientId(patientId); setSelected(null);
    setStatusFilter("All"); setRiskFilter("All");
  };

  const handleBackToFolders = () => {
    setActivePatientId(null); setSelected(null);
  };

  const handleBackToSources = () => {
    setActiveSource(null); setActivePatientId(null); setSelected(null); setSearch("");
  };

  // Breadcrumb level: "sources" | "patients" | "reports"
  const level = !activeSource ? "sources" : !activePatientId ? "patients" : "reports";

  // Header title / subtitle depending on level
  const headerTitle =
    level === "sources"  ? "Clinical Reports" :
    level === "patients" ? (activeSource === "live" ? "Live Monitoring" : "Image Analysis") :
    `${activePatient?.firstName ?? ""} ${activePatient?.lastName ?? ""}`;

  const headerSub =
    level === "sources"  ? "Select a folder to browse reports." :
    level === "patients" ? `${filteredFolders.length} patient folder${filteredFolders.length !== 1 ? "s" : ""}` :
    `${activePatientReports.length} report${activePatientReports.length !== 1 ? "s" : ""} · ${activePatient?.gender ?? ""}`;

  return (
    <div className="reports-wrap">
      <div className="reports-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Breadcrumb back buttons */}
          {level === "patients" && (
            <button type="button" onClick={handleBackToSources}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              All Folders
            </button>
          )}
          {level === "reports" && (
            <>
              <button type="button" onClick={handleBackToSources}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                All Folders
              </button>
              <button type="button" onClick={handleBackToFolders}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                {activeSource === "live" ? "Live Monitoring" : "Image Analysis"}
              </button>
            </>
          )}
          <div>
            <h1 className="reports-title">{headerTitle}</h1>
            <p className="reports-subtitle">{headerSub}</p>
          </div>
        </div>
      </div>

      <div className="reports-toolbar">
        {level !== "sources" && (
          <div className="reports-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="reports-search-input" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder={level === "reports" ? "Filter reports…" : "Search patient…"} />
            {search && <button type="button" className="reports-search-clear" onClick={() => setSearch("")}>×</button>}
          </div>
        )}

        {level === "reports" && (
          <>
            <div className="reports-filter-group">
              {(["All", "draft", "final"] as FilterStatus[]).map(f => (
                <button key={f} type="button" className={`reports-filter-btn${statusFilter === f ? " active" : ""}`} onClick={() => setStatusFilter(f)}>
                  {f === "All" ? "All" : statusStyle(f as ReportStatus).label}
                </button>
              ))}
            </div>
            <div className="reports-filter-group">
              {(["All", "high", "moderate", "normal"] as const).map(f => {
                const s = f === "All" ? null : severityStyle(f);
                return (
                  <button key={f} type="button" className={`reports-filter-btn${riskFilter === f ? " active" : ""}`} onClick={() => setRiskFilter(f as any)}
                    style={riskFilter === f && s ? { background: s.bg, color: s.color, borderColor: s.border } : {}}>
                    {f === "All" ? "All Risk" : s!.label}
                  </button>
                );
              })}
            </div>
            <select className="reports-sort-select" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
              <option value="date">Latest</option>
              <option value="status">Status</option>
              <option value="risk">Risk</option>
            </select>
          </>
        )}
      </div>

      <div className="reports-layout">
        <div className="reports-list-panel">
          <div className="reports-list-header">
            <span className="reports-list-meta">
              {level === "sources"  ? `${reports.length} total report${reports.length !== 1 ? "s" : ""}` :
               level === "patients" ? `${filteredFolders.length} patient${filteredFolders.length !== 1 ? "s" : ""}` :
               `${activePatientReports.length} report${activePatientReports.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="reports-list-scroll">
            {loading ? (
              <div className="reports-empty"><div className="reports-empty-icon">⏳</div><p className="reports-empty-title">Loading reports…</p></div>
            ) : error ? (
              <div className="reports-empty"><div className="reports-empty-icon">⚠️</div><p className="reports-empty-title">Error</p><p className="reports-empty-sub">{error}</p></div>
            ) : level === "sources" ? (
              /* ── SOURCE FOLDER VIEW ── */
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.75rem" }}>
                <SourceFolderCard
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  }
                  title="Live Monitoring"
                  subtitle="Reports from video endoscopy analysis"
                  count={liveReports.length}
                  accentColor="#2563EB"
                  bgColor="#f0fdf4"
                  borderColor="#bbf7d0"
                  onClick={() => handleOpenSource("live")}
                />
                <SourceFolderCard
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  }
                  title="Image Analysis"
                  subtitle="Reports from CAD and segmentation"
                  count={imageReports.length}
                  accentColor="#2563EB"
                  bgColor="#eff6ff"
                  borderColor="#bfdbfe"
                  onClick={() => handleOpenSource("image")}
                />
                {reports.length === 0 && (
                  <div className="reports-empty" style={{ marginTop: "0.5rem" }}>
                    <div className="reports-empty-icon">📁</div>
                    <p className="reports-empty-title">No reports yet</p>
                    <p className="reports-empty-sub">Generate a report from the Analysis page.</p>
                  </div>
                )}
              </div>
            ) : level === "patients" ? (
              /* ── PATIENT FOLDER VIEW ── */
              filteredFolders.length === 0 ? (
                <div className="reports-empty">
                  <div className="reports-empty-icon">📁</div>
                  <p className="reports-empty-title">No patients found</p>
                  <p className="reports-empty-sub">{search ? "Try a different search." : "No reports in this folder yet."}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
                  {filteredFolders.map(({ patient, reports: pReports }) => (
                    <PatientFolderCard key={patient.id} patient={patient} reports={pReports} onClick={() => handleOpenFolder(patient.id)} />
                  ))}
                </div>
              )
            ) : (
              /* ── REPORT LIST FOR SELECTED PATIENT ── */
              activePatientReports.length === 0 ? (
                <div className="reports-empty">
                  <div className="reports-empty-icon">📄</div>
                  <p className="reports-empty-title">No reports match</p>
                  <p className="reports-empty-sub">Try adjusting your filters.</p>
                </div>
              ) : (
                activePatientReports.map(r => (
                  <ReportListItem key={r.id} report={r} isSelected={selected?.id === r.id} onClick={() => setSelected(r)} onDelete={handleDeleteReport} />
                ))
              )
            )}
          </div>
        </div>

        {selected ? (
          <ReportPreview report={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />
        ) : (
          <div className="report-no-selection">
            <div className="report-no-selection-icon">
              {level === "sources" ? "📂" : level === "patients" ? "📁" : "📋"}
            </div>
            <p className="report-no-selection-title">
              {level === "sources" ? "Select a folder" : level === "patients" ? "Select a patient" : "No report selected"}
            </p>
            <p className="report-no-selection-sub">
              {level === "sources"  ? "Choose Live Monitoring or Image Analysis to browse reports." :
               level === "patients" ? "Click a patient folder to view their reports." :
               "Click a report to preview it."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}