"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Ico from "@/components/ui/ico";
import { I } from "@/lib/icons";

interface UserData { id: string; firstName: string; lastName: string; role: string; }
interface Doctor   { id: string; firstName: string; lastName: string; specialty: string; hospital: string; avatarUrl?: string | null; }
interface Appointment {
  id: string; scheduledDate: string; timeSlot: string;
  reason: string; notes: string; status: string; createdAt: string;
  doctor: { firstName: string; lastName: string; specialty: string; hospital: string };
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", confirmed: "#DC2626", cancelled: "#ef4444", completed: "#1D4ED8",
};

export default function AppointmentsPage() {
  const router = useRouter();
  const [user,         setUser]         = useState<UserData | null>(null);
  const [doctors,      setDoctors]      = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  // Form state
  const [form, setForm] = useState({ doctorId: "", scheduledDate: "", timeSlot: "", reason: "", notes: "" });

  // Search / filter
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Doctor working days (Set of dayOfWeek numbers 0–6)
  const [workDays, setWorkDays] = useState<Set<number>>(new Set());

  // Slot loading
  const [slots,        setSlots]        = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [noAvailMsg,   setNoAvailMsg]   = useState("");
  const [dateError,    setDateError]    = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const maxDateStr = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (!stored) { router.push("/auth"); return; }
    const u = JSON.parse(stored) as UserData;
    if (u.role !== "patient") { router.push("/dashboard"); return; }
    setUser(u);
    Promise.all([
      fetch("/api/patient/doctors").then(r => r.json()).then(d => setDoctors(d.doctors ?? [])),
      fetch("/api/patient/appointments", { headers: { "x-patient-id": u.id } })
        .then(r => r.json()).then(d => setAppointments(d.appointments ?? [])),
    ]).finally(() => setLoading(false));
  }, [router]);

  // Fetch available slots when doctor + date are both set
  const loadSlots = useCallback(async (doctorId: string, date: string) => {
    if (!doctorId || !date) { setSlots([]); setNoAvailMsg(""); return; }
    setSlotsLoading(true);
    setSlots([]);
    setNoAvailMsg("");
    try {
      const res  = await fetch(`/api/patient/slots?doctorId=${doctorId}&date=${date}`);
      const data = await res.json();
      if (data.slots?.length) {
        setSlots(data.slots);
      } else {
        setNoAvailMsg(data.reason ?? "No available slots on this day.");
      }
    } catch {
      setNoAvailMsg("Could not load slots. Please try again.");
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const setField = (key: keyof typeof form, value: string) => {
    // When doctor changes, load their working days
    if (key === "doctorId") {
      setWorkDays(new Set());
      setDateError("");
      setSlots([]); setNoAvailMsg("");
      if (value) {
        fetch(`/api/doctor/availability?doctorId=${value}`)
          .then(r => r.json())
          .then(data => {
            const active = new Set<number>(
              (data.availability ?? [])
                .filter((a: { isActive: boolean }) => a.isActive)
                .map((a: { dayOfWeek: number }) => a.dayOfWeek)
            );
            setWorkDays(active);
          })
          .catch(() => {});
      }
    }

    if (key === "scheduledDate") {
      if (value && (value < todayStr || value > maxDateStr)) {
        setDateError(value < todayStr
          ? "You cannot book an appointment in the past."
          : "Appointments can only be booked up to 7 days in advance.");
        setForm(f => ({ ...f, scheduledDate: value, timeSlot: "" }));
        setSlots([]); setNoAvailMsg("");
        return;
      }
      // Check if the doctor works on this day of the week
      if (value && workDays.size > 0) {
        const dow = new Date(value + "T12:00:00").getDay();
        if (!workDays.has(dow)) {
          setDateError(`The doctor is not available on this day. Please choose another date.`);
          setForm(f => ({ ...f, scheduledDate: value, timeSlot: "" }));
          setSlots([]); setNoAvailMsg("");
          return;
        }
      }
      setDateError("");
    }

    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === "doctorId" || key === "scheduledDate") next.timeSlot = "";
      if (key === "doctorId" || key === "scheduledDate") {
        loadSlots(
          key === "doctorId" ? value : next.doctorId,
          key === "scheduledDate" ? value : next.scheduledDate,
        );
      }
      return next;
    });
  };

  const handleBook = async () => {
    if (!user) return;
    if (!form.doctorId || !form.scheduledDate || !form.timeSlot || !form.reason) {
      setError("Please fill in all required fields."); return;
    }
    setSubmitting(true); setError("");
    try {
      const res  = await fetch("/api/patient/appointments", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-patient-id": user.id },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setAppointments(prev => [data.appointment, ...prev]);
      setSuccess("Appointment requested! You will be notified once confirmed.");
      setShowForm(false);
      setForm({ doctorId: "", scheduledDate: "", timeSlot: "", reason: "", notes: "" });
      setSlots([]); setNoAvailMsg(""); setDateError(""); setWorkDays(new Set());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.1)", fontSize: 13,
    outline: "none", background: "#f8fafc", boxSizing: "border-box", fontFamily: "inherit",
  };

  if (loading || !user) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0a0f1e", margin: 0 }}>My Appointments</h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>Book and manage your medical appointments.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          <Ico d={I.plus} s={15} c="#fff" />
          New Appointment
        </button>
      </div>

      {success && (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#065f46", fontSize: 13, fontWeight: 600 }}>
          ✓ {success}
        </div>
      )}

      {/* Booking form */}
      {showForm && (
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: 28, marginBottom: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: "#0a0f1e" }}>Book an Appointment</h2>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#b91c1c", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

            {/* Doctor */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Doctor *</label>
              <select value={form.doctorId} onChange={e => setField("doctorId", e.target.value)} style={inputStyle}>
                <option value="">Select a doctor…</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName} — {d.specialty}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Preferred Date *</label>
              <input
                type="date" value={form.scheduledDate}
                min={todayStr}
                max={maxDateStr}
                onChange={e => setField("scheduledDate", e.target.value)}
                style={{ ...inputStyle, borderColor: dateError ? "#ef4444" : undefined }}
              />
              {dateError && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#ef4444" }}>{dateError}</p>}
            </div>
          </div>

          {/* Time Slot — smart picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
              Time Slot *
              {slotsLoading && <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Loading…</span>}
            </label>

            {!form.doctorId || !form.scheduledDate ? (
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Select a doctor and date first.</p>
            ) : slotsLoading ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ width: 90, height: 34, borderRadius: 8, background: "#f1f5f9", animation: "pulse 1.2s ease infinite" }} />
                ))}
              </div>
            ) : noAvailMsg ? (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#c2410c" }}>
                ⚠ {noAvailMsg}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {slots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, timeSlot: slot }))}
                    style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${form.timeSlot === slot ? "#2563EB" : "rgba(0,0,0,0.1)"}`,
                      background: form.timeSlot === slot ? "rgba(37,99,235,0.08)" : "#f8fafc",
                      color: form.timeSlot === slot ? "#2563EB" : "#374151",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Reason *</label>
            <input
              type="text" placeholder="e.g. Stomach pain, follow-up…"
              value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Additional Notes</label>
            <textarea
              placeholder="Any additional information…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleBook} disabled={submitting || !form.timeSlot || !!dateError}
              style={{
                background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 24px", fontSize: 13, fontWeight: 700,
                cursor: submitting || !form.timeSlot || !!dateError ? "not-allowed" : "pointer",
                opacity: submitting || !form.timeSlot || !!dateError ? 0.6 : 1,
              }}
            >
              {submitting ? "Sending…" : "Send Request"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); setSlots([]); setNoAvailMsg(""); }}
              style={{ background: "transparent", color: "#64748b", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
          </div>

          <style>{`
            @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          `}</style>
        </div>
      )}

      {/* Search + filter bar */}
      {appointments.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Text search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by doctor, hospital or reason…"
              style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.09)", fontSize: 13, outline: "none", background: "#f8fafc", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>
          {/* Status pills */}
          {(["all", "pending", "confirmed", "cancelled", "completed"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: statusFilter === s ? STATUS_COLOR[s] ?? "#3b82f6" : "#f1f5f9",
              color: statusFilter === s ? "#fff" : "#64748b",
              opacity: statusFilter === s ? 1 : 0.85,
            }}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Appointments list */}
      {(() => {
        const q = search.toLowerCase();
        const filtered = appointments.filter(a => {
          const matchStatus = statusFilter === "all" || a.status === statusFilter;
          const matchSearch = !q ||
            `${a.doctor.firstName} ${a.doctor.lastName}`.toLowerCase().includes(q) ||
            a.doctor.hospital.toLowerCase().includes(q) ||
            a.reason.toLowerCase().includes(q) ||
            a.scheduledDate.includes(q);
          return matchStatus && matchSearch;
        });
        if (appointments.length === 0 || filtered.length === 0) return (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
              {appointments.length === 0 ? "No appointments yet. Book your first one!" : "No appointments match your search."}
            </p>
          </div>
        );
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(a => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${STATUS_COLOR[a.status] ?? "#94a3b8"}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ico d={I.cases} s={20} c={STATUS_COLOR[a.status] ?? "#94a3b8"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0a0f1e" }}>
                    Dr. {a.doctor.firstName} {a.doctor.lastName}
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, marginLeft: 8 }}>{a.doctor.specialty}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{a.doctor.hospital} · {a.scheduledDate} at {a.timeSlot}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Reason: {a.reason}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "4px 10px", background: `${STATUS_COLOR[a.status] ?? "#94a3b8"}18`, color: STATUS_COLOR[a.status] ?? "#94a3b8", textTransform: "capitalize", flexShrink: 0 }}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
