"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import DangerButton from "@/components/ui/danger-button";
import ActionButton from "@/components/ui/action-button";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ─── Icons ────────────────────────────────────────────────────────────────────
const eyeIcon  = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const editIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const pdfIcon  = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DoctorRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospital: string;
  specialty: string;
  phone: string;
  role?: string;
  createdAt: string;
  _count: { patients: number; analysisResults: number; reports: number; visits?: number };
}

interface Stats {
  totalDoctors: number;
  totalPatients: number;
  totalVisits: number;
  totalAnalyses: number;
  totalReports: number;
  totalLesions: number;
  highRiskAnalyses: number;
  avgConfidence: number;
  detectionCount?: number;
  segmentationCount?: number;
  liveCount?: number;
  riskMap?: Record<string, number>;
}

interface ActivityItem {
  id: string;
  analysisId?: string;
  doctor: string;
  doctorId?: string;
  patient: string;
  type: string;
  analysisType?: string;
  risk: string;
  confidence: number;
  date: string;
  hasReport?: boolean;
}

interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  condition: string;
  status: string;
  dateOfBirth: string;
  gender: string;
  createdAt: string;
  doctor: { id: string; firstName: string; lastName: string; hospital: string; specialty: string };
  _count: { visits: number; reports: number };
}

interface ReportRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  pdfUrl: string;
  conclusion: string;
  doctor:  { id: string; firstName: string; lastName: string; specialty: string };
  patient: { id: string; firstName: string; lastName: string };
  analysis: { id: string; overallRisk: string; overallConfidence: number; analysisType: string } | null;
}

interface AnalysisRow {
  id: string;
  shortId: string;
  doctor: string;
  doctorId: string;
  patient: string;
  patientId?: string;
  analysisType: string;
  risk: string;
  confidence: number;
  status: string;
  framesAnalyzed: number;
  framesWithDetection: number;
  hasReport: boolean;
  reportId: string | null;
  analyzedAt: string;
}

interface FeedEvent {
  id: string;
  kind: "analysis" | "report" | "patient" | "visit";
  title: string;
  subtitle: string;
  meta: string;
  date: string;
  risk?: string;
}

type TabKey = "overview" | "doctors" | "patients" | "reports" | "analyses" | "activity" | "appointments" | "admins";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#f0f4f8",
  surface:  "#ffffff",
  border:   "rgba(59,130,246,0.1)",
  blue:     "#3b82f6",
  blueDark: "#1d4ed8",
  blueLight:"#eff6ff",
  text:     "#0f172a",
  muted:    "#64748b",
  faint:    "#94a3b8",
  shadow:   "0 2px 16px rgba(0,0,0,0.07)",
  radius:   "16px",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => new Date(iso).toLocaleString();
const fmtDateShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const riskColor = (risk: string) => {
  const r = (risk ?? "").toLowerCase();
  if (r === "high")   return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", dot: "#ef4444" };
  if (r === "medium") return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", dot: "#f97316" };
  if (r === "low")    return { bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0", dot: "#2563EB" };
  return { bg: "#f3f4f6", fg: "#374151", border: "#e5e7eb", dot: "#9ca3af" };
};

// Generate a unique gradient from a name string
function nameGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const palettes = [
    ["#3b82f6","#1D4ED8"],
    ["#0ea5e9","#06b6d4"],
    ["#DC2626","#3b82f6"],
    ["#1D4ED8","#8b5cf6"],
    ["#f59e0b","#ef4444"],
    ["#14b8a6","#3b82f6"],
    ["#8b5cf6","#ec4899"],
    ["#2563EB","#0ea5e9"],
  ];
  const [a, b] = palettes[Math.abs(h) % palettes.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

const specialtyColors: Record<string, [string, string]> = {
  "Gastroenterology": ["#eff6ff","#3b82f6"],
  "Internal Medicine": ["#f0fdf4","#16a34a"],
  "Surgery":          ["#fff7ed","#ea580c"],
  "Oncology":         ["#fdf4ff","#9333ea"],
};
function specialtyBadge(sp: string) {
  const [bg, fg] = specialtyColors[sp] ?? ["#f1f5f9","#475569"];
  return { bg, fg };
}

// ─── Doctor Avatar ─────────────────────────────────────────────────────────────
function DoctorAvatar({ firstName, lastName, size = 64, avatarUrl, darkBorder }: {
  firstName: string; lastName: string; size?: number; avatarUrl?: string | null; darkBorder?: boolean;
}) {
  const initials = `${(firstName?.[0] ?? "?")}${(lastName?.[0] ?? "")}`.toUpperCase();
  const gradient = nameGradient(`${firstName}${lastName}`);
  const border   = darkBorder ? "2.5px solid rgba(255,255,255,0.25)" : "3px solid #fff";

  if (avatarUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        overflow: "hidden", flexShrink: 0,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        border,
      }}>
        <img src={avatarUrl} alt={`${firstName} ${lastName}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.32), fontWeight: 800, color: "#fff",
      letterSpacing: "-0.01em", flexShrink: 0,
      boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
      border,
    }}>
      {initials}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, sub }: {
  label: string; value: number | string; color: string; icon: React.ReactNode; sub?: string;
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, padding: "1.1rem 1.25rem",
      display: "flex", alignItems: "flex-start", gap: "1rem",
      boxShadow: T.shadow, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 80, height: 80,
        background: `${color}08`, borderRadius: "0 16px 0 80px",
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: "0.02em" }}>{label}</p>
        {sub && <p style={{ margin: "0.15rem 0 0", fontSize: 10, color: T.faint }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Add / Edit Doctor Modal ──────────────────────────────────────────────────
function DoctorModal({ mode, initial, onClose, onSaved }: {
  mode: "add" | "edit";
  initial?: DoctorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank = { firstName: "", lastName: "", email: "", password: "", hospital: "", specialty: "Gastroenterology", phone: "", role: "doctor" };
  const [form, setForm] = useState(
    mode === "edit" && initial
      ? {
          firstName: initial.firstName ?? "",
          lastName:  initial.lastName  ?? "",
          email:     initial.email     ?? "",
          password:  "",
          hospital:  initial.hospital  ?? "",
          specialty: initial.specialty ?? "Gastroenterology",
          phone:     initial.phone     ?? "",
          role:      initial.role      ?? "doctor",
        }
      : blank
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setError("");
    try {
      const url    = mode === "add" ? "/api/admin/doctors" : `/api/admin/doctors/${initial!.id}`;
      const method = mode === "add" ? "POST" : "PATCH";
      const body   = { ...form };
      if (mode === "edit" && !body.password) delete (body as any).password;
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      onSaved();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const SPECIALTIES = ["Gastroenterology", "Internal Medicine", "Surgery", "Oncology"];

  const rows: { k: string; l: string; type?: string; opts?: string[] }[] = [
    { k: "firstName", l: "First Name" },
    { k: "lastName",  l: "Last Name" },
    { k: "email",     l: "Email",    type: "email" },
    { k: "password",  l: mode === "edit" ? "New Password (leave blank)" : "Password", type: "password" },
    { k: "hospital",  l: "Hospital / Institution" },
    { k: "specialty", l: "Specialty", opts: SPECIALTIES },
    { k: "phone",     l: "Phone" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
      <div style={{ background: T.surface, borderRadius: 20, boxShadow: "0 32px 80px rgba(0,0,0,0.22)", width: "100%", maxWidth: 480, overflow: "hidden" }}>
        {/* Modal header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.85rem" }}>
          {mode === "edit" && initial && (
            <DoctorAvatar firstName={initial.firstName} lastName={initial.lastName} size={42} />
          )}
          {mode === "add" && (
            <div style={{ width: 42, height: 42, borderRadius: 12, background: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>
              {mode === "add" ? "Add New Doctor" : `Edit Dr. ${initial?.firstName} ${initial?.lastName}`}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: T.muted }}>
              {mode === "add" ? "Fill in the details to onboard a new physician" : "Update physician profile information"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 9, width: 32, height: 32, color: T.muted, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "1.1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.7rem", maxHeight: "60vh", overflowY: "auto" }}>
          {rows.map(({ k, l, type, opts }) => (
            <div key={k}>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 4 }}>{l}</label>
              {opts ? (
                <select value={(form as any)[k] ?? ""} onChange={e => f(k, e.target.value)}
                  style={{ width: "100%", borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.5rem 0.75rem", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f8faff", color: T.text }}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={type ?? "text"} value={(form as any)[k] ?? ""} onChange={e => f(k, e.target.value)}
                  style={{ width: "100%", borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.5rem 0.75rem", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f8faff", boxSizing: "border-box", color: T.text }} />
              )}
            </div>
          ))}
          {error && <p style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "0.5rem 0.75rem", margin: 0 }}>{error}</p>}
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${T.border}`, display: "flex", gap: "0.55rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "0.55rem 1.25rem", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: T.muted }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding: "0.55rem 1.5rem", borderRadius: 9, border: "none", background: saving ? "#94a3b8" : T.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : mode === "add" ? "Create Doctor" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ Sub-views ═════════════════════════════════════════════════════════════════

function OverviewTab({ stats, recent }: { stats: Stats | null; recent: ActivityItem[] }) {
  if (!stats) return null;
  const totalRisk = Object.values(stats.riskMap ?? {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
        <StatCard label="Total Doctors" value={stats.totalDoctors} color="#3b82f6"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
        <StatCard label="Patients" value={stats.totalPatients} color="#DC2626"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <StatCard label="Clinical Visits" value={stats.totalVisits} color="#f97316"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <StatCard label="AI Analyses" value={stats.totalAnalyses} color="#1D4ED8"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>} />
        <StatCard label="Reports Issued" value={stats.totalReports} color="#a855f7"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
        <StatCard label="Lesions Detected" value={stats.totalLesions} color="#ef4444"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        <StatCard label="High Risk Cases" value={stats.highRiskAnalyses} color="#dc2626"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
        <StatCard label="Avg. AI Confidence" value={`${stats.avgConfidence}%`} color="#14b8a6"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
        {/* Risk Distribution */}
        {stats.riskMap && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "1.25rem", boxShadow: T.shadow }}>
            <p style={{ margin: "0 0 1rem", fontSize: 13, fontWeight: 800, color: T.text }}>Risk Distribution</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(stats.riskMap).map(([risk, n]) => {
                const c = riskColor(risk);
                const pct = Math.round((n / totalRisk) * 100);
                return (
                  <div key={risk}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.fg, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
                        {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{n}</span>
                    </div>
                    <div style={{ height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: c.dot, borderRadius: 99, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analysis Breakdown */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "1.25rem", boxShadow: T.shadow }}>
          <p style={{ margin: "0 0 1rem", fontSize: 13, fontWeight: 800, color: T.text }}>Analysis Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "Image Detection", value: stats.detectionCount ?? 0, color: "#1D4ED8" },
              { label: "Lesion Segmentation", value: stats.segmentationCount ?? 0, color: "#3b82f6" },
              { label: "Live Monitoring", value: stats.liveCount ?? 0, color: "#DC2626" },
            ].map(({ label, value, color }) => {
              const max = Math.max(stats.detectionCount ?? 0, stats.segmentationCount ?? 0, stats.liveCount ?? 1, 1);
              const pct = Math.round((value / max) * 100);
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{value}</span>
                  </div>
                  <div style={{ height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>Recent Activity</p>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.faint, background: "#f8fafc", border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 8px" }}>LIVE FEED</span>
        </div>
        <div>
          {recent.map(r => {
            const c = riskColor(r.risk);
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.75rem 1.25rem", borderBottom: `1px solid #f8fafc`, transition: "background 0.15s" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Dr. {r.doctor} <span style={{ color: T.faint, fontWeight: 400 }}>→</span> {r.patient}
                  </p>
                  <p style={{ margin: "1px 0 0", fontSize: 11, color: T.muted }}>{r.type} · {fmtDate(r.date)}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 8px", background: c.bg, color: c.fg, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>
                  {r.risk.toUpperCase()} · {r.confidence}%
                </span>
              </div>
            );
          })}
          {recent.length === 0 && (
            <p style={{ padding: "2rem", textAlign: "center", color: T.faint, fontSize: 13, margin: 0 }}>No recent activity</p>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Doctor Card ──────────────────────────────────────────────────────────────
function DoctorCard({ d, onEdit, onDelete, deleting }: {
  d: DoctorRow;
  onEdit: (d: DoctorRow) => void;
  onDelete: (d: DoctorRow) => void;
  deleting: string | null;
}) {
  const spBadge = specialtyBadge(d.specialty);
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.radius, boxShadow: T.shadow,
      overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "transform 0.18s, box-shadow 0.18s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(59,130,246,0.13)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadow; }}
    >
      {/* Card top strip */}
      <div style={{ height: 6, background: nameGradient(`${d.firstName}${d.lastName}`) }} />

      {/* Card body */}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.5rem", flex: 1 }}>
        <DoctorAvatar firstName={d.firstName} lastName={d.lastName} size={68} />
        <div>
          <Link href={`/admin/doctors/${d.id}`} style={{ textDecoration: "none" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>
              Dr. {d.firstName} {d.lastName}
            </p>
          </Link>
          <span style={{
            display: "inline-block", marginTop: 5,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
            borderRadius: 6, padding: "2px 9px",
            background: spBadge.bg, color: spBadge.fg,
            border: `1px solid ${spBadge.fg}22`,
          }}>
            {d.specialty.toUpperCase()}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, color: T.muted, fontSize: 11 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{d.hospital}</span>
        </div>

        <div style={{ fontSize: 11, color: T.faint, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          {d.email}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
        {[
          { n: d._count.patients,       label: "Patients",  color: "#DC2626" },
          { n: d._count.analysisResults, label: "Analyses",  color: "#1D4ED8" },
          { n: d._count.reports,        label: "Reports",   color: "#a855f7" },
        ].map(({ n, label, color }, i) => (
          <div key={label} style={{
            padding: "0.75rem 0.5rem", textAlign: "center",
            borderRight: i < 2 ? `1px solid ${T.border}` : "none",
          }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color, letterSpacing: "-0.02em" }}>{n}</p>
            <p style={{ margin: "1px 0 0", fontSize: 9, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Actions row */}
      <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <ActionButton href={`/admin/doctors/${d.id}`} label="View Profile" icon={eyeIcon} variant="primary" />
        <ActionButton onClick={() => onEdit(d)} label="Edit" icon={editIcon} variant="neutral" />
        <div style={{ marginLeft: "auto" }}>
          <DangerButton onClick={() => onDelete(d)} loading={deleting === d.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Doctors Tab ──────────────────────────────────────────────────────────────
function DoctorsTab({ doctors, onAdd, onEdit, onDelete, deleting }: {
  doctors: DoctorRow[];
  onAdd: () => void;
  onEdit: (d: DoctorRow) => void;
  onDelete: (d: DoctorRow) => void;
  deleting: string | null;
}) {
  const [search, setSearch] = useState("");
  const filtered = doctors.filter(d =>
    search === "" ||
    `${d.firstName} ${d.lastName} ${d.email} ${d.hospital} ${d.specialty}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search doctors by name, email, hospital…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: "0.5rem", paddingBottom: "0.5rem", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", background: T.surface, boxSizing: "border-box", color: T.text }}
          />
        </div>
        <span style={{ fontSize: 13, color: T.faint, fontWeight: 600, whiteSpace: "nowrap" }}>{filtered.length} physician{filtered.length !== 1 ? "s" : ""}</span>
        <button onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1.25rem", borderRadius: 10, border: "none", background: T.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Add Doctor
        </button>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "3rem", textAlign: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: "1rem" }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.muted }}>No doctors found</p>
          <p style={{ margin: "0.35rem 0 0", fontSize: 12, color: T.faint }}>Try adjusting your search or add a new physician</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
          {filtered.map(d => (
            <DoctorCard key={d.id} d={d} onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Patients Tab ─────────────────────────────────────────────────────────────
function PatientsTab({ doctors }: { doctors: DoctorRow[] }) {
  const confirm = useConfirm();
  const [patients, setPatients]   = useState<PatientRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [doctorId, setDoctorId]   = useState<string>("");
  const [status, setStatus]       = useState<string>("all");
  const [search, setSearch]       = useState("");
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (doctorId) qs.set("doctorId", doctorId);
      if (status)   qs.set("status", status);
      if (search)   qs.set("search", search);
      const res  = await fetch(`/api/admin/patients?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) setPatients(data.patients);
    } finally { setLoading(false); }
  }, [doctorId, status, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (p: PatientRow) => {
    const ok = await confirm({
      variant: "danger",
      title:   "Delete patient?",
      message: <>Are you sure you want to delete <strong>{p.firstName} {p.lastName}</strong>? All their visits, reports and analyses will be permanently removed.</>,
      detail:  `Under Dr. ${p.doctor.firstName} ${p.doctor.lastName} · ${p.doctor.hospital}`,
      confirmLabel: "Delete patient",
    });
    if (!ok) return;
    setDeleting(p.id);
    await fetch(`/api/admin/patients/${p.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const selectStyle: React.CSSProperties = { borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.65rem", fontSize: 12, background: T.surface, fontFamily: "inherit", color: T.text, outline: "none" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>
          Patients <span style={{ fontWeight: 500, color: T.faint }}>({patients.length})</span>
        </p>
        <select value={doctorId} onChange={e => setDoctorId(e.target.value)} style={selectStyle}>
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          <option value="all">Any Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Discharged">Discharged</option>
        </select>
        <input placeholder="Search patient…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 140, borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.75rem", fontSize: 12, background: T.surface, outline: "none", fontFamily: "inherit", color: T.text }} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Patient", "Physician", "Condition", "Status", "Visits", "Reports", "Registered", ""].map(h => (
                <th key={h} style={{ padding: "0.6rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: T.faint, fontSize: 13 }}>Loading…</td></tr>}
            {!loading && patients.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                <td style={{ padding: "0.65rem 0.9rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: T.muted, flexShrink: 0 }}>
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.text }}>{p.firstName} {p.lastName}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 10, color: T.faint }}>{p.gender} · {p.dateOfBirth}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "0.65rem 0.9rem" }}>
                  {p.doctor ? (
                    <>
                      <Link href={`/admin/doctors/${p.doctor.id}`} style={{ color: T.blue, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                        Dr. {p.doctor.firstName} {p.doctor.lastName}
                      </Link>
                      <p style={{ margin: "1px 0 0", fontSize: 10, color: T.faint }}>{p.doctor.hospital}</p>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: T.faint, fontStyle: "italic" }}>Unassigned</span>
                  )}
                </td>
                <td style={{ padding: "0.65rem 0.9rem", fontSize: 12, color: T.muted }}>{p.condition || "—"}</td>
                <td style={{ padding: "0.65rem 0.9rem" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 9px",
                    background: p.status === "Active" ? "#f0fdf4" : "#f8fafc",
                    color:      p.status === "Active" ? "#15803d" : T.muted,
                    border:     `1px solid ${p.status === "Active" ? "#bbf7d0" : T.border}` }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: "0.65rem 0.9rem", fontSize: 13, fontWeight: 800, color: "#f97316", textAlign: "center" }}>{p._count.visits}</td>
                <td style={{ padding: "0.65rem 0.9rem", fontSize: 13, fontWeight: 800, color: "#a855f7", textAlign: "center" }}>{p._count.reports}</td>
                <td style={{ padding: "0.65rem 0.9rem", fontSize: 11, color: T.faint, whiteSpace: "nowrap" }}>{fmtDateShort(p.createdAt)}</td>
                <td style={{ padding: "0.65rem 0.9rem" }}>
                  <DangerButton onClick={() => handleDelete(p)} loading={deleting === p.id} />
                </td>
              </tr>
            ))}
            {!loading && patients.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", fontSize: 13, color: T.faint }}>No patients found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ doctors }: { doctors: DoctorRow[] }) {
  const confirm = useConfirm();
  const [reports, setReports]   = useState<ReportRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus]     = useState("all");
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (doctorId) qs.set("doctorId", doctorId);
      if (status)   qs.set("status", status);
      if (search)   qs.set("search", search);
      const res  = await fetch(`/api/admin/reports?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) setReports(data.reports);
    } finally { setLoading(false); }
  }, [doctorId, status, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (r: ReportRow) => {
    const ok = await confirm({
      variant: "danger",
      title:   "Delete report?",
      message: <>Are you sure you want to delete this report?</>,
      detail:  `${r.title} · Dr. ${r.doctor.firstName} ${r.doctor.lastName} → ${r.patient.firstName} ${r.patient.lastName}`,
      confirmLabel: "Delete report",
    });
    if (!ok) return;
    setDeleting(r.id);
    await fetch(`/api/admin/reports/${r.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const selectStyle: React.CSSProperties = { borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.65rem", fontSize: 12, background: T.surface, fontFamily: "inherit", color: T.text, outline: "none" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>
          Reports <span style={{ fontWeight: 500, color: T.faint }}>({reports.length})</span>
        </p>
        <select value={doctorId} onChange={e => setDoctorId(e.target.value)} style={selectStyle}>
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          <option value="all">Any Status</option>
          <option value="draft">Draft</option>
          <option value="finalized">Finalized</option>
          <option value="archived">Archived</option>
        </select>
        <input placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 140, borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.75rem", fontSize: 12, background: T.surface, outline: "none", fontFamily: "inherit", color: T.text }} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Title", "Physician", "Patient", "Risk", "Status", "Date", ""].map(h => (
                <th key={h} style={{ padding: "0.6rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: T.faint, fontSize: 13 }}>Loading…</td></tr>}
            {!loading && reports.map((r, i) => {
              const c = riskColor(r.analysis?.overallRisk ?? "");
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 13, fontWeight: 700, color: T.text }}>{r.title}</td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <Link href={`/admin/doctors/${r.doctor.id}`} style={{ color: T.blue, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      Dr. {r.doctor.firstName} {r.doctor.lastName}
                    </Link>
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 12, color: T.muted }}>{r.patient.firstName} {r.patient.lastName}</td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    {r.analysis ? (
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 9px", background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
                        {r.analysis.overallRisk.toUpperCase()} · {Math.round(r.analysis.overallConfidence)}%
                      </span>
                    ) : <span style={{ color: T.faint, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.status === "finalized" ? "#15803d" : T.muted }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 11, color: T.faint, whiteSpace: "nowrap" }}>{fmtDateShort(r.createdAt)}</td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <ActionButton href={`/api/reports/${r.id}/pdf?print=1`} label="View" icon={eyeIcon} variant="primary" external />
                      {r.pdfUrl && <ActionButton href={r.pdfUrl} label="PDF" icon={pdfIcon} variant="neutral" />}
                      <DangerButton onClick={() => handleDelete(r)} loading={deleting === r.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && reports.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", fontSize: 13, color: T.faint }}>No reports found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analyses Tab ─────────────────────────────────────────────────────────────
function AnalysesTab({ doctors }: { doctors: DoctorRow[] }) {
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [risk, setRisk]         = useState("all");
  const [type, setType]         = useState("all");
  const [search, setSearch]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (doctorId) qs.set("doctorId", doctorId);
      if (risk)     qs.set("risk", risk);
      if (type)     qs.set("type", type);
      if (search)   qs.set("search", search);
      const res  = await fetch(`/api/admin/analyses?${qs.toString()}`);
      const data = await res.json();
      if (res.ok) setAnalyses(data.analyses);
    } finally { setLoading(false); }
  }, [doctorId, risk, type, search]);

  useEffect(() => { load(); }, [load]);

  const selectStyle: React.CSSProperties = { borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.65rem", fontSize: 12, background: T.surface, fontFamily: "inherit", color: T.text, outline: "none" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>
          Analyses <span style={{ fontWeight: 500, color: T.faint }}>({analyses.length})</span>
        </p>
        <select value={doctorId} onChange={e => setDoctorId(e.target.value)} style={selectStyle}>
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>)}
        </select>
        <select value={risk} onChange={e => setRisk(e.target.value)} style={selectStyle}>
          <option value="all">All Risk</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
          <option value="all">All Types</option>
          <option value="detection">Detection</option>
          <option value="segmentation">Segmentation</option>
          <option value="video">Video / Live</option>
        </select>
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 140, borderRadius: 9, border: `1px solid ${T.border}`, padding: "0.45rem 0.75rem", fontSize: 12, background: T.surface, outline: "none", fontFamily: "inherit", color: T.text }} />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["ID", "Physician", "Patient", "Type", "Risk", "Confidence", "Frames", "Report", "Date"].map(h => (
                <th key={h} style={{ padding: "0.6rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: T.faint, fontSize: 13 }}>Loading…</td></tr>}
            {!loading && analyses.map((a, i) => {
              const c = riskColor(a.risk);
              return (
                <tr key={a.id} style={{ borderBottom: `1px solid #f8fafc`, background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 11, fontFamily: "monospace", color: T.faint }}>{a.shortId}</td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <Link href={`/admin/doctors/${a.doctorId}`} style={{ color: T.blue, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>{a.doctor}</Link>
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 12, color: T.muted }}>{a.patient}</td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 11, color: T.muted }}>{a.analysisType}</td>
                  <td style={{ padding: "0.65rem 0.9rem" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 9px", background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>{a.risk.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 13, fontWeight: 800, color: "#14b8a6" }}>{a.confidence}%</td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 12, color: T.muted }}>{a.framesWithDetection}/{a.framesAnalyzed}</td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 13 }}>
                    {a.hasReport ? <span style={{ color: "#15803d", fontWeight: 800 }}>✓</span> : <span style={{ color: T.faint }}>—</span>}
                  </td>
                  <td style={{ padding: "0.65rem 0.9rem", fontSize: 11, color: T.faint, whiteSpace: "nowrap" }}>{fmtDateShort(a.analyzedAt)}</td>
                </tr>
              );
            })}
            {!loading && analyses.length === 0 && (
              <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", fontSize: 13, color: T.faint }}>No analyses found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────
function ActivityTab() {
  const [events, setEvents]   = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState<"all" | FeedEvent["kind"]>("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/activity?limit=80")
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.kind === filter);

  const kindMeta: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    analysis: { color: "#1D4ED8", label: "Analysis",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    report:   { color: "#a855f7", label: "Report",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    patient:  { color: "#DC2626", label: "Patient",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    visit:    { color: "#f97316", label: "Visit",
      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: `1px solid ${T.border}`, display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>
          Platform Activity <span style={{ fontWeight: 500, color: T.faint }}>({filtered.length})</span>
        </p>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {(["all", "analysis", "report", "patient", "visit"] as const).map(k => {
            const meta = k === "all" ? null : kindMeta[k];
            return (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding: "0.35rem 0.85rem", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  border: filter === k ? `1px solid ${meta?.color ?? T.blue}` : `1px solid ${T.border}`,
                  background: filter === k ? `${meta?.color ?? T.blue}12` : T.surface,
                  color: filter === k ? (meta?.color ?? T.blue) : T.muted }}>
                {k === "all" ? "All Events" : meta?.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {loading && <p style={{ padding: "2rem", textAlign: "center", color: T.faint, fontSize: 13, margin: 0 }}>Loading…</p>}
        {!loading && filtered.map((e, i) => {
          const meta = kindMeta[e.kind];
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", padding: "0.85rem 1.25rem", borderBottom: `1px solid #f8fafc` }}>
              {/* Timeline dot + line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${meta?.color}14`, color: meta?.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {meta?.icon}
                </div>
                {i < filtered.length - 1 && <div style={{ width: 1, height: 16, background: T.border, marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.text }}>{e.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>{e.subtitle}</p>
                {e.meta && <p style={{ margin: "1px 0 0", fontSize: 10, color: T.faint }}>{e.meta}</p>}
              </div>
              <span style={{ fontSize: 10, color: T.faint, whiteSpace: "nowrap", paddingTop: 4 }}>{fmtDate(e.date)}</span>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p style={{ padding: "2.5rem", textAlign: "center", color: T.faint, fontSize: 13, margin: 0 }}>No events yet</p>
        )}
      </div>
    </div>
  );
}

// ─── Appointments Tab ─────────────────────────────────────────────────────────
interface AppointmentRow {
  id: string; scheduledDate: string; timeSlot: string;
  reason: string; notes: string; status: string; createdAt: string;
  patient: { id: string; firstName: string; lastName: string; email: string; phone: string };
  doctor:  { id: string; firstName: string; lastName: string; specialty: string; hospital: string };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#fff7ed", color: "#c2410c" },
  confirmed: { bg: "#f0fdf4", color: "#15803d" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c" },
  completed: { bg: "#eff6ff", color: "#1d4ed8" },
};

function AppointmentsTab() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<"all" | "pending" | "confirmed" | "cancelled">("pending");
  const [acting,       setActing]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/appointments");
      const data = await res.json();
      setAppointments(data.appointments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: "confirmed" | "cancelled") => {
    setActing(id);
    try {
      await fetch("/api/admin/appointments", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, status }),
      });
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      window.dispatchEvent(new Event("appointments-updated"));
    } finally {
      setActing(null);
    }
  };

  const visible = filter === "all" ? appointments : appointments.filter(a => a.status === filter);
  const pendingCount = appointments.filter(a => a.status === "pending").length;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
        {(["pending", "confirmed", "cancelled", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: `1px solid ${filter === f ? T.blue : T.border}`,
            background: filter === f ? T.blueLight : T.surface,
            color: filter === f ? T.blue : T.muted,
            cursor: "pointer", fontFamily: "inherit", position: "relative",
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 800,
                background: "#ef4444", color: "#fff",
                borderRadius: 10, padding: "1px 6px",
              }}>{pendingCount}</span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.faint }}>{visible.length} appointment{visible.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.faint }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: T.faint, fontSize: 14 }}>
          No {filter === "all" ? "" : filter} appointments.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(a => {
            const st = STATUS_STYLE[a.status] ?? { bg: "#f8fafc", color: "#64748b" };
            return (
              <div key={a.id} style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 14, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                {/* Status dot */}
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: st.color, flexShrink: 0 }} />

                {/* Patient */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {a.patient.firstName} {a.patient.lastName}
                    <span style={{ fontSize: 11, color: T.faint, fontWeight: 400, marginLeft: 8 }}>{a.patient.email}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    → Dr. {a.doctor.firstName} {a.doctor.lastName} · {a.doctor.specialty}
                  </div>
                  <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>
                    {a.scheduledDate} at {a.timeSlot} · <em>{a.reason}</em>
                  </div>
                </div>

                {/* Status badge */}
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 10px", background: st.bg, color: st.color, textTransform: "capitalize", flexShrink: 0 }}>
                  {a.status}
                </span>

                {/* Actions — only for pending */}
                {a.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => act(a.id, "confirmed")}
                      disabled={acting === a.id}
                      style={{
                        padding: "6px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700,
                        background: "#DC2626", color: "#fff", cursor: "pointer", fontFamily: "inherit",
                        opacity: acting === a.id ? 0.6 : 1,
                      }}
                    >
                      {acting === a.id ? "…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => act(a.id, "cancelled")}
                      disabled={acting === a.id}
                      style={{
                        padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        border: "1px solid rgba(239,68,68,0.2)", background: "#fef2f2",
                        color: "#ef4444", cursor: "pointer", fontFamily: "inherit",
                        opacity: acting === a.id ? 0.6 : 1,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ Admins Tab ═══════════════════════════════════════════════════════════════

interface AdminRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  createdAt: string;
}

function AdminsTab({ currentAdminId }: { currentAdminId: string }) {
  const [admins,  setAdmins]  = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [err,      setErr]      = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "" });
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      const data = await res.json();
      setAdmins(data.admins ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setErr("All fields except phone are required."); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to create admin."); return; }
      setShowForm(false);
      setForm({ firstName: "", lastName: "", email: "", password: "", phone: "" });
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (a: AdminRow) => {
    const ok = await confirm({
      title: "Remove admin account",
      message: `Remove ${a.firstName} ${a.lastName} (${a.email})? They will no longer be able to log in.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setDeleting(a.id);
    try {
      await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id }),
      });
      load();
    } finally { setDeleting(null); }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1.5px solid rgba(59,130,246,0.2)", fontSize: 13,
    outline: "none", background: "#f8fafc", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>Admin Accounts</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>{admins.length} administrator{admins.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setErr(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: T.blue, color: "#fff", fontWeight: 700, fontSize: 13,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Admin
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: "20px 24px", marginBottom: 20,
          boxShadow: T.shadow,
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: T.text }}>New Admin Account</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>First Name *</label>
              <input style={inp} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>Last Name *</label>
              <input style={inp} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>Phone</label>
              <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+213 …" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>Password *</label>
              <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Temporary password" />
            </div>
          </div>
          {err && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#ef4444" }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="submit" disabled={saving} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: T.blue, color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit",
            }}>
              {saving ? "Creating…" : "Create Account"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setErr(""); }} style={{
              padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`,
              background: "transparent", color: T.muted, fontWeight: 600, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: T.muted, fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow }}>
          {admins.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>No admins found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.blueLight }}>
                  {["Admin", "Email", "Phone", "Since", ""].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, color: T.blue, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map((a, i) => (
                  <tr key={a.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: nameGradient(`${a.firstName}${a.lastName}`),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: "#fff",
                        }}>
                          {a.firstName[0]}{a.lastName[0]}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>
                            {a.firstName} {a.lastName}
                            {a.id === currentAdminId && (
                              <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px" }}>YOU</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12.5, color: T.muted }}>{a.email}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12.5, color: T.muted }}>{a.phone || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.faint }}>{fmtDateShort(a.createdAt)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {a.id !== currentAdminId && (
                        <DangerButton
                          loading={deleting === a.id}
                          onClick={() => handleDelete(a)}
                          style={{ padding: "5px 12px", fontSize: 11 }}
                        >
                          Remove
                        </DangerButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ Tab definitions ══════════════════════════════════════════════════════════

const TAB_DEFS: { k: TabKey; label: string; icon: React.ReactNode }[] = [
  { k: "overview",  label: "Overview",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { k: "doctors",   label: "Doctors",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { k: "patients",  label: "Patients",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { k: "reports",   label: "Reports",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { k: "analyses",  label: "Analyses",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { k: "activity",     label: "Activity",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { k: "appointments", label: "Appointments",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { k: "admins", label: "Admins",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/><path d="M18 2l2 2-6 6-2-2 6-6z"/></svg> },
];

// ═══ Admin Page ═══════════════════════════════════════════════════════════════
export default function AdminPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const confirm      = useConfirm();
  const tabParam     = (searchParams.get("tab") ?? "overview") as TabKey;

  const [tab, setTab]               = useState<TabKey>(tabParam);
  useEffect(() => { setTab(tabParam); }, [tabParam]);

  const switchTab = (k: TabKey) => {
    setTab(k);
    router.replace(`${pathname}?tab=${k}`, { scroll: false });
    window.dispatchEvent(new Event("admin-tab-change"));
  };

  const [stats, setStats]           = useState<Stats | null>(null);
  const [doctors, setDoctors]       = useState<DoctorRow[]>([]);
  const [recent, setRecent]         = useState<ActivityItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<DoctorRow | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [me, setMe]                 = useState<{ id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null } | null>(null);
  const [pendingAppt, setPendingAppt] = useState(0);

  useEffect(() => {
    const me = JSON.parse(localStorage.getItem("doctor") ?? "null");
    if (!me)                 { router.push("/auth");      return; }
    if (me.role !== "admin") { router.push("/dashboard"); return; }
    setMe(me);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, apptRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/appointments"),
      ]);
      const statsData = await statsRes.json();
      if (statsRes.ok) {
        setStats(statsData.stats);
        setDoctors(statsData.doctors);
        setRecent(statsData.recentActivity ?? []);
      }
      if (apptRes.ok) {
        const apptData = await apptRes.json();
        setPendingAppt((apptData.appointments ?? []).filter((a: { status: string }) => a.status === "pending").length);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh pending count whenever an appointment action is taken inside AppointmentsTab
  useEffect(() => {
    const refresh = async () => {
      try {
        const res  = await fetch("/api/admin/appointments");
        const data = await res.json();
        setPendingAppt((data.appointments ?? []).filter((a: { status: string }) => a.status === "pending").length);
      } catch { /* silent */ }
    };
    window.addEventListener("appointments-updated", refresh);
    return () => window.removeEventListener("appointments-updated", refresh);
  }, []);

  const handleDelete = async (d: DoctorRow) => {
    const ok = await confirm({
      variant: "danger",
      title:   "Delete this doctor?",
      message: <>Are you sure you want to delete <strong>Dr. {d.firstName} {d.lastName}</strong>? Their patients, visits, analyses and reports will all be permanently removed. This action cannot be undone.</>,
      detail:  `${d.email} · ${d.hospital}`,
      confirmLabel: "Delete doctor",
    });
    if (!ok) return;
    setDeleting(d.id);
    await fetch(`/api/admin/doctors/${d.id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "0.85rem" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
      <span style={{ fontSize: 14, color: T.muted, fontWeight: 500 }}>Loading platform data…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1280, margin: "0 auto", fontFamily: "inherit" }}>

      {/* ── Welcome Banner ── */}
      <div style={{
        borderRadius: T.radius, marginBottom: "0.85rem",
        overflow: "visible", position: "relative",
        background: "linear-gradient(120deg, #1e3a8a 0%, #1E40AF 45%, #0e7490 100%)",
        boxShadow: "0 8px 32px rgba(30,58,138,0.28)",
        display: "flex", alignItems: "stretch", minHeight: 148,
      }}>
        {/* ── background mesh shapes (clipped inside) ── */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: T.radius, pointerEvents: "none" }}>
          {/* big circle top-left */}
          <div style={{ position: "absolute", top: -70, left: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          {/* ring top-right */}
          <div style={{ position: "absolute", top: -30, right: 170, width: 160, height: 160, borderRadius: "50%", border: "28px solid rgba(255,255,255,0.05)" }} />
          {/* small ring bottom */}
          <div style={{ position: "absolute", bottom: -40, left: 200, width: 120, height: 120, borderRadius: "50%", border: "20px solid rgba(255,255,255,0.04)" }} />
          {/* dot grid */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "24px 24px", opacity: 0.5 }} />
        </div>

        {/* ── Text content ── */}
        <div style={{ flex: 1, padding: "1.5rem 2rem", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          {/* greeting chip */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "3px 12px 3px 8px", marginBottom: 12, width: "fit-content" }}>
            <span style={{ fontSize: 14 }}>👋</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Welcome back</span>
          </div>

          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            {me ? `Hi, ${me.firstName}!` : "Hi there!"}
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: 380 }}>
            Ready to manage your AI clinical platform today?<br/>All models are online and running.
          </p>
        </div>

      </div>

      {/* ── Header ── */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: "0.85rem 1.4rem",
          display: "flex", alignItems: "center", gap: "1rem",
          boxShadow: T.shadow,
        }}>
          {/* Title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>
              Administration
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.faint, fontWeight: 500 }}>
              GastroNeXia · Platform Management Console
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              {[
                { n: stats.totalDoctors,  label: "Doctors",  color: T.blue },
                { n: stats.totalPatients, label: "Patients", color: "#DC2626" },
                { n: stats.totalAnalyses, label: "Analyses", color: "#1D4ED8" },
                { n: stats.totalReports,  label: "Reports",  color: "#06b6d4" },
              ].map(({ n, label, color }) => (
                <div key={label} style={{
                  background: `${color}0d`, border: `1px solid ${color}22`,
                  borderRadius: 11, padding: "0.5rem 0.85rem",
                  textAlign: "center", minWidth: 60,
                }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{n ?? 0}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", overflowX: "auto", paddingBottom: 2 }}>
        {TAB_DEFS.map(t => (
          <button key={t.k} onClick={() => switchTab(t.k)}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.55rem 1.1rem", borderRadius: 10,
              border: `1px solid ${tab === t.k ? T.blue : T.border}`,
              background: tab === t.k ? T.blueLight : T.surface,
              fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              color: tab === t.k ? T.blue : T.muted,
              whiteSpace: "nowrap", transition: "all 0.15s",
              boxShadow: tab === t.k ? `0 2px 8px ${T.blue}20` : "none",
            }}>
            {t.icon}
            {t.label}
            {t.k === "appointments" && pendingAppt > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, borderRadius: 10,
                background: "#ef4444", color: "#fff", padding: "1px 6px", marginLeft: 2,
              }}>{pendingAppt}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === "overview" && <OverviewTab stats={stats} recent={recent} />}
      {tab === "doctors"  && (
        <DoctorsTab doctors={doctors}
          onAdd={() => setModal("add")}
          onEdit={d => { setEditTarget(d); setModal("edit"); }}
          onDelete={handleDelete}
          deleting={deleting} />
      )}
      {tab === "patients" && <PatientsTab doctors={doctors} />}
      {tab === "reports"  && <ReportsTab  doctors={doctors} />}
      {tab === "analyses" && <AnalysesTab doctors={doctors} />}
      {tab === "activity"     && <ActivityTab />}
      {tab === "appointments" && <AppointmentsTab />}
      {tab === "admins"       && <AdminsTab currentAdminId={me?.id ?? ""} />}

      {/* ── Modals ── */}
      {modal === "add" && (
        <DoctorModal mode="add" onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {modal === "edit" && editTarget && (
        <DoctorModal mode="edit" initial={editTarget}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSaved={() => { setModal(null); setEditTarget(null); load(); }} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
