"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Ico from "@/components/ui/ico";
import { I } from "@/lib/icons";

const TITLES: Record<string, string> = {
  "/":                  "Dashboard",
  "/dashboard":         "Dashboard",
  "/live":              "Polyp AI Diagnostics",
  "/segmentation":      "Segmentation",
  "/gallery":           "Gallery",
  "/reports":           "Reports",
  "/patient":           "Patient",
  "/patients":          "Patient",
  "/annotation":        "Data Collection Collab",
  "/annotation/results":"Data Collection Collab",
  "/availability":      "Availability",
  "/account":           "Account",
  "/settings":          "Settings",
  "/admin":             "Administration",
};

interface DoctorData {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role?: string;
}

interface SearchResults {
  patients: { id: string; name: string; condition: string; status: string; doctor: string; doctorId: string }[];
  reports:  { id: string; title: string; status: string; date: string; patient: string; patientId: string; doctor: string; doctorId: string }[];
  analyses: { id: string; shortId: string; type: string; risk: string; confidence: number; date: string; patient: string; patientId?: string; doctor: string; doctorId: string }[];
  visits:   { id: string; type: string; status: string; date: string; patient: string; patientId: string; doctor: string; doctorId: string }[];
  doctors:  { id: string; name: string; email: string; specialty: string; hospital: string }[];
}

const empty: SearchResults = { patients: [], reports: [], analyses: [], visits: [], doctors: [] };

const riskColor = (risk: string) => {
  const r = (risk ?? "").toLowerCase();
  if (r === "high")   return { bg: "#fef2f2", fg: "#b91c1c" };
  if (r === "medium") return { bg: "#fff7ed", fg: "#c2410c" };
  return { bg: "#f0fdf4", fg: "#15803d" };
};

export default function Topbar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const isGuest      = searchParams.get("guest") === "true";

  // strip /admin prefix for sub-pages
  const normalPath = pathname.startsWith("/admin") ? "/admin" : pathname;
  const title = TITLES[normalPath] ?? "Dashboard";

  const [doctor,   setDoctor]   = useState<DoctorData | null>(null);
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResults>(empty);
  const [loading,  setLoading]  = useState(false);
  const [open,        setOpen]        = useState(false);
  const [focusIdx,    setFocusIdx]    = useState(-1);
  const [profileOpen, setProfileOpen] = useState(false);

  const [notifOpen,   setNotifOpen]   = useState(false);
  const [notifs,      setNotifs]      = useState<{ id: string; title: string; message: string; isRead: boolean; createdAt: string; type: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const wrapRef     = useRef<HTMLDivElement>(null);
  const profileRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncDoctor = () => {
    const stored = localStorage.getItem("doctor");
    if (stored) setDoctor(JSON.parse(stored));
  };

  useEffect(() => {
    syncDoctor();
    window.addEventListener("doctor-updated", syncDoctor);
    return () => window.removeEventListener("doctor-updated", syncDoctor);
  }, []);

  const fetchNotifs = async (d: DoctorData) => {
    if (d.role !== "doctor") return;
    try {
      const res = await fetch(`/api/admin/notifications?targetId=${d.id}&targetRole=doctor`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!doctor) return;
    fetchNotifs(doctor);
    const interval = setInterval(() => fetchNotifs(doctor), 30000);
    return () => clearInterval(interval);
  }, [doctor?.id]);

  const openNotifs = async () => {
    setNotifOpen(o => !o);
    setProfileOpen(false);
    if (!notifOpen && doctor && unreadCount > 0) {
      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAll: true, targetId: doctor.id, targetRole: "doctor" }),
        });
        setUnreadCount(0);
        setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
      } catch { /* silent */ }
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current    && !wrapRef.current.contains(e.target as Node))    setOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setResults(empty); setLoading(false); return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const scope = doctor?.role === "admin" ? "admin" : "doctor";
        const url   = `/api/search?q=${encodeURIComponent(query)}&scope=${scope}&doctorId=${doctor?.id ?? ""}`;
        const res   = await fetch(url);
        const data  = await res.json();
        if (res.ok) setResults(data); else setResults(empty);
      } catch {
        setResults(empty);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doctor]);

  const flat = [
    ...results.doctors.map(r  => ({ kind: "doctor"   as const, item: r })),
    ...results.patients.map(r => ({ kind: "patient"  as const, item: r })),
    ...results.reports.map(r  => ({ kind: "report"   as const, item: r })),
    ...results.analyses.map(r => ({ kind: "analysis" as const, item: r })),
    ...results.visits.map(r   => ({ kind: "visit"    as const, item: r })),
  ];

  const navigate = (kind: typeof flat[number]["kind"], item: any) => {
    setOpen(false); setQuery("");
    const isAdmin = doctor?.role === "admin";
    if (kind === "doctor")        router.push(`/admin/doctors/${item.id}`);
    else if (kind === "patient")  router.push(isAdmin ? `/admin/doctors/${item.doctorId}` : `/patient?patientId=${item.id}`);
    else if (kind === "report")   router.push(isAdmin ? `/admin?tab=reports` : `/reports?patientId=${item.patientId}&reportId=${item.id}`);
    else if (kind === "analysis") router.push(isAdmin ? `/admin?tab=analyses` : `/reports?patientId=${item.patientId}`);
    else if (kind === "visit")    router.push(isAdmin ? `/admin?tab=patients` : `/patient?patientId=${item.patientId}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      const sel = flat[focusIdx >= 0 ? focusIdx : 0];
      if (sel) navigate(sel.kind, sel.item);
    }
  };

  const initials = doctor
    ? `${doctor.firstName?.[0] ?? ""}${doctor.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  const totalResults = flat.length;
  const showDropdown = open && query.trim().length >= 2;
  const isAdmin = doctor?.role === "admin";

  const Row = ({ idx, kind, primary, secondary, badge, onClick }: {
    idx: number; kind: string; primary: React.ReactNode;
    secondary?: React.ReactNode; badge?: React.ReactNode; onClick: () => void;
  }) => {
    const focused = focusIdx === idx;
    const kindIcon: Record<string, React.ReactNode> = {
      doctor:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      patient:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
      report:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
      analysis: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
      visit:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    };
    const kindColor: Record<string, string> = {
      doctor: "#3b82f6", patient: "#22c55e", report: "#a855f7", analysis: "#1D4ED8", visit: "#f97316",
    };
    return (
      <button onMouseEnter={() => setFocusIdx(idx)} onMouseDown={e => { e.preventDefault(); onClick(); }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", background: focused ? "#eff6ff" : "transparent", borderLeft: focused ? "2px solid #3b82f6" : "2px solid transparent" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `${kindColor[kind as string]}15`, color: kindColor[kind as string], display: "flex", alignItems: "center", justifyContent: "center" }}>
          {kindIcon[kind]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#0a0f1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{primary}</p>
          {secondary && <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{secondary}</p>}
        </div>
        {badge}
      </button>
    );
  };

  const Section = ({ title: sTitle, children, count }: { title: string; children: React.ReactNode; count: number }) =>
    count === 0 ? null : (
      <div>
        <p style={{ margin: 0, padding: "10px 12px 4px", fontSize: 9.5, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.4, textTransform: "uppercase" }}>
          {sTitle} <span style={{ color: "#cbd5e1" }}>· {count}</span>
        </p>
        {children}
      </div>
    );

  let idx = 0;

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        height: 60,
        background: "#ffffff",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        flexShrink: 0,
      }}>

        {/* ── LEFT: page title ── */}
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: -0.4 }}>
          {title}
        </h1>

        {/* ── RIGHT: search + profile ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

          {/* Guest badge — replaces all topbar right controls */}
          {isGuest && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => router.push("/auth")}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 2px 10px rgba(37,99,235,0.3)",
                }}
              >
                Create Account
              </button>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 12px 5px 5px",
                borderRadius: 12,
                border: "1.5px solid rgba(15,23,42,0.12)",
                background: "#f8fafc",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.4)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>Guest</p>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#64748b" }}>Trial Mode</p>
                </div>
              </div>
            </div>
          )}

          {/* Search — hidden for patients and guests */}
          {!isGuest && doctor?.role !== "patient" && <div ref={wrapRef} style={{ position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: open ? "#fff" : "#f8fafc",
              border: `1.5px solid ${open ? "#3b82f6" : "rgba(0,0,0,0.07)"}`,
              borderRadius: 10, padding: "7px 12px", width: 260,
              transition: "all 0.15s",
              boxShadow: open ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
            }}>
              <Ico d={I.search} s={14} c={open ? "#3b82f6" : "#94A3B8"} />
              <input ref={inputRef} value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); setFocusIdx(-1); }}
                onFocus={() => setOpen(true)} onKeyDown={onKey}
                placeholder={isAdmin ? "Search doctors, patients…" : "Search patients, reports…"}
                style={{ border: "none", background: "transparent", fontSize: 12.5, outline: "none", width: "100%", color: "#1e293b", fontFamily: "inherit" }}
              />
              {query && (
                <button onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8", fontSize: 16, lineHeight: 1, display: "flex" }}>×</button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 460, maxHeight: 480, overflowY: "auto", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, boxShadow: "0 18px 50px rgba(10,15,30,0.12)", zIndex: 100, padding: "4px 0 8px" }}>
                {loading && (
                  <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    Searching…
                  </div>
                )}
                {!loading && totalResults === 0 && (
                  <div style={{ padding: "26px 20px", textAlign: "center", color: "#94a3b8" }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#475569" }}>No results found</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11 }}>Try a different keyword.</p>
                  </div>
                )}
                {!loading && totalResults > 0 && (
                  <>
                    <Section title="Doctors"  count={results.doctors.length}>
                      {results.doctors.map(r => { const i = idx++; return <Row key={r.id} idx={i} kind="doctor" primary={r.name} secondary={`${r.specialty || "—"} · ${r.hospital || r.email}`} onClick={() => navigate("doctor", r)} />; })}
                    </Section>
                    <Section title="Patients" count={results.patients.length}>
                      {results.patients.map(r => { const i = idx++; return <Row key={r.id} idx={i} kind="patient" primary={r.name} secondary={`${r.condition || "—"} · ${r.doctor}`} badge={<span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: "2px 7px", background: r.status === "Active" ? "#f0fdf4" : "#f3f4f6", color: r.status === "Active" ? "#15803d" : "#6b7280" }}>{r.status}</span>} onClick={() => navigate("patient", r)} />; })}
                    </Section>
                    <Section title="Reports"  count={results.reports.length}>
                      {results.reports.map(r => { const i = idx++; return <Row key={r.id} idx={i} kind="report" primary={r.title} secondary={`${r.patient} · ${r.doctor}`} badge={<span style={{ fontSize: 9.5, fontWeight: 700, color: r.status === "finalized" ? "#15803d" : "#6b7280" }}>{r.status}</span>} onClick={() => navigate("report", r)} />; })}
                    </Section>
                    <Section title="Analyses" count={results.analyses.length}>
                      {results.analyses.map(r => { const c = riskColor(r.risk); const i = idx++; return <Row key={r.id} idx={i} kind="analysis" primary={`${r.shortId} · ${r.type}`} secondary={`${r.patient} · ${r.doctor}`} badge={<span style={{ fontSize: 9.5, fontWeight: 700, borderRadius: 5, padding: "2px 7px", background: c.bg, color: c.fg }}>{r.risk} · {r.confidence}%</span>} onClick={() => navigate("analysis", r)} />; })}
                    </Section>
                    <Section title="Visits"   count={results.visits.length}>
                      {results.visits.map(r => { const i = idx++; return <Row key={r.id} idx={i} kind="visit" primary={`${r.type} · ${r.date}`} secondary={`${r.patient} · ${r.doctor}`} badge={<span style={{ fontSize: 9.5, fontWeight: 700, color: "#6b7280" }}>{r.status}</span>} onClick={() => navigate("visit", r)} />; })}
                    </Section>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid #f1f5f9", marginTop: 4, fontSize: 10, color: "#94a3b8" }}>
                      <span>↑↓ navigate · ↵ open · Esc close</span>
                      <span>{totalResults} results</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>}

          {/* Notification bell — doctor only, hidden for guests */}
          {!isGuest && doctor?.role === "doctor" && (
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={openNotifs}
                style={{
                  position: "relative", width: 38, height: 38, borderRadius: 10,
                  border: `1.5px solid ${notifOpen ? "#3b82f6" : "rgba(59,130,246,0.12)"}`,
                  background: notifOpen ? "#eff6ff" : "#f8fafc",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                  boxShadow: notifOpen ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={notifOpen ? "#3b82f6" : "#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    background: "#ef4444", color: "#fff",
                    fontSize: 9, fontWeight: 800, borderRadius: 99,
                    minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", border: "2px solid #fff",
                  }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  width: 340, maxHeight: 420, overflowY: "auto",
                  background: "#fff", border: "1px solid rgba(59,130,246,0.1)",
                  borderRadius: 14, boxShadow: "0 16px 48px rgba(15,23,42,0.13)",
                  zIndex: 200,
                }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Notifications</span>
                      {notifs.length > 0 && <span style={{ fontSize: 10, color: "#94a3b8" }}>{notifs.length} total</span>}
                    </div>
                    {notifs.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!doctor) return;
                          await fetch(`/api/admin/notifications?targetId=${doctor.id}&targetRole=doctor`, { method: "DELETE" });
                          setNotifs([]);
                          setUnreadCount(0);
                        }}
                        style={{
                          fontSize: 11, fontWeight: 600, color: "#ef4444",
                          background: "transparent", border: "none",
                          cursor: "pointer", padding: "2px 6px", borderRadius: 5,
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {notifs.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                      No notifications yet
                    </div>
                  ) : (
                    notifs.map(n => (
                      <div key={n.id} style={{
                        padding: "11px 16px", borderBottom: "1px solid #f8fafc",
                        background: n.isRead ? "transparent" : "#eff6ff",
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                          background: n.isRead ? "#e2e8f0" : "#3b82f6",
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{n.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#94a3b8" }}>
                            {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profile badge + dropdown — hidden for guests */}
          {!isGuest && <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProfileOpen(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 10px 5px 5px",
                borderRadius: 12,
                border: `1.5px solid ${profileOpen ? "#3b82f6" : "rgba(59,130,246,0.12)"}`,
                background: profileOpen ? "#eff6ff" : "#f8fafc",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: profileOpen ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: "linear-gradient(135deg, #3b82f6, #1D4ED8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, color: "#fff", fontSize: 12, letterSpacing: -0.5,
                overflow: "hidden",
              }}>
                {doctor?.avatarUrl
                  ? <img src={doctor.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials
                }
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                  {doctor ? `${doctor.firstName} ${doctor.lastName}` : "—"}
                </p>
                <p suppressHydrationWarning style={{ margin: 0, fontSize: 10, fontWeight: 600, color: isAdmin ? "#3b82f6" : doctor?.role === "patient" ? "#f59e0b" : "#0D9488" }}>
                  {isAdmin ? "Administrator" : doctor?.role === "patient" ? "Patient" : "Doctor"}
                </p>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", marginLeft: 2, flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                width: 220, background: "#fff",
                border: "1px solid rgba(59,130,246,0.1)", borderRadius: 14,
                boxShadow: "0 16px 48px rgba(15,23,42,0.13)",
                overflow: "hidden", zIndex: 200,
              }}>
                {/* Header */}
                <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, #eff6ff, #f0f4ff)", borderBottom: "1px solid rgba(59,130,246,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 11, flexShrink: 0, overflow: "hidden",
                      background: "linear-gradient(135deg, #3b82f6, #1D4ED8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, color: "#fff", fontSize: 15,
                      boxShadow: "0 3px 10px rgba(59,130,246,0.3)",
                    }}>
                      {doctor?.avatarUrl
                        ? <img src={doctor.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : initials
                      }
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {doctor ? `${doctor.firstName} ${doctor.lastName}` : "—"}
                      </p>
                      <span suppressHydrationWarning style={{
                        fontSize: 10, fontWeight: 700,
                        color: isAdmin ? "#3b82f6" : doctor?.role === "patient" ? "#d97706" : "#0D9488",
                        background: isAdmin ? "#dbeafe" : doctor?.role === "patient" ? "#fef3c7" : "#ccfbf1",
                        borderRadius: 5, padding: "1px 7px",
                        display: "inline-block", marginTop: 2,
                      }}>
                        {isAdmin ? "ADMIN" : doctor?.role === "patient" ? "PATIENT" : "DOCTOR"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                {[
                  {
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                    label: "My Account",
                    action: () => { router.push("/account"); setProfileOpen(false); },
                  },
                  {
                    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
                    label: "Settings",
                    action: () => { router.push("/settings"); setProfileOpen(false); },
                  },
                ].map(({ icon, label, action }) => (
                  <button key={label} onClick={action}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ color: "#94a3b8" }}>{icon}</span>
                    {label}
                  </button>
                ))}

                <div style={{ borderTop: "1px solid #f1f5f9", margin: "2px 0" }} />

                {/* Sign out */}
                <button
                  onClick={() => { localStorage.removeItem("doctor"); router.push("/auth"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#ef4444", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>}

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
