"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LogoIcon from "@/components/ui/logo-icon";

export default function AuthPage() {
  const router = useRouter();
  const [tab,        setTab]        = useState<"login" | "register">("login");
  const [registerAs, setRegisterAs] = useState<"doctor" | "patient">("doctor");
  const [show,       setShow]       = useState(false);

  // Login
  const [loginForm,    setLoginForm]    = useState({ email: "", password: "" });
  const [rememberMe,   setRememberMe]   = useState(false);
  const [loginError,   setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("rememberedEmail");
    if (saved) {
      setRememberMe(true);
      setLoginForm(f => ({ ...f, email: saved }));
    }
  }, []);

  // Doctor register
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirm: "",
    hospital: "", specialty: "Gastroenterology", phone: "",
  });
  const [registerError,   setRegisterError]   = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [emailWarning,    setEmailWarning]    = useState("");

  // Patient register
  const [patForm, setPatForm] = useState({
    firstName: "", lastName: "", email: "", password: "", confirm: "",
    phone: "", dateOfBirth: "", gender: "",
  });
  const [patError,   setPatError]   = useState("");
  const [patLoading, setPatLoading] = useState(false);

  // ── Email typo detection ─────────────────────────────────────────────────
  const COMMON_TYPOS: Record<string, string> = {
    "gemail.com": "gmail.com", "gmial.com": "gmail.com", "gmaill.com": "gmail.com",
    "gmal.com": "gmail.com",   "gmail.co":  "gmail.com", "gmail.cm":   "gmail.com",
    "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com",
    "yahooo.com": "yahoo.com",   "yaho.com":    "yahoo.com",  "yahoo.co":   "yahoo.com",
    "outlok.com": "outlook.com", "outook.com":  "outlook.com",
  };

  const checkEmailTypo = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (!domain) { setEmailWarning(""); return; }
    const suggestion = COMMON_TYPOS[domain];
    if (suggestion) {
      setEmailWarning(`Did you mean ${email.split("@")[0]}@${suggestion}?`);
    } else {
      setEmailWarning("");
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setLoginError("Please fill in all fields");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error); return; }

      if (data.requires2FA) {
        const params = new URLSearchParams();
        if (data.sentTo?.email) params.set("email", data.sentTo.email);
        router.push(`/auth/verify?${params.toString()}`);
        return;
      }
      // Remember me
      if (rememberMe) localStorage.setItem("rememberedEmail", loginForm.email);
      else localStorage.removeItem("rememberedEmail");
      // Trusted device — direct login (no OTP)
      localStorage.setItem("doctor", JSON.stringify(data.doctor));
      const role = data.doctor.role;
      router.push(role === "admin" ? "/admin" : role === "patient" ? "/portal" : "/dashboard");
    } catch {
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (form.password !== form.confirm) { setRegisterError("Passwords do not match"); return; }
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.hospital || !form.phone) {
      setRegisterError("Please fill in all fields"); return;
    }
    setRegisterLoading(true);
    setRegisterError("");
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setRegisterError(data.error); return; }

      // After registration → verify email OTP
      if (data.requiresVerification) {
        const params = new URLSearchParams();
        if (data.sentTo?.email) params.set("email", data.sentTo.email);
        router.push(`/auth/verify?${params.toString()}`);
        return;
      }
      setLoginForm({ email: form.email, password: "" });
      setTab("login");
    } catch {
      setRegisterError("Something went wrong. Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ── Patient Register ─────────────────────────────────────────────────────
  const handlePatientRegister = async () => {
    if (patForm.password !== patForm.confirm) { setPatError("Passwords do not match"); return; }
    if (!patForm.firstName || !patForm.lastName || !patForm.email || !patForm.password || !patForm.phone) {
      setPatError("Please fill in all required fields"); return;
    }
    setPatLoading(true);
    setPatError("");
    try {
      const res  = await fetch("/api/auth/register-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patForm),
      });
      const data = await res.json();
      if (!res.ok) { setPatError(data.error); return; }

      if (data.requiresVerification) {
        const params = new URLSearchParams();
        if (data.sentTo?.email) params.set("email", data.sentTo.email);
        router.push(`/auth/verify?${params.toString()}`);
        return;
      }
    } catch {
      setPatError("Something went wrong. Please try again.");
    } finally {
      setPatLoading(false);
    }
  };

  return (
    <div className="auth-root">

      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <Link href="/welcome" className="auth-logo">
            <LogoIcon size={78} />
          </Link>
          <h2 className="auth-tagline">Clinical AI<br />for <em>GI Endoscopy.</em></h2>
          <p className="auth-desc">
            An AI diagnostic support system built for gastroenterologists.
            Detect, classify and report lesions in real time.
          </p>
          <div className="auth-features">
            {[
              "Polyp detection on live video & endoscopic images",
              "AI mucosal segmentation with lesion measurement",
              "Auto-generated clinical endoscopy PDF reports",
            ].map(f => (
              <div key={f} className="af-item">
                <span className="af-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="auth-copy">© 2026 GastroNeXia · Clinical AI Platform</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-card-wrap">
          <div className="auth-card">

            <div className="auth-card-logo">
              <LogoIcon size={75} />
            </div>

            <div className="tabs">
              {(["login", "register"] as const).map(t => (
                <button key={t} className={`tab${tab === t ? " active" : ""}`}
                  onClick={() => setTab(t)} type="button">
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            {/* ── LOGIN ── */}
            {tab === "login" && (
              <div className="field-group" key="login">
                <div className="field">
                  <label>Email / Username</label>
                  <input
                    type="email" placeholder="doctor@hospital.com"
                    value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <div className="pw-wrap">
                    <input
                      type={show ? "text" : "password"} placeholder="••••••••"
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                    />
                    <button className="pw-eye" onClick={() => setShow(s => !s)}
                      type="button" aria-label={show ? "Hide" : "Show"}>
                      {show ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                <div className="flex-row">
                  <label className="remember">
                    <span className="custom-checkbox">
                      <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                      <span className="checkmark">
                        <svg viewBox="0 0 10 8" fill="none" width="10" height="8">
                          <path d="M1 4l3 3 5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </span>
                    <span className="remember-label">{"  "}Remember me</span>
                  </label>
                </div>

                {loginError && <p className="auth-error">{loginError}</p>}

                <button className="btn-submit" onClick={handleLogin}
                  disabled={loginLoading} type="button">
                  {loginLoading ? "Signing in..." : "Sign In to Platform"}
                </button>
              </div>
            )}

            {/* ── REGISTER ── */}
            {tab === "register" && (
              <div className="field-group" key="register">

                {/* Doctor / Patient toggle */}
                <div style={{
                  display: "flex", background: "rgba(0,0,0,0.04)",
                  borderRadius: 10, padding: 3, marginBottom: 16,
                }}>
                  {(["doctor", "patient"] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => { setRegisterAs(role); setRegisterError(""); setPatError(""); }}
                      style={{
                        flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: registerAs === role ? "#fff" : "transparent",
                        color: registerAs === role ? "#2563EB" : "#64748b",
                        boxShadow: registerAs === role ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {role === "doctor" ? "👨‍⚕️ I'm a Doctor" : "🧑 I'm a Patient"}
                    </button>
                  ))}
                </div>

                {/* ── PATIENT FORM ── */}
                {registerAs === "patient" && <>
                  <div className="field-row">
                    <div className="field">
                      <label>First Name</label>
                      <input placeholder="First name" value={patForm.firstName}
                        onChange={e => setPatForm({ ...patForm, firstName: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Last Name</label>
                      <input placeholder="Last name" value={patForm.lastName}
                        onChange={e => setPatForm({ ...patForm, lastName: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" placeholder="your@email.com" value={patForm.email}
                      onChange={e => setPatForm({ ...patForm, email: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Password</label>
                      <input type="password" placeholder="••••••••" value={patForm.password}
                        onChange={e => setPatForm({ ...patForm, password: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Confirm</label>
                      <input type="password" placeholder="••••••••" value={patForm.confirm}
                        onChange={e => setPatForm({ ...patForm, confirm: e.target.value })} />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Phone</label>
                      <input placeholder="+213…" value={patForm.phone}
                        onChange={e => setPatForm({ ...patForm, phone: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Date of Birth</label>
                      <input type="date" value={patForm.dateOfBirth}
                        onChange={e => setPatForm({ ...patForm, dateOfBirth: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select value={patForm.gender}
                      onChange={e => setPatForm({ ...patForm, gender: e.target.value })}>
                      <option value="">Select…</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {patError && <p className="auth-error">{patError}</p>}

                  <button className="btn-submit" onClick={handlePatientRegister}
                    disabled={patLoading} type="button">
                    {patLoading ? "Creating…" : "Create Patient Account"}
                  </button>
                  <p className="hipaa">
                    By registering you agree to our <span>Terms of Use</span>
                  </p>
                </>}

                {/* ── DOCTOR FORM ── */}
                {registerAs === "doctor" && <>
                <div className="field-row">
                  <div className="field">
                    <label>First Name</label>
                    <input placeholder="First name" value={form.firstName}
                      onChange={e => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Last Name</label>
                    <input placeholder="Last name" value={form.lastName}
                      onChange={e => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Professional Email</label>
                  <input
                    type="email" placeholder="doctor@hospital.com" value={form.email}
                    onChange={e => {
                      setForm({ ...form, email: e.target.value });
                      checkEmailTypo(e.target.value);
                    }}
                    style={emailWarning ? { borderColor: "#f59e0b" } : undefined}
                  />
                  {emailWarning && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      marginTop: 5, padding: "0.4rem 0.65rem",
                      background: "#fffbeb", border: "1px solid #fcd34d",
                      borderRadius: 7, fontSize: 12, color: "#92400e",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span>
                        {emailWarning}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            const fixed = form.email.split("@")[0] + "@" + emailWarning.split("@")[1]?.replace("?","");
                            setForm({ ...form, email: fixed });
                            setEmailWarning("");
                          }}
                          style={{ background: "none", border: "none", color: "#d97706", fontWeight: 700, cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
                        >
                          Fix it
                        </button>
                      </span>
                    </div>
                  )}
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Password</label>
                    <input type="password" placeholder="••••••••" value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Confirm</label>
                    <input type="password" placeholder="••••••••" value={form.confirm}
                      onChange={e => setForm({ ...form, confirm: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Hospital / Clinic</label>
                  <input placeholder="Clinic Asalam, Oran" value={form.hospital}
                    onChange={e => setForm({ ...form, hospital: e.target.value })} />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input placeholder="+213…" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>Specialty</label>
                  <select value={form.specialty}
                    onChange={e => setForm({ ...form, specialty: e.target.value })}>
                    <option>Gastroenterology</option>
                    <option>Internal Medicine</option>
                    <option>Surgery</option>
                    <option>Oncology</option>
                  </select>
                </div>

                  {registerError && <p className="auth-error">{registerError}</p>}

                  <button className="btn-submit" onClick={handleRegister}
                    disabled={registerLoading} type="button">
                    {registerLoading ? "Creating..." : "Create Doctor Account"}
                  </button>
                  <p className="hipaa">
                    By registering you agree to our <span>Terms of Use</span>
                  </p>
                </>}

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}
