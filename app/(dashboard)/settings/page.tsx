"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  User: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  Camera: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
};

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ title, desc, children, accent = "#2563EB" }: { title: string; desc?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f1f5f9", boxShadow: "0 2px 12px rgba(15,23,42,.05)", marginBottom: "1rem", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem 0.85rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 28, borderRadius: 4, background: `linear-gradient(180deg, ${accent}, ${accent}88)`, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</p>
          {desc && <p style={{ fontSize: 12, color: "#94a3b8", margin: "0.2rem 0 0" }}>{desc}</p>}
        </div>
      </div>
      <div style={{ padding: "1.1rem 1.5rem" }}>{children}</div>
    </div>
  );
}

// ─── PwInput ──────────────────────────────────────────────────────────────────
function PwInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder ?? "••••••••"}
          style={{ width: "100%", padding: "0.6rem 2.5rem 0.6rem 0.75rem", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1e293b", boxSizing: "border-box" as const, transition: "border-color .15s" }}
          onFocus={e => e.currentTarget.style.borderColor = "#2563eb"}
          onBlur={e  => e.currentTarget.style.borderColor = "#e2e8f0"}
        />
        <button type="button" onClick={() => setShow(!show)}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
          {show ? Icons.EyeOff : Icons.Eye}
        </button>
      </div>
    </div>
  );
}

// ─── TxtInput ─────────────────────────────────────────────────────────────────
function TxtInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#fff", color: "#1e293b", boxSizing: "border-box" as const, transition: "border-color .15s" }}
        onFocus={e => e.currentTarget.style.borderColor = "#2563eb"}
        onBlur={e  => e.currentTarget.style.borderColor = "#e2e8f0"}
      />
    </div>
  );
}

// ─── SaveBtn ──────────────────────────────────────────────────────────────────
function SaveBtn({ label, savedLabel, onClick, saved }: { label: string; savedLabel: string; onClick: () => void; saved: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{ marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.4rem", borderRadius: 9, border: "none", background: saved ? "#16a34a" : "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "background .2s", boxShadow: saved ? "0 2px 10px rgba(22,163,74,.3)" : "0 2px 10px rgba(37,99,235,.25)" }}>
      {saved ? <>{Icons.Check} {savedLabel}</> : label}
    </button>
  );
}

// ─── Tab: Account ─────────────────────────────────────────────────────────────
function AccountTab({ isPatient }: { isPatient: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [mounted,   setMounted]   = useState(false);
  const [initId,    setInitId]    = useState("");
  const [avatar,    setAvatar]    = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone,     setPhone]     = useState("");
  const [hospital,  setHospital]  = useState("");
  const [infoSaved, setInfoSaved] = useState(false);
  const [infoErr,   setInfoErr]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [role,      setRole]      = useState("doctor");

  const [curPw,   setCurPw]   = useState("");
  const [newPw,   setNewPw]   = useState("");
  const [confPw,  setConfPw]  = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr,   setPwErr]   = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("doctor");
      if (raw) {
        const d = JSON.parse(raw);
        setInitId(d.id         ?? "");
        setFirstName(d.firstName ?? "");
        setLastName(d.lastName   ?? "");
        setEmail(d.email         ?? "");
        setSpecialty(d.specialty ?? "");
        setPhone(d.phone         ?? "");
        setHospital(d.hospital   ?? "");
        setRole(d.role           ?? "doctor");
        // ✅ إذا عندو avatarUrl في DB يعرضه، إلا فاش يبقى null
        setAvatar(d.avatarUrl ?? null);
      }
    } catch {}
    setMounted(true);
  }, []);

  const initials = mounted
    ? (`${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || (isPatient ? "PT" : "DR"))
    : (isPatient ? "PT" : "DR");

  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 400;
        let { width, height } = img;
        if (width > height) { height = (height / width) * MAX; width = MAX; }
        else { width = (width / height) * MAX; height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });

  // ✅ handlePhoto المصحح — يرفع للـ API مباشرة
  const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initId) return;

    try {
      setAvatarUploading(true);

      // 1. عرض preview محلي فوراً
      const resized = await resizeImage(file);
      setAvatar(resized);

      // 2. تحويل base64 → Blob → FormData
      const fetchRes = await fetch(resized);
      const blob = await fetchRes.blob();
      const formData = new FormData();
      formData.append("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

      // 3. رفع للـ API
      const res = await fetch(`/api/doctors/${initId}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // 4. حفظ الـ URL الحقيقي من Supabase في localStorage
        const current = JSON.parse(localStorage.getItem("doctor") ?? "{}");
        localStorage.setItem("doctor", JSON.stringify({
          ...current,
          avatarUrl: data.avatarUrl,
        }));
        window.dispatchEvent(new Event("doctor-updated"));
        // 5. عرض الصورة من Supabase بدل base64
        setAvatar(data.avatarUrl);
      } else {
        const err = await res.json().catch(() => ({}));
        setInfoErr(err.error ?? "Failed to upload photo");
      }
    } catch {
      setInfoErr("Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      // reset input باش يقدر يرفع نفس الصورة مرة ثانية
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveInfo = async () => {
    setInfoErr(""); setSaving(true);
    try {
      if (!initId) {
        setInfoErr("No account ID found. Please log in again.");
        setSaving(false);
        return;
      }

      let res: Response;
      if (isPatient) {
        res = await fetch("/api/patient/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-patient-id": initId },
          body: JSON.stringify({ firstName, lastName, phone }),
        });
      } else {
        res = await fetch(`/api/doctors/${initId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, email, specialty, phone, hospital }),
        });
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setInfoErr(d.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      const data = await res.json();
      const current = JSON.parse(localStorage.getItem("doctor") ?? "{}");
      localStorage.setItem("doctor", JSON.stringify({
        ...current,
        firstName, lastName, phone,
        ...(!isPatient && { email, specialty, hospital }),
        ...(data.doctor ?? data.patient ?? {}),
      }));
      window.dispatchEvent(new Event("doctor-updated"));
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2500);
    } catch {
      setInfoErr("Network error — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePw = async () => {
    setPwErr("");
    if (!curPw || !newPw || !confPw) { setPwErr("All fields are required."); return; }
    if (newPw !== confPw)            { setPwErr("Passwords do not match."); return; }
    if (newPw.length < 8)           { setPwErr("Minimum 8 characters."); return; }
    try {
      if (!initId) { setPwErr("No doctor ID found."); return; }
      const res = await fetch(`/api/doctors/${initId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPwErr(d.error ?? "Failed");
        return;
      }
      setPwSaved(true); setCurPw(""); setNewPw(""); setConfPw("");
      setTimeout(() => setPwSaved(false), 2500);
    } catch { setPwErr("Network error"); }
  };

  return (
    <>
      <Card title="Profile Information" desc="Your personal details visible on reports." accent="#2563EB">
        {/* Avatar row */}
        <div style={{
          display: "flex", alignItems: "center", gap: "1.25rem",
          paddingBottom: "1.25rem", marginBottom: "1rem", borderBottom: "1px solid #f1f5f9",
          background: "linear-gradient(135deg, rgba(37,99,235,0.04), rgba(220,38,38,0.03))",
          borderRadius: 12, padding: "1rem",
        }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {avatarUploading && (
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <span style={{ width: 20, height: 20, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} />
              </div>
            )}
            {avatar ? (
              <img src={avatar} alt="avatar" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff", boxShadow: "0 2px 12px rgba(37,99,235,0.2)" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", border: "3px solid #fff", boxShadow: "0 2px 12px rgba(37,99,235,0.25)" }}>
                {initials}
              </div>
            )}
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ position: "absolute", bottom: 1, right: 1, width: 26, height: 26, borderRadius: "50%", background: "#2563EB", border: "2.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", boxShadow: "0 2px 6px rgba(37,99,235,0.35)" }}>
              {Icons.Camera}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: "0 0 2px", letterSpacing: -0.2 }}>
              {mounted && (firstName || lastName)
                ? `${role === "admin" || isPatient ? "" : "Dr. "}${firstName} ${lastName}`.trim()
                : "Your Name"}
            </p>
            {role === "admin" ? (
              <p style={{ fontSize: 11.5, color: "#2563EB", fontWeight: 700, margin: "0 0 10px", display: "inline-flex", alignItems: "center", gap: 5, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "2px 9px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                System Administrator
              </p>
            ) : isPatient ? (
              <p style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 700, margin: "0 0 10px", display: "inline-flex", alignItems: "center", gap: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 9px" }}>
                Patient
              </p>
            ) : specialty && (
              <p style={{ fontSize: 11.5, color: "#2563EB", fontWeight: 600, margin: "0 0 10px" }}>{specialty}</p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={avatarUploading}
                style={{ fontSize: 11.5, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "4px 12px", cursor: avatarUploading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {avatarUploading ? "Uploading..." : "Change Photo"}
              </button>
              {avatar && !avatarUploading && (
                <button type="button" onClick={() => setAvatar(null)}
                  style={{ fontSize: 11.5, fontWeight: 600, color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <TxtInput label="First Name" value={firstName} onChange={setFirstName} placeholder="John" />
          <TxtInput label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Smith" />
          <TxtInput label="Email"      value={email}     onChange={setEmail}     type="email" placeholder="doctor@clinic.com" />
          <TxtInput label="Phone"      value={phone}     onChange={setPhone}     placeholder="+213 XX XX XX XX" />
          {role !== "admin" && !isPatient && (
            <>
              <TxtInput label="Specialty" value={specialty} onChange={setSpecialty} placeholder="Gastroenterology" />
              <TxtInput label="Hospital"  value={hospital}  onChange={setHospital}  placeholder="Clinic Al-Hayat" />
            </>
          )}
        </div>

        {infoErr && (
          <p style={{ fontSize: 12, color: "#ef4444", margin: "0.65rem 0 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "0.4rem 0.65rem" }}>
            ⚠ {infoErr}
          </p>
        )}

        <button
          type="button" onClick={handleSaveInfo} disabled={saving}
          style={{ marginTop: "1rem", display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.4rem", borderRadius: 9, border: "none", background: infoSaved ? "#16a34a" : saving ? "#93c5fd" : "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background .2s", boxShadow: infoSaved ? "0 2px 10px rgba(22,163,74,.3)" : "0 2px 10px rgba(37,99,235,.25)" }}>
          {saving ? (
            <>
              <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} />
              Saving...
            </>
          ) : infoSaved ? (<>{Icons.Check} Saved!</>) : "Save Changes"}
        </button>
      </Card>

      <Card title="Change Password" desc="Update your login credentials." accent="#1D4ED8">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <PwInput label="Current Password" value={curPw}  onChange={setCurPw} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <PwInput label="New Password"     value={newPw}  onChange={setNewPw}  placeholder="Min 8 characters" />
            <PwInput label="Confirm Password" value={confPw} onChange={setConfPw} placeholder="Repeat new password" />
          </div>
        </div>
        {pwErr && (
          <p style={{ fontSize: 12, color: "#ef4444", margin: "0.65rem 0 0", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "0.4rem 0.65rem" }}>
            ⚠ {pwErr}
          </p>
        )}
        <SaveBtn label="Update Password" savedLabel="Password Updated!" onClick={handleChangePw} saved={pwSaved} />
      </Card>
    </>
  );
}

// ─── Tab: Danger Zone ─────────────────────────────────────────────────────────
function DangerTab({ isPatient }: { isPatient: boolean }) {
  const [confirmText, setConfirmText] = useState("");
  const [step,        setStep]        = useState<"idle" | "confirm">("idle");
  const [deleting,    setDeleting]    = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const stored = localStorage.getItem("doctor");
      const user = stored ? JSON.parse(stored) : null;
      if (user?.id) {
        const endpoint = isPatient
          ? `/api/patients/${user.id}`
          : `/api/doctors/${user.id}`;
        await fetch(endpoint, { method: "DELETE" });
        localStorage.removeItem("doctor");
      }
      window.location.href = "/welcome";
    } catch { setDeleting(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #fecaca", boxShadow: "0 1px 8px rgba(220,38,38,.08)", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", background: "#fff5f5", borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{ color: "#ef4444" }}>{Icons.Warning}</div>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#dc2626", margin: 0 }}>Danger Zone</p>
          <p style={{ fontSize: 12, color: "#991b1b", margin: "0.15rem 0 0" }}>Actions here are permanent and cannot be undone.</p>
        </div>
      </div>
      <div style={{ padding: "1.5rem" }}>
        {step === "idle" ? (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1.5rem" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 0.4rem" }}>Delete Account</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.65, maxWidth: 420 }}>
                {isPatient
                  ? <>Permanently delete your account and all your appointments and medical records. <strong style={{ color: "#dc2626" }}>This cannot be reversed.</strong></>
                  : <>Permanently delete your account and all associated data — patients, visits, analyses, and reports. <strong style={{ color: "#dc2626" }}>This cannot be reversed.</strong></>
                }
              </p>
            </div>
            <button type="button" onClick={() => setStep("confirm")}
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.1rem", borderRadius: 9, border: "1.5px solid #fca5a5", background: "#fff", color: "#dc2626", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", whiteSpace: "nowrap" as const }}
              onMouseEnter={e => { e.currentTarget.style.background = "#dc2626"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#dc2626"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fca5a5"; }}>
              {Icons.Trash} Delete My Account
            </button>
          </div>
        ) : (
          <div style={{ animation: "fadeUp .2s ease" }}>
            <p style={{ fontSize: 13.5, color: "#374151", margin: "0 0 1rem", lineHeight: 1.65 }}>
              To confirm, type{" "}
              <code style={{ color: "#dc2626", background: "#fff5f5", padding: "1px 7px", borderRadius: 5, fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>DELETE</code>
              {" "}in the field below.
            </p>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm"
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: 9, border: `1.5px solid ${confirmText === "DELETE" ? "#ef4444" : "#e2e8f0"}`, fontSize: 14, fontFamily: "monospace", outline: "none", background: "#fff", color: "#1e293b", boxSizing: "border-box" as const, marginBottom: "1rem", transition: "border-color .15s" }} />
            <div style={{ display: "flex", gap: "0.65rem" }}>
              <button type="button" onClick={() => { setStep("idle"); setConfirmText(""); }}
                style={{ padding: "0.6rem 1.25rem", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#374151" }}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={confirmText !== "DELETE" || deleting}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.4rem", borderRadius: 9, border: "none", background: confirmText === "DELETE" ? "#dc2626" : "#f1f5f9", color: confirmText === "DELETE" ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 700, cursor: confirmText === "DELETE" && !deleting ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all .15s" }}>
                {deleting
                  ? <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} />
                  : Icons.Trash}
                {deleting ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Nav + Main ───────────────────────────────────────────────────────────────
type TabId = "account" | "danger";

const NAV: { id: TabId; label: string; icon: React.ReactNode; danger?: boolean }[] = [
  { id: "account", label: "Account",     icon: Icons.User  },
  { id: "danger",  label: "Danger Zone", icon: Icons.Trash, danger: true },
];

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>("account");
  const [isPatient, setIsPatient] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("doctor");
    if (stored) setIsPatient(JSON.parse(stored)?.role === "patient");
  }, []);

  const nav = NAV;

  const content: Record<TabId, React.ReactNode> = {
    account: <AccountTab isPatient={isPatient} />,
    danger:  <DangerTab  isPatient={isPatient} />,
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "var(--font-body)" }}>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Hero header */}
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
            <h1 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-display)" }}>Settings</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>Manage your account, display preferences, and security.</p>
          </div>
        </div>

        {/* Tab bar — attached to banner bottom */}
        <div style={{ display: "flex", background: "#fff", borderTop: "1px solid #f1f5f9" }}>
          {nav.map(item => (
            <button key={item.id} type="button" onClick={() => setActive(item.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem",
                padding: "0.7rem 0.75rem", border: "none",
                background: "transparent",
                borderBottom: `2.5px solid ${active === item.id ? (item.danger ? "#dc2626" : "#2563EB") : "transparent"}`,
                color: active === item.id ? (item.danger ? "#dc2626" : "#2563EB") : (item.danger ? "#ef4444" : "#64748b"),
                fontSize: 13, fontWeight: active === item.id ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              }}>
              <span style={{ color: active === item.id ? (item.danger ? "#dc2626" : "#2563EB") : (item.danger ? "#ef4444" : "#94a3b8") }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ animation: "fadeUp .22s ease" }} key={active}>
        {content[active]}
      </div>
    </div>
  );
}