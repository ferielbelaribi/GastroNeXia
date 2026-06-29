"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  patientId: string;
  patientName: string;
  doctorId: string;
}

export default function NewAnalysisButton({ patientId, patientName, doctorId }: Props) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form,    setForm]    = useState({
    visitType: "Endoscopy",
    visitDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          doctorId,
          visitDate: form.visitDate,
          visitType: form.visitType,
          notes:     form.notes,
          status:    "Pending",
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create visit");
        return;
      }

      const data = await res.json();
      const visitId = data.visit?.id;
      if (!visitId) { setError("No visit ID returned"); return; }

      // Navigate directly to analysis with the visitId
      router.push(`/analysis?visitId=${visitId}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          padding: "0.55rem 1.1rem", borderRadius: 9, border: "none",
          background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
          color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 12px rgba(37,99,235,0.35)",
          transition: "all 0.18s", fontFamily: "inherit",
        }}
        onMouseOver={e => (e.currentTarget.style.transform = "translateY(-1px)")}
        onMouseOut={e  => (e.currentTarget.style.transform = "translateY(0)")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        New Analysis
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420,
            boxShadow: "0 32px 80px rgba(0,0,0,0.2)", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              padding: "1.25rem 1.5rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: "0 0 0.2rem",
                    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    New Analysis Visit
                  </p>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>
                    {patientName}
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "rgba(255,255,255,0.2)", border: "none",
                    borderRadius: "50%", width: 28, height: 28, cursor: "pointer",
                    color: "#fff", fontSize: 16, display: "flex", alignItems: "center",
                    justifyContent: "center", lineHeight: 1 }}
                >×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Visit Type */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                  Visit Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {["Endoscopy", "Colonoscopy", "Gastroscopy", "Follow-up"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, visitType: type }))}
                      style={{
                        padding: "0.5rem", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                        border: form.visitType === type ? "2px solid #2563EB" : "1px solid #e5e7eb",
                        background: form.visitType === type ? "#eff6ff" : "#f9fafb",
                        color: form.visitType === type ? "#2563eb" : "#374151",
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                  Date
                </label>
                <input
                  type="date"
                  value={form.visitDate}
                  onChange={e => setForm(p => ({ ...p, visitDate: e.target.value }))}
                  style={{
                    width: "100%", borderRadius: 8, border: "1px solid #e5e7eb",
                    padding: "0.55rem 0.75rem", fontSize: 13, fontFamily: "inherit",
                    boxSizing: "border-box", outline: "none",
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                  Notes <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any relevant pre-procedure notes..."
                  style={{
                    width: "100%", borderRadius: 8, border: "1px solid #e5e7eb",
                    padding: "0.55rem 0.75rem", fontSize: 13, fontFamily: "inherit",
                    resize: "none", boxSizing: "border-box", outline: "none",
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 12, color: "#ef4444", margin: 0, background: "#fef2f2",
                  border: "1px solid #fecaca", borderRadius: 7, padding: "0.5rem 0.75rem" }}>
                  {error}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.6rem", paddingTop: "0.25rem" }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    flex: 1, padding: "0.65rem", borderRadius: 9,
                    border: "1px solid #e5e7eb", background: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    color: "#374151", fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading}
                  style={{
                    flex: 2, padding: "0.65rem", borderRadius: 9, border: "none",
                    background: loading ? "#9ca3af" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: "0.5rem",
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff", borderRadius: "50%",
                        display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                      Creating…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      Start Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}