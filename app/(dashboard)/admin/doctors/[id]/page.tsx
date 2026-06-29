"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DangerButton from "@/components/ui/danger-button";
import ActionButton from "@/components/ui/action-button";
import { useConfirm } from "@/components/ui/confirm-dialog";

const pdfIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const eyeIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

interface DoctorProfile {
  id: string;
  firstName: string; lastName: string;
  email: string; phone: string;
  hospital: string; specialty: string;
  createdAt: string;
  _count: { patients: number; visits: number; analysisResults: number; reports: number };
}

interface PatientItem {
  id: string;
  firstName: string; lastName: string;
  email: string; phone: string;
  condition: string; status: string;
  dateOfBirth: string; gender: string;
  createdAt: string;
  _count: { visits: number; reports: number };
}

interface AnalysisItem {
  id: string; shortId: string;
  patient: string; analysisType: string;
  risk: string; confidence: number;
  analyzedAt: string; hasReport: boolean;
}

interface ReportItem {
  id: string; title: string; status: string;
  patient: string; createdAt: string; pdfUrl: string;
}

const riskColor = (risk: string) => {
  const r = (risk ?? "").toLowerCase();
  if (r === "high")   return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  if (r === "medium") return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa" };
  if (r === "low")    return { bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0" };
  return { bg: "#f3f4f6", fg: "#374151", border: "#e5e7eb" };
};

export default function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }   = use(params);
  const router   = useRouter();
  const confirm  = useConfirm();

  const [doctor, setDoctor]     = useState<DoctorProfile | null>(null);
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [reports, setReports]   = useState<ReportItem[]>([]);
  const [riskMap, setRiskMap]   = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"patients" | "analyses" | "reports">("patients");
  const [deleting, setDeleting] = useState<string | null>(null);

  // guard
  useEffect(() => {
    const me = JSON.parse(localStorage.getItem("doctor") ?? "null");
    if (!me)                  { router.push("/auth");      return; }
    if (me.role !== "admin")  { router.push("/dashboard"); return; }
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/doctors/${id}/details`);
      const data = await res.json();
      if (res.ok) {
        setDoctor(data.doctor);
        setPatients(data.patients);
        setAnalyses(data.recentAnalyses);
        setReports(data.recentReports);
        setRiskMap(data.riskMap ?? {});
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const deletePatient = async (p: PatientItem) => {
    const ok = await confirm({
      variant: "danger",
      title:   "Delete patient?",
      message: <>Are you sure you want to delete <strong>{p.firstName} {p.lastName}</strong>? All their visits, reports and analyses will be permanently removed.</>,
      detail:  `${p.gender} · DOB ${p.dateOfBirth} · ${p.condition || "no condition"}`,
      confirmLabel: "Delete patient",
    });
    if (!ok) return;
    setDeleting(p.id);
    await fetch(`/api/admin/patients/${p.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "0.75rem" }}>
      <div style={{ width: 26, height: 26, border: "3px solid #e5e7eb", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13, color: "#6b7280" }}>Loading…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!doctor) return <p style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>Doctor not found</p>;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto", fontFamily: "inherit" }}>

      <Link href="/admin" style={{ fontSize: 11, color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>
        ← Back to Admin
      </Link>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", borderRadius: 16, padding: "1.4rem 1.6rem", marginTop: "0.75rem", color: "#fff", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900 }}>
          {doctor.firstName[0]}{doctor.lastName[0]}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Dr. {doctor.firstName} {doctor.lastName}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.9 }}>{doctor.specialty} · {doctor.hospital}</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.8 }}>{doctor.email} · {doctor.phone}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, opacity: 0.7 }}>Joined {new Date(doctor.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginTop: "1.2rem", marginBottom: "1.2rem" }}>
        {[
          { l: "Patients",  v: doctor._count.patients,        c: "#2563EB" },
          { l: "Visits",    v: doctor._count.visits,          c: "#f97316" },
          { l: "Analyses",  v: doctor._count.analysisResults, c: "#1D4ED8" },
          { l: "Reports",   v: doctor._count.reports,         c: "#a855f7" },
        ].map(kpi => (
          <div key={kpi.l} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem 1rem" }}>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: kpi.c }}>{kpi.v}</p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#6b7280" }}>{kpi.l}</p>
          </div>
        ))}
      </div>

      {/* Risk distribution */}
      {Object.keys(riskMap).length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "1.2rem" }}>
          <p style={{ margin: "0 0 0.55rem", fontSize: 11, fontWeight: 800, color: "#1e3a5f" }}>Risk Distribution</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {Object.entries(riskMap).map(([risk, n]) => {
              const c = riskColor(risk);
              return (
                <div key={risk} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 7, padding: "0.4rem 0.75rem" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: c.fg }}>{n}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: c.fg, marginLeft: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{risk}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid #e5e7eb", marginBottom: "1rem" }}>
        {(["patients", "analyses", "reports"] as const).map(k => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "0.55rem 1rem", border: "none", background: "transparent",
              fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", textTransform: "capitalize",
              color: tab === k ? "#2563EB" : "#6b7280",
              borderBottom: tab === k ? "2px solid #2563EB" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {k} ({k === "patients" ? patients.length : k === "analyses" ? analyses.length : reports.length})
          </button>
        ))}
      </div>

      {/* Patients */}
      {tab === "patients" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Patient", "Condition", "Status", "Visits", "Reports", "DOB", "Created", ""].map(h => (
                    <th key={h} style={{ padding: "0.55rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 12, fontWeight: 700, color: "#111" }}>
                      {p.firstName} {p.lastName}
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{p.gender} · {p.email || "no email"}</div>
                    </td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#6b7280" }}>{p.condition || "—"}</td>
                    <td style={{ padding: "0.6rem 0.85rem" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 8px",
                        background: p.status === "Active" ? "#f0fdf4" : "#f3f4f6",
                        color:      p.status === "Active" ? "#15803d" : "#6b7280",
                        border:     `1px solid ${p.status === "Active" ? "#bbf7d0" : "#e5e7eb"}` }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 12, fontWeight: 700, color: "#f97316", textAlign: "center" }}>{p._count.visits}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 12, fontWeight: 700, color: "#a855f7", textAlign: "center" }}>{p._count.reports}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#9ca3af" }}>{p.dateOfBirth}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "0.6rem 0.85rem" }}>
                      <DangerButton onClick={() => deletePatient(p)} loading={deleting === p.id} />
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>No patients</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analyses */}
      {tab === "analyses" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["ID", "Patient", "Type", "Risk", "Confidence", "Report", "Date"].map(h => (
                    <th key={h} style={{ padding: "0.55rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analyses.map((a, i) => {
                  const c = riskColor(a.risk);
                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>{a.shortId}</td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, fontWeight: 600 }}>{a.patient}</td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#6b7280" }}>{a.analysisType}</td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 8px", background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>{a.risk}</span>
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 12, fontWeight: 700, color: "#14b8a6" }}>{a.confidence}%</td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 11 }}>
                        {a.hasReport ? <span style={{ color: "#15803d", fontWeight: 700 }}>✓</span> : <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(a.analyzedAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {analyses.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>No analyses</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Title", "Patient", "Status", "Date", ""].map(h => (
                    <th key={h} style={{ padding: "0.55rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 12, fontWeight: 700, color: "#111" }}>{r.title}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#6b7280" }}>{r.patient}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, fontWeight: 600, color: r.status === "finalized" ? "#15803d" : "#6b7280" }}>{r.status}</td>
                    <td style={{ padding: "0.6rem 0.85rem", fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: "0.6rem 0.85rem" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <ActionButton href={`/api/reports/${r.id}/pdf?print=1`} label="View" icon={eyeIcon} variant="primary" external />
                        {r.pdfUrl && <ActionButton href={r.pdfUrl} label="PDF" icon={pdfIcon} variant="neutral" />}
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "#9ca3af" }}>No reports</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
