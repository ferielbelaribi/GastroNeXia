"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  stats: {
    totalAnalyses:     number;
    totalLesions:      number;
    highRisk:          number;
    moderateRisk:      number;
    avgConfidence:     number;
    analysesThisWeek:  number;
    analysesYesterday: number;
    detectionCount:    number;
    segmentationCount: number;
  };
  charts: {
    weekData:   number[];
    weekLabels: string[];
    trendData:  number[];
    distData:   { label: string; count: number; pct: number }[];
    riskMap:    Record<string, number>;
  };
  recentCases: {
    id:           string;
    analysisId:   string;
    visitId:      string;
    patientId:    string; // ✅ أضفنا patientId
    patient:      string;
    type:         string;
    region:       string;
    confidence:   number;
    risk:         string;
    date:         string;
    imageUrl:     string | null;
    lesionCount:  number;
    analysisType: string;
    reportId?:    string | null; // ✅ أضفنا reportId
  }[];
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  high:     "#ef4444",
  moderate: "#f97316",
  medium:   "#f97316",
  normal:   "#2563EB",
  low:      "#2563EB",
};

const DIST_PALETTE = ["#2563EB", "#ef4444", "#f97316", "#a855f7", "#2563EB", "#06b6d4"];

function riskStyle(r: string) {
  if (r === "high")                       return { bg: "#fef2f2", color: "#dc2626", label: "High Risk"  };
  if (r === "moderate" || r === "medium") return { bg: "#fff7ed", color: "#c2410c", label: "Moderate"   };
  return                                         { bg: "#f0fdf4", color: "#15803d", label: "Normal"     };
}

function relDate(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const d  = Math.floor(ms / 86400000);
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor(ms / 60000);
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function ConfBar({ v, color }: { v: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30 }}>{v}%</span>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const w = 200, h = 52;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const id = `sg${color.replace("#", "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChartComp({ data, labels }: { data: number[]; labels: string[] }) {
  const max     = Math.max(...data, 1);
  const today   = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", height: `${Math.max((v / max) * 68, v > 0 ? 4 : 0)}px`,
            background: i === todayIdx ? "var(--accent, #2563EB)" : "rgba(37,99,235,0.18)",
            borderRadius: "3px 3px 0 0", transition: "height 0.6s ease",
          }} />
          <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 500 }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, total }: { data: { label: string; pct: number }[]; total: number }) {
  if (!data.length) {
    return (
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="42" fill="none" stroke="#f1f5f9" strokeWidth="16" />
        <text x="64" y="68" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "var(--ink)" }}>0</text>
      </svg>
    );
  }
  const cx = 64, cy = 64, r = 42;
  let angle = -90;
  const slices = data.map((d, idx) => {
    const sweep = (d.pct / 100) * 360;
    const a1 = (angle * Math.PI) / 180; angle += sweep;
    const a2 = (angle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    return { ...d, color: DIST_PALETTE[idx % DIST_PALETTE.length], path: `M${cx},${cy} L${x1},${y1} A${r},${r},0,${sweep > 180 ? 1 : 0},1,${x2},${y2}Z` };
  });
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity=".88" />)}
      <circle cx={cx} cy={cy} r="26" fill="var(--card, #fff)" />
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: "var(--ink)" }}>{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 9, fill: "var(--muted)" }}>lesions</text>
    </svg>
  );
}

function Skeleton({ w = "100%", h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [data,         setData]         = useState<DashboardData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [activeRisk,   setActiveRisk]   = useState<string>("all");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      const url    = doctor?.id ? `/api/dashboard?doctorId=${doctor.id}` : "/api/dashboard";
      const res    = await fetch(url);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Filtered table ────────────────────────────────────────────────
  const filtered = (data?.recentCases ?? []).filter((c) =>
    (activeFilter === "all" || c.analysisType === activeFilter) &&
    (activeRisk   === "all" || c.risk         === activeRisk)
  );

  // ── Navigate: click on a row → go to that patient's report ───────
  const handleRowClick = (c: DashboardData["recentCases"][0]) => {
    if (c.reportId) {
      router.push(`/reports?patientId=${c.patientId}&reportId=${c.reportId}`);
    } else {
      router.push(`/reports?patientId=${c.patientId}`);
    }
  };

  // ✅ "New Patient" → patients page
  const handleNewPatient = () => router.push("/patient");

  const [doctor,   setDoctor]   = useState<{ firstName?: string; lastName?: string; id?: string } | null>(null);
  const [greeting, setGreeting] = useState("Good morning");
  const [dateStr,  setDateStr]  = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (stored) {
      const user = JSON.parse(stored);
      if (user.role === "patient") { router.replace("/portal"); return; }
      setDoctor(user);
    }

    const now = new Date();
    const h   = now.getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setDateStr(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, [router]);

  const C = {
    blue:   "#2563EB",
    red:    "#ef4444",
    orange: "#f97316",
    green:  "#2563EB",
    ink:    "#0f172a",
    muted:  "#64748b",
    faint:  "#94a3b8",
    border: "#f1f5f9",
    card:   "#ffffff",
    bg:     "#f8fafc",
  };

  const card: React.CSSProperties = {
    background: C.card, border: "1px solid #eef2f7", borderRadius: 18,
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 22, background: "#f8fafc" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .dbu { animation: fadeUp 0.4s ease both; }
        .sc:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(37,99,235,0.1) !important; }
        .cc:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08) !important; }
        .dr:hover td { background: #f8fafc !important; cursor: pointer; }
        .bv:hover { background: #2563EB !important; color: #fff !important; border-color: #2563EB !important; }
        .fb:hover { border-color: rgba(37,99,235,0.4) !important; color: #2563EB !important; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p suppressHydrationWarning style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.02em" }}>
            {dateStr}
          </p>
          <h1 suppressHydrationWarning style={{ margin: 0, fontSize: 26, fontWeight: 900, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {greeting}{doctor?.firstName ? `, Dr. ${doctor.firstName}` : ""}.
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: C.muted }}>
            Here is your clinical AI overview for today.
          </p>
        </div>
        <button onClick={fetchDashboard} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "9px 18px", borderRadius: 12,
          border: "1.5px solid #e2e8f0", background: C.card,
          fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          color: C.muted, transition: "all 0.15s",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          {loading ? "Updating…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "0.8rem 1.1rem", fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error} —{" "}
          <button onClick={fetchDashboard} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700, padding: 0 }}>Retry</button>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { label: "Total Examinations",   value: loading ? null : String(data?.stats.totalAnalyses ?? 0),   delta: loading ? null : `+${data?.stats.analysesThisWeek ?? 0} this week`,                                 color: C.blue,   icon: <ExamIcon /> },
          { label: "Lesions Identified",   value: loading ? null : String(data?.stats.totalLesions ?? 0),    delta: loading ? null : `${data?.stats.highRisk ?? 0} require urgent review`,                               color: C.red,    icon: <LesionIcon /> },
          { label: "High-Risk Findings",   value: loading ? null : String(data?.stats.highRisk ?? 0),        delta: loading ? null : `${data?.stats.moderateRisk ?? 0} moderate risk`,                                   color: C.orange, icon: <AlertIcon /> },
          { label: "Diagnostic Confidence",value: loading ? null : `${data?.stats.avgConfidence ?? 0}%`,     delta: loading ? null : `CAD: ${data?.stats.detectionCount ?? 0} · Seg: ${data?.stats.segmentationCount ?? 0}`, color: C.green,  icon: <TrendIcon /> },
        ].map((s, i) => (
          <div key={s.label} className="sc dbu" style={{ ...card, padding: "22px 24px", position: "relative", transition: "transform 0.2s, box-shadow 0.2s", animationDelay: `${i * 0.06}s` }}>
            {/* left accent */}
            <div style={{ position: "absolute", left: 0, top: 16, bottom: 16, width: 4, borderRadius: "0 4px 4px 0", background: s.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${s.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                {s.icon}
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: C.ink, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {s.value === null ? <Skeleton h={32} w={64} /> : s.value}
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: s.color }}>
              {s.delta === null ? <Skeleton h={11} w={90} /> : `↑ ${s.delta}`}
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 260px", gap: 16 }}>

        {/* Trend */}
        <div className="cc dbu" style={{ ...card, padding: "22px 24px", transition: "box-shadow 0.2s", animationDelay: "0.14s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink }}>Examination Volume</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>Last 10 days</p>
            </div>
            {!loading && data && (
              <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                {data.stats.analysesThisWeek > 0 ? `+${data.stats.analysesThisWeek} this week` : "No activity yet"}
              </span>
            )}
          </div>
          <div style={{ padding: "4px 0" }}>
            {loading ? <Skeleton h={52} /> : <Sparkline data={data?.charts.trendData ?? [0]} color={C.blue} />}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {["10d ago","","","","","","","","","Today"].map((l, i) => (
              <span key={i} style={{ fontSize: 9, color: C.faint }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Weekly bar */}
        <div className="cc dbu" style={{ ...card, padding: "22px 24px", transition: "box-shadow 0.2s", animationDelay: "0.2s" }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink }}>Weekly Activity</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>Mon–Sun · Current calendar week</p>
          </div>
          {loading ? <Skeleton h={80} /> : (
            <BarChartComp
              data={data?.charts.weekData ?? [0,0,0,0,0,0,0]}
              labels={data?.charts.weekLabels ?? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]}
            />
          )}
        </div>

        {/* Donut */}
        <div className="cc dbu" style={{ ...card, padding: "22px 24px", transition: "box-shadow 0.2s", animationDelay: "0.27s" }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: C.ink }}>Pathology Distribution</p>
          {loading ? (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Skeleton h={128} w={128} r={64} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton h={12} /><Skeleton h={12} /><Skeleton h={12} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <DonutChart data={data?.charts.distData ?? []} total={data?.stats.totalLesions ?? 0} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                {data?.charts.distData.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No lesions recorded</p>
                ) : data?.charts.distData.map((d, i) => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: DIST_PALETTE[i % DIST_PALETTE.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: DIST_PALETTE[i % DIST_PALETTE.length] }}>{d.pct}%</span>
                  </div>
                ))}
                {data && (
                  <div style={{ marginTop: 4, padding: "6px 8px", background: "#f8fafc", borderRadius: 8, fontSize: 10.5, color: C.muted, lineHeight: 1.7 }}>
                    <span style={{ color: C.red, fontWeight: 700 }}>{data.stats.highRisk} High</span>
                    {" · "}
                    <span style={{ color: C.orange, fontWeight: 700 }}>{data.stats.moderateRisk} Moderate</span>
                    {" · "}
                    <span style={{ color: C.green, fontWeight: 700 }}>
                      {Math.max(0, data.stats.totalAnalyses - data.stats.highRisk - data.stats.moderateRisk)} Normal
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CASES TABLE ── */}
      <div className="dbu" style={{ ...card, animationDelay: "0.32s" }}>
        {/* Table header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.ink }}>Recent Endoscopic Examinations</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.muted }}>Click on a row to view the patient&apos;s diagnostic report</p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { key: "all",          label: "All Methods" },
              { key: "detection",    label: "CAD",         dot: C.blue },
              { key: "segmentation", label: "Segmentation",dot: "#a855f7" },
            ].map((f) => (
              <button key={f.key} className="fb" onClick={() => setActiveFilter(f.key)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 20,
                border: `1.5px solid ${activeFilter === f.key ? (f.dot ?? C.blue) : "#e2e8f0"}`,
                background: activeFilter === f.key ? `${f.dot ?? C.blue}10` : "transparent",
                fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                color: activeFilter === f.key ? (f.dot ?? C.blue) : C.muted,
                transition: "all 0.15s",
              }}>
                {f.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot }} />}
                {f.label}
              </button>
            ))}
            <div style={{ width: 1, height: 18, background: "#e2e8f0" }} />
            {[
              { key: "all",      label: "All Risk" },
              { key: "high",     label: "High",     dot: C.red },
              { key: "moderate", label: "Moderate",  dot: C.orange },
            ].map((f) => (
              <button key={f.key} className="fb" onClick={() => setActiveRisk(f.key)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 20,
                border: `1.5px solid ${activeRisk === f.key ? (f.dot ?? C.blue) : "#e2e8f0"}`,
                background: activeRisk === f.key ? `${f.dot ?? C.blue}10` : "transparent",
                fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                color: activeRisk === f.key ? (f.dot ?? C.blue) : C.muted,
                transition: "all 0.15s",
              }}>
                {f.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot }} />}
                {f.label}
              </button>
            ))}
            <button onClick={() => router.push("/reports")} style={{
              padding: "7px 16px", borderRadius: 10,
              background: C.blue, color: "#fff", border: "none",
              fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              marginLeft: 2,
            }}>
              View Reports
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafbff" }}>
                {["Ref. ID","Patient","Diagnosis","Site","AI Confidence","Risk","Method","Date",""].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} style={{ padding: "13px 14px" }}><Skeleton h={12} w={j === 0 ? 70 : j === 4 ? 110 : 80} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: 13 }}>
                    {data?.recentCases.length === 0
                      ? "No examinations recorded yet."
                      : "No results match the selected filters."}
                  </td>
                </tr>
              ) : filtered.map((c, i) => {
                const rs        = riskStyle(c.risk);
                const confColor = c.confidence >= 90 ? C.green : c.confidence >= 75 ? C.orange : C.red;
                return (
                  <tr key={i} className="dr" onClick={() => handleRowClick(c)} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: C.blue, background: "#eff6ff", padding: "2px 7px", borderRadius: 5 }}>{c.id}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: C.ink }}>{c.patient}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: rs.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 12, color: C.ink }}>{c.type}</span>
                        {c.lesionCount > 1 && <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>×{c.lesionCount}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: C.muted, fontSize: 12 }}>{c.region || "—"}</td>
                    <td style={{ padding: "12px 14px", minWidth: 130 }}><ConfBar v={c.confidence} color={confColor} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: rs.bg, color: rs.color, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{rs.label}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600,
                        color:      c.analysisType === "detection" ? C.blue : "#a855f7",
                        background: c.analysisType === "detection" ? "#eff6ff" : "#faf5ff",
                        padding: "2px 8px", borderRadius: 5,
                        border: `1px solid ${c.analysisType === "detection" ? "#bfdbfe" : "#e9d5ff"}`,
                      }}>
                        {c.analysisType === "detection" ? "CAD" : "Segmentation"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", color: C.faint, fontSize: 11.5, whiteSpace: "nowrap" }}>{relDate(c.date)}</td>
                    <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                      {c.reportId ? (
                        <button className="bv" onClick={() => handleRowClick(c)} style={{
                          fontSize: 11, padding: "5px 13px", borderRadius: 8,
                          border: "1.5px solid #bfdbfe", background: "#eff6ff",
                          color: "#2563eb", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all 0.15s",
                        }}>Report</button>
                      ) : <span style={{ fontSize: 10, color: "#d1d5db" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>
            {loading ? "" : `Showing ${filtered.length} of ${data?.recentCases.length ?? 0} examinations`}
          </span>
          <button onClick={handleNewPatient} style={{
            fontSize: 11.5, fontWeight: 700, color: C.blue, background: "none",
            border: "none", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            New Patient
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ExamIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function LesionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12s1-3 4-3 4 3 4 3-1 3-4 3-4-3-4-3z"/>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
      <polyline points="17,6 23,6 23,12"/>
    </svg>
  );
}