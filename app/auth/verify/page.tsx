"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const emailMasked  = searchParams.get("email") ?? "";

  const [digits,    setDigits]    = useState<string[]>(["", "", "", "", "", ""]);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleDigitChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError("");
    if (v && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") handleVerify();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter the complete 6-digit code."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/auth/verify-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Verification failed."); return; }
      localStorage.setItem("doctor", JSON.stringify(data.doctor));
      const role = data.doctor.role;
      router.push(role === "admin" ? "/admin" : role === "patient" ? "/portal" : "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true); setResent(false); setError("");
    try {
      const res = await fetch("/api/auth/send-otp", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Could not resend code.");
        return;
      }
      setResent(true);
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  const codeComplete = digits.join("").length === 6;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@500;600&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes float-orb {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33%       { transform: translateY(-18px) translateX(10px); }
          66%       { transform: translateY(10px) translateX(-8px); }
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes icon-in {
          from { opacity: 0; transform: scale(0.6) rotate(-12deg); }
          to   { opacity: 1; transform: scale(1)   rotate(0deg); }
        }
        @keyframes digit-pop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes countdown-tick {
          0%   { opacity: 1; transform: scale(1); }
          50%  { opacity: 0.7; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }

        .verify-input {
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.15s;
        }
        .verify-input:focus {
          outline: none;
          border-color: #60a5fa !important;
          background: #f0f7ff !important;
          box-shadow: 0 0 0 4px rgba(96,165,250,0.18), 0 2px 8px rgba(37,99,235,0.12) !important;
          transform: translateY(-2px) scale(1.05);
        }
        .verify-input.filled {
          animation: digit-pop 0.2s ease;
        }
        .verify-btn {
          transition: all 0.22s cubic-bezier(.4,0,.2,1);
          position: relative;
          overflow: hidden;
        }
        .verify-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
          background-size: 400px 100%;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .verify-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(37,99,235,0.45) !important;
        }
        .verify-btn:not(:disabled):hover::after {
          opacity: 1;
          animation: shimmer 1.2s infinite;
        }
        .verify-btn:not(:disabled):active {
          transform: translateY(0px);
        }
        .back-link {
          transition: color 0.15s, gap 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
        .back-link:hover {
          color: #2563EB !important;
          gap: 0.5rem;
        }
      `}</style>

      {/* ── Page background ── */}
      <div style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
        padding: "1.5rem",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>

        {/* Background floating orbs */}
        <div style={{
          position: "absolute", width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.12) 0%, transparent 70%)",
          top: "-80px", right: "-80px",
          animation: "float-orb 9s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
          bottom: "-60px", left: "-60px",
          animation: "float-orb 11s ease-in-out infinite reverse",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)",
          top: "40%", left: "10%",
          animation: "float-orb 7s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        {/* ── Card ── */}
        <div style={{
          background: "#ffffff",
          borderRadius: 24,
          boxShadow: "0 32px 80px rgba(15,23,42,0.45), 0 8px 32px rgba(37,99,235,0.15)",
          padding: "2.75rem 2.25rem 2.25rem",
          width: "min(420px, 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "1.6rem",
          animation: "card-in 0.5s cubic-bezier(.4,0,.2,1) both",
          position: "relative",
        }}>

          {/* Top accent bar */}
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%", height: 3,
            background: "linear-gradient(90deg, transparent, #2563EB, #60a5fa, #2563EB, transparent)",
            borderRadius: "0 0 4px 4px",
          }} />

          {/* ── Icon + rings ── */}
          <div style={{ position: "relative", width: 84, height: 84, animation: "icon-in 0.55s cubic-bezier(.4,0,.2,1) 0.1s both" }}>
            {/* Pulse rings */}
            <div style={{
              position: "absolute", inset: -16, borderRadius: "50%",
              border: "1.5px solid rgba(37,99,235,0.25)",
              animation: "pulse-ring 2.4s ease-out infinite",
            }} />
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: "1.5px solid rgba(37,99,235,0.35)",
              animation: "pulse-ring 2.4s ease-out 0.8s infinite",
            }} />
            {/* Icon circle */}
            <div style={{
              width: 84, height: 84, borderRadius: "50%",
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563EB 60%, #60a5fa 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
          </div>

          {/* ── Title ── */}
          <div style={{ textAlign: "center" }}>
            <h1 style={{
              fontSize: "1.45rem", fontWeight: 800, margin: 0,
              background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.03em",
            }}>
              Email Verification
            </h1>
            <p style={{ margin: "0.55rem 0 0", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6 }}>
              A 6-digit code was sent to{" "}
              <strong style={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {emailMasked}
              </strong>
            </p>
          </div>

          {/* ── OTP Boxes ── */}
          <div style={{ display: "flex", gap: "0.55rem" }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`verify-input${d ? " filled" : ""}`}
                style={{
                  width: 52, height: 64,
                  textAlign: "center",
                  fontSize: "1.75rem", fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                  border: `2px solid ${error ? "#fca5a5" : d ? "#2563EB" : "#e2e8f0"}`,
                  borderRadius: 12,
                  background: d ? "#eff6ff" : "#f8fafc",
                  color: "#1e3a5f",
                  boxShadow: d ? "0 2px 10px rgba(37,99,235,0.12)" : "none",
                }}
              />
            ))}
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "0.6rem 1rem",
              display: "flex", alignItems: "center", gap: "0.5rem", width: "100%",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626", fontWeight: 600 }}>{error}</p>
            </div>
          )}

          {/* ── Resent confirmation ── */}
          {resent && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "0.6rem 1rem",
              display: "flex", alignItems: "center", gap: "0.5rem", width: "100%",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#15803d", fontWeight: 600 }}>New code sent to your email.</p>
            </div>
          )}

          {/* ── Verify button ── */}
          <button
            type="button" onClick={handleVerify}
            disabled={loading || !codeComplete}
            className="verify-btn"
            style={{
              width: "100%", padding: "0.9rem",
              background: codeComplete
                ? "linear-gradient(135deg, #1e3a5f 0%, #2563EB 60%, #3b82f6 100%)"
                : "#f1f5f9",
              color: codeComplete ? "#fff" : "#94a3b8",
              border: "none", borderRadius: 12,
              fontSize: "0.95rem", fontWeight: 700,
              cursor: loading || !codeComplete ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: codeComplete ? "0 4px 18px rgba(37,99,235,0.35)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              letterSpacing: "0.01em",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 17, height: 17,
                  border: "2.5px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff", borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }} />
                Verifying…
              </>
            ) : (
              <>
                Verify & Sign In
                {codeComplete && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </>
            )}
          </button>

          {/* ── Resend ── */}
          <p style={{ margin: 0, fontSize: "0.84rem", color: "#94a3b8", textAlign: "center" }}>
            Didn't receive a code?{" "}
            {countdown > 0 ? (
              <span style={{
                color: "#64748b", fontWeight: 600,
                animation: "countdown-tick 1s ease infinite",
                display: "inline-block",
              }}>
                Resend in {countdown}s
              </span>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending}
                style={{
                  background: "none", border: "none",
                  background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  fontWeight: 700, cursor: resending ? "not-allowed" : "pointer",
                  fontSize: "0.84rem", fontFamily: "'DM Sans', sans-serif", padding: 0,
                  opacity: resending ? 0.6 : 1,
                } as React.CSSProperties}>
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}
          </p>

          {/* ── Divider ── */}
          <div style={{ width: "100%", height: 1, background: "#f1f5f9" }} />

          {/* ── Back ── */}
          <a href="/auth" className="back-link" style={{ fontSize: "0.82rem", color: "#94a3b8", textDecoration: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to login
          </a>
        </div>
      </div>
    </>
  );
}
