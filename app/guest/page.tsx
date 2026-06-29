"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import LogoIcon from "@/components/ui/logo-icon";

const GUEST_LIMIT = 3;
const STORAGE_KEY = "guestDetections";

function getGuestCount(): number {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10) || 0; }
  catch { return 0; }
}
function incGuestCount() {
  try { localStorage.setItem(STORAGE_KEY, String(getGuestCount() + 1)); }
  catch {}
}

// ─── SVG bounding box overlay ─────────────────────────────────────────────────
const DET_PALETTE = [
  "#06b6d4", "#f59e0b", "#8b5cf6", "#DC2626",
  "#3b82f6", "#f97316", "#10b981", "#ec4899",
];

type Detection = {
  id: number; label: string; confidence: number;
  severity: string; x: number; y: number; w: number; h: number;
};

function DetBoxes({ detections }: { detections: Detection[] }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {detections.map((d, i) => {
        const color = DET_PALETTE[i % DET_PALETTE.length];
        const lx = d.x + d.w / 2;
        const ly = d.y > 10 ? d.y - 1 : d.y + d.h + 1;
        const anchor = d.y > 10 ? "end" : "start";
        return (
          <g key={d.id}>
            <rect x={d.x} y={d.y} width={d.w} height={d.h}
              fill="none" stroke={color} strokeWidth="0.8"
              strokeDasharray={d.severity === "high" ? "none" : "2 1"} />
            <rect x={d.x} y={d.y} width={d.w} height={d.h}
              fill={color} fillOpacity="0.08" />
            <text x={lx} y={ly} textAnchor="middle"
              fontSize="3.2" fill={color} fontWeight="bold" fontFamily="monospace"
              style={{ filter: "drop-shadow(0 0 1px rgba(255,255,255,0.9))" }}>
              {d.label} {d.confidence}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Upgrade modal ────────────────────────────────────────────────────────────
function UpgradeModal({ reason, onClose, router }: {
  reason: "limit" | "segmentation";
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(10,15,30,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "2rem",
        maxWidth: 420, width: "100%",
        boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
        display: "flex", flexDirection: "column", gap: "1.25rem",
        animation: "fadeInUp 0.22s ease",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, #eff6ff, #fef2f2)",
            border: "1px solid rgba(37,99,235,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0a0f1e", margin: "0 0 0.5rem" }}>
            {reason === "limit" ? "Guest Limit Reached" : "Account Required"}
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, margin: 0 }}>
            {reason === "limit"
              ? "You've used all 3 free guest detections. Create a free account to get unlimited analyses, segmentation, reports, and full patient management."
              : "Pixel-level segmentation is a premium feature available to registered users. Create your account to unlock it — it's free."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <button
            onClick={() => router.push("/auth")}
            style={{
              padding: "0.75rem", borderRadius: 11, border: "none",
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
            }}>
            Create Free Account
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "0.65rem", borderRadius: 11,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#64748b", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            {reason === "limit" ? "Back to Welcome" : "Continue as Guest"}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, [string, string]> = {
    high:     ["#ef4444", "#fef2f2"],
    moderate: ["#f97316", "#fff7ed"],
    low:      ["#2563EB", "#eff6ff"],
    normal:   ["#2563EB", "#eff6ff"],
  };
  const [color, bg] = map[risk] ?? ["#94a3b8", "#f8fafc"];
  const label = risk === "high" ? "High Risk" : risk === "moderate" ? "Moderate" : "Normal";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "3px 10px", borderRadius: 6 }}>
      {label}
    </span>
  );
}

// ─── Main guest page ──────────────────────────────────────────────────────────
export default function GuestPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [count,       setCount]       = useState<number>(() => typeof window !== "undefined" ? getGuestCount() : 0);
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [detections,  setDetections]  = useState<Detection[]>([]);
  const [overallRisk, setOverallRisk] = useState<string | null>(null);
  const [detecting,   setDetecting]   = useState(false);
  const [error,       setError]       = useState("");
  const [upgrade,     setUpgrade]     = useState<"limit" | "segmentation" | null>(null);
  const [done,        setDone]        = useState(false);
  const [dragging,    setDragging]    = useState(false);

  const remaining = GUEST_LIMIT - count;

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    setImageUrl(URL.createObjectURL(file));
    setImageFile(file);
    setDetections([]);
    setOverallRisk(null);
    setDone(false);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDetect = async () => {
    if (!imageFile) return;
    const current = getGuestCount();
    if (current >= GUEST_LIMIT) { setUpgrade("limit"); return; }

    setDetecting(true); setError("");
    try {
      const form = new FormData();
      form.append("file", imageFile);
      const res = await fetch("/api/guest/detect", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Detection failed"); return; }

      incGuestCount();
      const newCount = getGuestCount();
      setCount(newCount);
      setDetections(data.detections ?? []);
      setOverallRisk(data.overallRisk ?? "low");
      setDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setDetecting(false);
    }
  };

  const handleReset = () => {
    setImageUrl(null); setImageFile(null);
    setDetections([]); setOverallRisk(null);
    setDone(false); setError("");
  };

  // Show limit modal immediately if already exhausted
  const showLimitOnLoad = remaining <= 0 && !done;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>

      {upgrade && (
        <UpgradeModal
          reason={upgrade}
          onClose={() => upgrade === "limit" ? router.push("/welcome") : setUpgrade(null)}
          router={router}
        />
      )}

      {showLimitOnLoad && (
        <UpgradeModal reason="limit" onClose={() => router.push("/welcome")} router={router} />
      )}

      {/* ── Top bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => router.push("/welcome")}>
          <LogoIcon size={38} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Detection counter */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: remaining <= 1 ? "#fef2f2" : "#f0f9ff",
            border: `1px solid ${remaining <= 1 ? "rgba(220,38,38,0.2)" : "rgba(37,99,235,0.15)"}`,
            borderRadius: 8, padding: "5px 12px",
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: i < count ? "#e2e8f0" : remaining <= 1 ? "#DC2626" : "#2563EB",
                transition: "background 0.3s",
              }} />
            ))}
            <span style={{ fontSize: 11, fontWeight: 700, color: remaining <= 1 ? "#DC2626" : "#2563EB", marginLeft: 4 }}>
              {remaining} left
            </span>
          </div>

          <button
            onClick={() => router.push("/auth")}
            style={{
              padding: "6px 16px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            Sign In
          </button>
        </div>
      </div>

      {/* ── Guest banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #fff 60%)",
        borderBottom: "1px solid rgba(37,99,235,0.08)",
        padding: "10px 28px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <span style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>
          Guest mode — Detection only · {remaining} of {GUEST_LIMIT} free detection{GUEST_LIMIT > 1 ? "s" : ""} remaining ·{" "}
          <span style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}
            onClick={() => router.push("/auth")}>
            Create a free account for unlimited access
          </span>
        </span>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0a0f1e", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
            AI Lesion Detection
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Upload an endoscopic image to detect GI lesions in real time.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: imageUrl ? "1fr 280px" : "1fr", gap: 16, alignItems: "start" }}>

          {/* Left — image + upload */}
          <div>
            {!imageUrl ? (
              /* Drop zone */
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#2563EB" : "#cbd5e1"}`,
                  borderRadius: 18,
                  background: dragging ? "rgba(37,99,235,0.04)" : "#fff",
                  padding: "3.5rem 2rem",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 12, cursor: "pointer", transition: "all 0.15s",
                  textAlign: "center",
                }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "linear-gradient(135deg, #eff6ff, #fef2f2)",
                  border: "1px solid rgba(37,99,235,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0a0f1e", margin: "0 0 4px" }}>
                    Drop an endoscopic image here
                  </p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                    or click to browse · JPG, PNG, WebP
                  </p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>
            ) : (
              /* Image viewer */
              <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #e2e8f0", background: "#000", position: "relative" }}>
                <div style={{ position: "relative", width: "100%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Uploaded" style={{ width: "100%", display: "block", maxHeight: 460, objectFit: "contain", background: "#111" }} />
                  {done && detections.length > 0 && <DetBoxes detections={detections} />}
                </div>

                {/* image actions bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                  background: "#0a0f1e", borderTop: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <button onClick={handleReset}
                    style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    ← New Image
                  </button>

                  {!done ? (
                    <button onClick={handleDetect} disabled={detecting || remaining <= 0}
                      style={{
                        padding: "6px 20px", borderRadius: 7, border: "none",
                        background: detecting || remaining <= 0 ? "#374151" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
                        color: "#fff", fontSize: 11, fontWeight: 700,
                        cursor: detecting || remaining <= 0 ? "not-allowed" : "pointer",
                        fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                      }}>
                      {detecting ? (
                        <>
                          <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                          Detecting…
                        </>
                      ) : "Run Detection"}
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      <span style={{ fontSize: 11, color: "#86efac", fontWeight: 600 }}>Detection complete</span>
                    </div>
                  )}

                  {/* Segmentation — always gated */}
                  <button onClick={() => setUpgrade("segmentation")}
                    style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Segmentation
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8, padding: "8px 14px", background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
                {error}
              </p>
            )}
          </div>

          {/* Right — results panel (only when done) */}
          {done && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Overall risk */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
                  Overall Risk
                </div>
                {overallRisk && <RiskBadge risk={overallRisk} />}
                <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                  {detections.length} finding{detections.length !== 1 ? "s" : ""} detected
                </div>
              </div>

              {/* Findings list */}
              {detections.length > 0 ? (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px 0", fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#94a3b8" }}>
                    Detected Lesions
                  </div>
                  <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {detections.map((d, i) => {
                      const color = DET_PALETTE[i % DET_PALETTE.length];
                      const sev = d.severity === "high" ? { c: "#ef4444", bg: "#fef2f2" }
                               : d.severity === "moderate" ? { c: "#f97316", bg: "#fff7ed" }
                               : { c: "#2563EB", bg: "#eff6ff" };
                      return (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{d.label}</div>
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.confidence}% confidence</div>
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: sev.c, background: sev.bg, padding: "2px 7px", borderRadius: 5 }}>
                            {d.severity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>No pathological findings</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Appearance within normal limits</div>
                </div>
              )}

              {/* Upsell */}
              <div style={{
                background: "linear-gradient(135deg, #eff6ff, #fef2f2)",
                border: "1px solid rgba(37,99,235,0.12)",
                borderRadius: 14, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0a0f1e", marginBottom: 6 }}>
                  Unlock full analysis
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>
                  <li>Pixel-level segmentation</li>
                  <li>Activation maps (Grad-CAM)</li>
                  <li>Automated clinical reports</li>
                  <li>Patient records & history</li>
                </ul>
                <button onClick={() => router.push("/auth")}
                  style={{
                    marginTop: 12, width: "100%", padding: "8px", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Create Free Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
