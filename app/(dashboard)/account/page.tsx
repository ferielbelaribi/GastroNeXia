"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const Icons = {
  Edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: value === "—" ? "#cbd5e1" : "#0f172a" }}>{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (!stored) { router.push("/auth"); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  if (!user) return null;

  const isPatient = user.role === "patient";
  const isAdmin   = user.role === "admin";
  const initials  = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName  = `${isAdmin || isPatient ? "" : "Dr. "}${user.firstName} ${user.lastName}`.trim();

  const infoFields = isPatient
    ? [
        { label: "Email",     value: user.email     || "—" },
        { label: "Phone",     value: user.phone     || "—" },
        { label: "Gender",    value: user.gender    || "—" },
        { label: "Condition", value: user.condition || "—" },
      ]
    : isAdmin
    ? [
        { label: "Email", value: user.email || "—" },
        { label: "Phone", value: user.phone || "—" },
      ]
    : [
        { label: "Email",     value: user.email     || "—" },
        { label: "Phone",     value: user.phone     || "—" },
        { label: "Specialty", value: user.specialty || "—" },
        { label: "Hospital",  value: user.hospital  || "—" },
      ];

  const roleBadge = isPatient
    ? { label: "Patient",           bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" }
    : isAdmin
    ? { label: "System Administrator", bg: "#eff6ff", color: "#2563EB", border: "#bfdbfe" }
    : { label: "Doctor",            bg: "#eff6ff", color: "#2563EB", border: "#bfdbfe" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "var(--font-body)" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Hero header ── */}
      <div style={{ borderRadius: 18, overflow: "hidden", marginBottom: "1.5rem", boxShadow: "0 4px 24px rgba(37,99,235,0.13)" }}>
        <div style={{
          height: 72,
          background: "linear-gradient(120deg, #1e3a5f 0%, #2563EB 55%, #60a5fa 100%)",
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", padding: "0 1.5rem",
        }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ position: "absolute", bottom: -18, left: 60, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
          <div style={{ zIndex: 1 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-display)" }}>My Account</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>View your profile and account details.</p>
          </div>
        </div>
      </div>

      <div style={{ animation: "fadeUp .22s ease" }}>

        {/* ── Profile card ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 2px 12px rgba(15,23,42,.05)", marginBottom: "1rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem 0.85rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #2563EB, #2563EB88)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>Profile</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0.2rem 0 0" }}>Your identity on the platform.</p>
            </div>
          </div>
          <div style={{ padding: "1.1rem 1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", boxShadow: "0 2px 12px rgba(37,99,235,0.2)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff", border: "3px solid #fff", boxShadow: "0 2px 12px rgba(37,99,235,0.25)", flexShrink: 0 }}>
                {initials}
              </div>
            )}
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: -0.3 }}>{fullName}</p>
              <span style={{ fontSize: 11.5, fontWeight: 700, background: roleBadge.bg, color: roleBadge.color, border: `1px solid ${roleBadge.border}`, borderRadius: 6, padding: "3px 10px" }}>
                {roleBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Info card ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 2px 12px rgba(15,23,42,.05)", marginBottom: "1rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem 0.85rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 4, background: "linear-gradient(180deg, #2563EB, #2563EB88)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>Contact & Details</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0.2rem 0 0" }}>Your personal information.</p>
            </div>
          </div>
          <div style={{ padding: "1.1rem 1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {infoFields.map(f => <Field key={f.label} label={f.label} value={f.value} />)}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={() => router.push("/settings")}
            style={{
              width: "100%", padding: "0.75rem 1.25rem", borderRadius: 12,
              border: "1px solid #f1f5f9", background: "#fff",
              boxShadow: "0 2px 8px rgba(15,23,42,.05)",
              fontSize: 13.5, fontWeight: 700, color: "#2563EB",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 10,
              transition: "box-shadow .15s",
            }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", flexShrink: 0 }}>
              {Icons.Edit}
            </div>
            Edit Profile & Security
            <span style={{ marginLeft: "auto", color: "#94a3b8" }}>{Icons.Chevron}</span>
          </button>

          <button type="button"
            onClick={() => { localStorage.removeItem("doctor"); router.push("/auth"); }}
            style={{
              width: "100%", padding: "0.75rem 1.25rem", borderRadius: 12,
              border: "1px solid #f1f5f9", background: "#fff",
              boxShadow: "0 2px 8px rgba(15,23,42,.05)",
              fontSize: 13.5, fontWeight: 700, color: "#ef4444",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 10,
            }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0 }}>
              {Icons.Logout}
            </div>
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
