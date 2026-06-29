"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Ico from "@/components/ui/ico";
import { I } from "@/lib/icons";

interface UserData {
  id: string; firstName: string; lastName: string;
  email: string; phone?: string; role: string;
}

interface Appointment {
  id: string; scheduledDate: string; timeSlot: string;
  reason: string; status: string;
  doctor: { firstName: string; lastName: string; specialty: string; hospital: string };
}

interface Notification {
  id: string; title: string; message: string;
  isRead: boolean; createdAt: string; type: string;
}

const STATUS_COLOR: Record<string, { dot: string; bg: string; text: string }> = {
  pending:   { dot: "#f59e0b", bg: "#fffbeb", text: "#b45309" },
  confirmed: { dot: "#16a34a", bg: "#f0fdf4", text: "#15803d" },
  cancelled: { dot: "#ef4444", bg: "#fef2f2", text: "#dc2626" },
  completed: { dot: "#1D4ED8", bg: "#eff6ff", text: "#1d4ed8" },
};

export default function PatientPortalPage() {
  const router = useRouter();
  const [user,          setUser]          = useState<UserData | null>(null);
  const [appointments,  setAppointments]  = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (!stored) { router.push("/auth"); return; }
    const u = JSON.parse(stored) as UserData;
    if (u.role !== "patient") { router.push("/dashboard"); return; }
    setUser(u);

    Promise.all([
      fetch("/api/patient/appointments", { headers: { "x-patient-id": u.id } })
        .then(r => r.json()).then(d => setAppointments(d.appointments ?? [])),
      fetch(`/api/admin/notifications?targetId=${u.id}&targetRole=patient`)
        .then(r => r.json()).then(d => setNotifications(d.notifications ?? [])),
    ]).finally(() => setLoading(false));
  }, [router]);

  const upcoming = appointments.filter(a => a.status === "confirmed" || a.status === "pending");
  const unread   = notifications.filter(n => !n.isRead);

  const markAllRead = async () => {
    if (!user || unread.length === 0) return;
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true, targetId: user.id, targetRole: "patient" }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ padding: "28px 36px", maxWidth: 1020, margin: "0 auto", fontFamily: "inherit" }}>

      {/* ── Welcome banner ── */}
      <div style={{
        background: "linear-gradient(135deg, #1E3A8A 0%, #172554 100%)",
        borderRadius: 18, padding: "28px 32px", marginBottom: 28,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 8px 24px rgba(23,37,84,0.22)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: 120, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -40, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "relative" }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>{today}</p>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Welcome back, {user.firstName}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            {upcoming.length > 0
              ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? "s" : ""}.`
              : "No upcoming appointments — you're all clear."}
          </p>
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,0.15)",
          border: "2px solid rgba(255,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: "#fff",
        }}>
          {initials}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Appointments", value: appointments.length, ico: "cases",    accent: "#1E3A8A", light: "#eff6ff" },
          { label: "Upcoming",           value: upcoming.length,     ico: "bell",     accent: "#16a34a", light: "#f0fdf4" },
          { label: "Unread Notifications", value: unread.length,     ico: "activity", accent: "#f59e0b", light: "#fffbeb" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", borderRadius: 14, padding: "18px 20px",
            border: "1px solid rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11, flexShrink: 0,
              background: s.light,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Ico d={I[s.ico]} s={19} c={s.accent} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0a0f1e", lineHeight: 1, letterSpacing: "-0.5px" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Upcoming appointments */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 18, borderRadius: 3, background: "linear-gradient(180deg, #1E3A8A, #172554)" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#0a0f1e" }}>Upcoming Appointments</span>
            </div>
            <button onClick={() => router.push("/portal/appointments")}
              style={{ fontSize: 11, color: "#1E3A8A", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
              View all →
            </button>
          </div>

          <div style={{ padding: "10px 14px" }}>
            {upcoming.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b", fontWeight: 600 }}>No upcoming appointments</p>
                <button onClick={() => router.push("/portal/appointments")}
                  style={{ fontSize: 12, color: "#fff", background: "linear-gradient(135deg, #1E3A8A, #172554)", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                  Book an appointment
                </button>
              </div>
            ) : upcoming.slice(0, 4).map((a, i) => {
              const s = STATUS_COLOR[a.status] ?? { dot: "#94a3b8", bg: "#f1f5f9", text: "#64748b" };
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 8px",
                  borderBottom: i < Math.min(upcoming.length, 4) - 1 ? "1px solid #f8fafc" : "none",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#1E3A8A", flexShrink: 0 }}>
                    {a.doctor.firstName[0]}{a.doctor.lastName[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0a0f1e" }}>
                      Dr. {a.doctor.firstName} {a.doctor.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                      {a.scheduledDate} · {a.timeSlot}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 9px",
                    background: s.bg, color: s.text, textTransform: "capitalize", flexShrink: 0,
                  }}>{a.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 18, borderRadius: 3, background: "linear-gradient(180deg, #f59e0b, #d97706)" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#0a0f1e" }}>Notifications</span>
              {unread.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: "#ef4444", color: "#fff", borderRadius: 20, padding: "2px 7px", lineHeight: 1.4 }}>
                  {unread.length}
                </span>
              )}
            </div>
            {unread.length > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ padding: "10px 14px" }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>No notifications yet.</p>
              </div>
            ) : notifications.slice(0, 5).map((n, i) => (
              <div key={n.id} style={{
                padding: "11px 10px", borderRadius: 10,
                background: n.isRead ? "transparent" : "rgba(30,58,138,0.04)",
                borderBottom: i < Math.min(notifications.length, 5) - 1 ? "1px solid #f8fafc" : "none",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                {!n.isRead && (
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1E3A8A", flexShrink: 0, marginTop: 4 }} />
                )}
                <div style={{ flex: 1, paddingLeft: n.isRead ? 17 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: "#0a0f1e", lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
