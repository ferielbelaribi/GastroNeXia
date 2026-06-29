"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOT_OPTIONS = [15, 20, 30, 45, 60];

interface DayConfig {
  dayOfWeek:   number;
  isActive:    boolean;
  startTime:   string;
  endTime:     string;
  slotMinutes: number;
}

const DEFAULT_CONFIG = (): DayConfig[] =>
  DAYS.map((_, i) => ({
    dayOfWeek:   i,
    isActive:    i >= 1 && i <= 5,   // Mon–Fri active by default
    startTime:   "08:00",
    endTime:     "17:00",
    slotMinutes: 30,
  }));

function previewSlots(cfg: DayConfig): number {
  if (!cfg.isActive) return 0;
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return Math.floor((toMins(cfg.endTime) - toMins(cfg.startTime)) / cfg.slotMinutes);
}

export default function AvailabilityPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [days,     setDays]     = useState<DayConfig[]>(DEFAULT_CONFIG());
  const [saved,    setSaved]    = useState<DayConfig[]>(DEFAULT_CONFIG());
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (!stored) { router.push("/auth"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "doctor") { router.push("/dashboard"); return; }
    setDoctorId(u.id);

    fetch(`/api/doctor/availability?doctorId=${u.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.availability?.length) {
          const loaded: DayConfig[] = DEFAULT_CONFIG();
          data.availability.forEach((a: DayConfig) => {
            loaded[a.dayOfWeek] = { ...a };
          });
          setDays(loaded);
          setSaved(loaded);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const isDirty = JSON.stringify(days) !== JSON.stringify(saved);

  const update = (i: number, patch: Partial<DayConfig>) =>
    setDays(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  const handleSave = async () => {
    if (!doctorId) return;
    setSaving(true);
    try {
      await fetch("/api/doctor/availability", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ doctorId, days }),
      });
      setSaved(days);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)",
    fontSize: 12, fontFamily: "inherit", outline: "none", background: "#f8fafc",
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: "32px 36px", maxWidth: 780, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0a0f1e", margin: 0 }}>My Availability</h1>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
          Set the days and hours patients can book appointments with you.
        </p>
      </div>

      {/* Day cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {days.map((cfg, i) => (
          <div key={i} style={{
            background: "#fff",
            border: `1px solid ${cfg.isActive ? "rgba(37,99,235,0.15)" : "rgba(0,0,0,0.06)"}`,
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16,
            opacity: cfg.isActive ? 1 : 0.55,
            transition: "all 0.15s",
          }}>

            {/* Toggle */}
            <button
              onClick={() => update(i, { isActive: !cfg.isActive })}
              style={{
                width: 44, height: 24, borderRadius: 12, border: "none",
                background: cfg.isActive ? "#2563EB" : "#e2e8f0",
                position: "relative", cursor: "pointer", flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3,
                left: cfg.isActive ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
              }} />
            </button>

            {/* Day name */}
            <div style={{ width: 100, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0a0f1e" }}>{DAYS[i]}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{DAY_SHORT[i]}</div>
            </div>

            {cfg.isActive ? (
              <>
                {/* Time range */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="time" value={cfg.startTime}
                    onChange={e => update(i, { startTime: e.target.value })}
                    style={inputStyle}
                  />
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>to</span>
                  <input
                    type="time" value={cfg.endTime}
                    onChange={e => update(i, { endTime: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Slot duration */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                  <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Slot:</span>
                  <select
                    value={cfg.slotMinutes}
                    onChange={e => update(i, { slotMinutes: Number(e.target.value) })}
                    style={{ ...inputStyle, paddingRight: 24 }}
                  >
                    {SLOT_OPTIONS.map(o => (
                      <option key={o} value={o}>{o} min</option>
                    ))}
                  </select>
                </div>

                {/* Slot count preview */}
                <div style={{
                  flexShrink: 0, minWidth: 80, textAlign: "right",
                  fontSize: 11, color: "#16a34a", fontWeight: 700,
                }}>
                  {previewSlots(cfg)} slots
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#94a3b8", marginLeft: 8 }}>Not available</div>
            )}
          </div>
        ))}
      </div>

      {/* Save button — only enabled when there are unsaved changes */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: saveOk ? "#16a34a" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "11px 28px", fontSize: 13, fontWeight: 700,
            cursor: saving || !isDirty ? "not-allowed" : "pointer",
            opacity: !isDirty && !saveOk ? 0.5 : saving ? 0.8 : 1,
            transition: "all 0.2s",
          }}
        >
          {saving ? "Saving…" : saveOk ? "✓ Saved!" : "Save Changes"}
        </button>
        {isDirty && !saving && (
          <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
            • Unsaved changes
          </span>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
