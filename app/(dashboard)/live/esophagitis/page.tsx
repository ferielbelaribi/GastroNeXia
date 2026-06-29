"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EsoSegment {
  id:         number;
  label:      string;
  severity:   string;
  location:   string;
  area_pct:   number;
  confidence: number;
  color:      string;
  bbox:       { x: number; y: number; w: number; h: number };
}

interface EsoResult {
  segments:      EsoSegment[];
  totalDetected: number;
  overallRisk:   string;
  overlayBase64: string;
  modelVersion:  string;
  threshold:     number;
  ttaUsed:       boolean;
}

interface StoredData {
  fileBase64: string;
  fileName:   string;
  fileType:   string;
  visitId:    string | null;
}

// ─── Analysis steps (clinical language) ──────────────────────────────────────
const ESO_STEPS = [
  "Preparing examination data",
  "Transmitting image to analysis server",
  "Identifying esophagitis lesions",
  "Mapping lesion boundaries",
  "Generating clinical report",
];

// ─── Severity helpers ─────────────────────────────────────────────────────────
function riskStyle(risk: string) {
  switch (risk) {
    case "critical": return { dot: "#ef4444", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", label: "Critical — Urgent Review Required" };
    case "high":     return { dot: "#ef4444", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca", label: "High Risk — Specialist Review Advised" };
    case "medium":   return { dot: "#f59e0b", color: "#b45309", bg: "#fffbeb", border: "#fde68a", label: "Moderate Findings" };
    case "low":      return { dot: "#2563EB", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", label: "Mild / Incidental Findings" };
    default:         return { dot: "#94a3b8", color: "#475569", bg: "#f8fafc", border: "#e2e8f0", label: "Within Normal Limits" };
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EsophagitisPage() {
  const router = useRouter();

  const [phase,      setPhase]      = useState<"loading" | "running" | "done" | "error" | "nodata">("loading");
  const [stepIndex,  setStepIndex]  = useState(0);
  const [progress,   setProgress]   = useState(0);
  const [result,     setResult]     = useState<EsoResult | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [storedData, setStoredData] = useState<StoredData | null>(null);
  const [error,      setError]      = useState("");
  const [showOrig,   setShowOrig]   = useState(false);
  const [activeId,   setActiveId]   = useState<number | null>(null);

  const ranRef = useRef(false);

  // ── On mount: read sessionStorage → kick off analysis ─────────────────────
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const raw = sessionStorage.getItem("esoAnalysis");
    sessionStorage.removeItem("esoAnalysis");

    if (!raw) { setPhase("nodata"); return; }

    let data: StoredData;
    try { data = JSON.parse(raw); } catch { setPhase("nodata"); return; }

    setStoredData(data);
    setPreview(data.fileBase64);
    setPhase("running");
    runAnalysis(data);
  }, []);

  const runAnalysis = async (data: StoredData) => {
    setProgress(0); setStepIndex(0);
    const pi = setInterval(() => setProgress(p => p >= 88 ? 88 : p + Math.random() * 7), 400);

    try {
      setStepIndex(0);
      const blob = await fetch(data.fileBase64).then(r => r.blob());
      const file = new File([blob], data.fileName, { type: data.fileType });

      setStepIndex(1);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/segment-esophagitis", { method: "POST", body: fd });

      setStepIndex(2);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error ?? "Esophagitis examination could not be completed");
      }

      setStepIndex(3);
      const esoData: EsoResult = await res.json();

      setStepIndex(4);
      clearInterval(pi);
      setProgress(100);

      setResult(esoData);
      setPhase("done");
    } catch (e: any) {
      clearInterval(pi);
      setError(e.message ?? "An unexpected error occurred");
      setPhase("error");
    }
  };

  // ─── Shared style tokens ───────────────────────────────────────────────────
  const font = "var(--font-body, 'Outfit', 'Segoe UI', sans-serif)";

  const page: React.CSSProperties = {
    minHeight: "100%",
    background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)",
    fontFamily: font,
  };

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    boxShadow: "var(--card-shadow, 0 4px 24px rgba(0,0,0,0.07))",
    padding: "1.25rem",
    marginBottom: "1rem",
    fontFamily: font,
  };

  // ─── Back button ───────────────────────────────────────────────────────────
  const BackBtn = () => (
    <button
      type="button"
      onClick={() => router.back()}
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem",
        padding: "0.45rem 0.9rem", borderRadius: 8,
        border: "1px solid #e2e8f0", background: "#fff",
        color: "#374151", fontSize: 12, fontWeight: 600,
        cursor: "pointer", fontFamily: font,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Back to Analysis
    </button>
  );

  // ─── Page header ───────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
      <BackBtn />
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "linear-gradient(135deg, #a855f7, #0D9488)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(168,85,247,0.35)", flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "#1e3a5f", margin: 0, fontFamily: "var(--font-display, 'Sora', sans-serif)", letterSpacing: "-0.02em" }}>
            Esophagitis Examination
          </h1>
          <p style={{ fontSize: 11, color: "#DC2626", margin: 0, fontWeight: 500 }}>
            Esophagitis Analysis · Complementary Examination
          </p>
        </div>
      </div>
      <span style={{
        marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
        background: "#ede9fe", color: "#DC2626", border: "1px solid #c4b5fd",
        borderRadius: 20, padding: "3px 12px", fontFamily: font,
      }}>
        OPTIONAL · COMPLEMENTARY
      </span>
    </div>
  );

  // ─── No data ───────────────────────────────────────────────────────────────
  if (phase === "nodata") return (
    <div style={page}>
      <div style={{ padding: "1.5rem" }}>
        <Header />
        <div style={{ ...card, textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#fef3c7", border: "2px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: "0 0 0.5rem", fontFamily: "var(--font-display, 'Sora', sans-serif)" }}>
            No Examination Data Found
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            This page is accessed from the Live Monitoring screen when esophagitis findings are identified. Please return to the monitoring session.
          </p>
          <button
            type="button" onClick={() => router.back()}
            style={{ padding: "0.65rem 1.5rem", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #a855f7, #0D9488)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}
          >
            Return to Analysis
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Running ───────────────────────────────────────────────────────────────
  if (phase === "running" || phase === "loading") return (
    <div style={page}>
      <div style={{ padding: "1.5rem" }}>
        <Header />
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{
            position: "relative", background: "#0a0f1e",
            minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {preview && (
              <img src={preview} alt="Analysing" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }} />
            )}

            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", padding: "2.5rem 2rem" }}>
              {/* Spinner */}
              <div style={{ position: "relative", width: 58, height: 58 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.15)", borderTopColor: "#a855f7", animation: "spin 0.9s linear infinite" }} />
                <div style={{ position: "absolute", inset: 7, borderRadius: "50%", border: "2px solid rgba(192,132,252,0.2)", borderBottomColor: "#c084fc", animation: "spin 1.4s linear infinite reverse" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
              </div>

              {/* Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%", maxWidth: 300 }}>
                {ESO_STEPS.map((step, idx) => {
                  const done    = idx < stepIndex;
                  const active  = idx === stepIndex;
                  const pending = idx > stepIndex;
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.6rem", opacity: pending ? 0.3 : 1, transition: "opacity 0.3s" }}>
                      {done ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : active ? (
                        <div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: active ? 700 : done ? 500 : 400,
                        color: done ? "#4ade80" : active ? "#e2e8f0" : "#94a3b8",
                        fontFamily: font,
                      }}>
                        {step}
                      </span>
                      {active && (
                        <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                          {[0,1,2].map(i => (
                            <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#a855f7", animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div style={{ width: "100%", maxWidth: 300, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99 }}>
                <div style={{ width: `${Math.min(progress, 100)}%`, height: "100%", background: "linear-gradient(90deg, #a855f7, #c084fc)", borderRadius: 99, transition: "width 0.4s" }} />
              </div>

              <p style={{ fontSize: 11, color: "#64748b", margin: 0, textAlign: "center", fontFamily: font, lineHeight: 1.6 }}>
                Analysing esophagitis lesions.<br/>This may take up to 90 seconds.
              </p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:0.2} 50%{opacity:1} }
      `}</style>
    </div>
  );

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error") return (
    <div style={page}>
      <div style={{ padding: "1.5rem" }}>
        <Header />
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fef2f2", border: "2px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: "0 0 0.4rem", fontFamily: "var(--font-display, 'Sora', sans-serif)" }}>
            Examination Could Not Be Completed
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 1.5rem", lineHeight: 1.6, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
            {error}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            {storedData && (
              <button type="button" onClick={() => { setPhase("running"); setError(""); runAnalysis(storedData); }}
                style={{ padding: "0.65rem 1.25rem", borderRadius: 9, border: "none", background: "linear-gradient(135deg, #a855f7, #0D9488)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
                Retry Examination
              </button>
            )}
            <button type="button" onClick={() => router.back()}
              style={{ padding: "0.65rem 1.25rem", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
              Return to Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Results ───────────────────────────────────────────────────────────────
  if (!result) return null;

  const risk    = riskStyle(result.overallRisk);
  const hasSegs = result.segments.length > 0;
  const totalArea = result.segments.reduce((s, seg) => s + seg.area_pct, 0);

  return (
    <div style={page}>
      <div style={{ padding: "1.5rem" }}>
        <style>{`
          @keyframes spin    { to { transform: rotate(360deg); } }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        <Header />

        {/* ── Overall risk banner ──────────────────────────────────────────── */}
        <div style={{
          ...card,
          background: risk.bg, border: `1px solid ${risk.border}`,
          display: "flex", alignItems: "center", gap: "0.85rem",
          animation: "fadeUp 0.4s ease both",
        }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: risk.dot, flexShrink: 0, boxShadow: `0 0 8px ${risk.dot}` }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: risk.color, margin: 0, fontFamily: "var(--font-display, 'Sora', sans-serif)" }}>
              {risk.label}
            </p>
            <p style={{ fontSize: 12, color: risk.color, margin: "0.15rem 0 0", opacity: 0.8 }}>
              {hasSegs
                ? `${result.totalDetected} esophagitis lesion${result.totalDetected !== 1 ? "s" : ""} identified · Total affected area: ~${totalArea.toFixed(1)}% of field`
                : "No esophagitis lesion regions identified at current examination sensitivity"}
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 10, color: risk.color, margin: 0, opacity: 0.65 }}>Esophagitis Lesion Analysis</p>
            <p style={{ fontSize: 10, color: risk.color, margin: "0.1rem 0 0", opacity: 0.5 }}>
              Detection sensitivity: {Math.round((result.threshold ?? 0.4) * 100)}%
            </p>
          </div>
        </div>


        {/* ── Image / overlay ──────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: "hidden", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>Esophagitis Lesion Map</p>
              {hasSegs && <p style={{ fontSize: 10, color: "#9ca3af", margin: "0.1rem 0 0" }}>Colour-coded regions indicate detected esophagitis lesions</p>}
            </div>
            {hasSegs && (
              <button type="button" onClick={() => setShowOrig(v => !v)}
                style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 6, padding: "4px 11px", cursor: "pointer", fontFamily: font }}>
                {showOrig ? "Show Lesion Map" : "Show Original Image"}
              </button>
            )}
          </div>

          <div style={{ position: "relative", background: "#0a0f1e" }}>
            <img
              src={!showOrig && hasSegs && result.overlayBase64 ? result.overlayBase64 : (preview ?? "")}
              alt="Esophagitis lesion map"
              style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", display: "block", transition: "opacity 0.25s" }}
            />
            {/* corner badge */}
            <div style={{ position: "absolute", top: "0.6rem", right: "0.6rem", background: hasSegs && !showOrig ? "rgba(168,85,247,0.9)" : "rgba(71,85,105,0.85)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4, fontFamily: font }}>
              {showOrig ? "Original Image" : hasSegs ? "Lesion Map" : "No Lesions Found"}
            </div>

            {!hasSegs && (
              <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", background: "rgba(37,99,235,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4, fontFamily: font }}>
                Examination: Normal
              </div>
            )}
          </div>

          {/* Legend strip — sits BELOW the image so it never covers bounding boxes */}
          {hasSegs && !showOrig && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", padding: "0.55rem 0.85rem", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {result.segments.map(seg => (
                <span key={seg.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "3px 9px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#cbd5e1", fontFamily: font }}>Lesion {seg.id}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Lesion details ───────────────────────────────────────────────── */}
        {hasSegs && (
          <div style={{ ...card, animation: "fadeUp 0.55s ease both" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.9rem" }}>
              Esophagitis Lesions ({result.totalDetected})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {result.segments.map(seg => {
                const isActive = activeId === seg.id;
                const sev = seg.severity === "high" ? "High-grade esophagitis" : seg.severity === "low" ? "Low-grade esophagitis" : "Moderate esophagitis";
                return (
                  <div
                    key={seg.id}
                    onClick={() => setActiveId(isActive ? null : seg.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 0.9rem", borderRadius: 10,
                      border: `1px solid ${isActive ? seg.color + "66" : "#f1f5f9"}`,
                      background: isActive ? seg.color + "0c" : "#fafafa",
                      cursor: "pointer", transition: "all 0.2s",
                      boxShadow: isActive ? `0 0 0 2px ${seg.color}22` : "none",
                    }}
                  >
                    <div style={{ width: 11, height: 11, borderRadius: "50%", background: seg.color, flexShrink: 0, boxShadow: `0 0 6px ${seg.color}99` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
                        Region {seg.id} — {sev}
                      </p>
                      <p style={{ fontSize: 11, color: "#6b7280", margin: "0.15rem 0 0" }}>
                        Affected area: {seg.area_pct.toFixed(1)}% of endoscopic field
                      </p>
                    </div>
                    <div style={{ width: 88, flexShrink: 0 }}>
                      <p style={{ fontSize: 9, color: "#9ca3af", margin: "0 0 0.2rem", textAlign: "right" }}>Detection certainty</p>
                      <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${seg.confidence}%`, height: "100%", background: seg.color, borderRadius: 99, transition: "width 0.5s ease" }} />
                      </div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: seg.color, margin: "0.2rem 0 0", textAlign: "right" }}>{seg.confidence.toFixed(0)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Clinical summary ─────────────────────────────────────────────── */}
        <div style={{ ...card, animation: "fadeUp 0.6s ease both" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.9rem" }}>
            Clinical Summary
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>

            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "0.8rem 1rem", borderLeft: `3px solid ${risk.dot}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: "0 0 0.3rem" }}>Endoscopic Findings</p>
              <p style={{ fontSize: 13, color: "#1e3a5f", margin: 0, lineHeight: 1.65 }}>
                {hasSegs
                  ? `${result.totalDetected} esophagitis lesion${result.totalDetected !== 1 ? "s" : ""} identified. Total affected area: ~${totalArea.toFixed(1)}% of the endoscopic field. Individual lesion size ranges from ${Math.min(...result.segments.map(s => s.area_pct)).toFixed(1)}% to ${Math.max(...result.segments.map(s => s.area_pct)).toFixed(1)}%.`
                  : "No esophagitis lesions detected at the current sensitivity level. Findings may be within normal limits."}
              </p>
            </div>


          </div>
        </div>

        {/* ── Bottom actions ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap", paddingBottom: "1rem" }}>
          <button type="button" onClick={() => router.back()}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.7rem 1.4rem", borderRadius: 10,
              border: "1px solid #e2e8f0", background: "#fff",
              color: "#374151", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: font,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Return to Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
