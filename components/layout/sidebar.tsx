"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Ico from "@/components/ui/ico";
import { I } from "@/lib/icons";
import { navItems } from "@/lib/data";
import LogoIcon from "@/components/ui/logo-icon";

interface DoctorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospital: string;
  specialty: string;
  phone: string;
  avatarUrl?: string | null;
  role?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const isGuest = searchParams.get("guest") === "true";

  const syncDoctor = () => {
    const stored = localStorage.getItem("doctor");
    if (stored) setDoctor(JSON.parse(stored));
  };

  useEffect(() => {
    syncDoctor();
    window.addEventListener("doctor-updated", syncDoctor);
    return () => window.removeEventListener("doctor-updated", syncDoctor);
  }, []);

  const initials = doctor
    ? `${doctor.firstName[0] ?? ""}${doctor.lastName[0] ?? ""}`.toUpperCase()
    : "??";

  const isPatient  = doctor?.role === "patient";
  const fullName   = doctor
    ? (isPatient ? `${doctor.firstName} ${doctor.lastName}` : `Dr. ${doctor.firstName} ${doctor.lastName}`)
    : "Dr. ...";

  const specialty  = doctor?.specialty ?? "";
  const isAdmin    = doctor?.role === "admin";

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isActive = (id: string) => pathname.startsWith(`/${id}`);

  const handleNavClick = (id: string) => {
    router.push(`/${id}`);
  };

  return (
    <>
    <aside style={{
      width: 260,
      background: "#ffffff",
      borderRight: "1px solid rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>

      {/* ── LOGO ── */}
      <div
        onClick={() => router.push("/dashboard")}
        style={{
          padding: "20px 24px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
          marginLeft: "-40px",
        }}
      >
        <LogoIcon size={56} />
      </div>

      {/* ── DOCTOR / GUEST CARD ── */}
      {isGuest ? (
        <div style={{
          margin: "14px 14px 6px",
          borderRadius: 14,
          overflow: "hidden",
          background: "linear-gradient(135deg, #1e3a5f 0%, #2563EB 55%, #60a5fa 100%)",
          padding: "14px 14px",
          display: "flex", alignItems: "center", gap: 11,
          position: "relative",
          boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
        }}>
          {/* decorative blobs */}
          <div style={{ position: "absolute", top: -14, right: -14, width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -10, left: 30, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

          {/* Avatar */}
          <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#93c5fd", border: "2px solid #2563EB" }} />
          </div>

          {/* Text */}
          <div style={{ minWidth: 0, zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: -0.2 }}>Guest</div>
            <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 8px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3 }}>Trial Mode · 3 detections</span>
            </div>
          </div>
        </div>
      ) : (
      <div
        onClick={() => router.push("/account")}
        style={{
          margin: "14px 14px 6px",
          borderRadius: 14,
          overflow: "hidden",
          cursor: "pointer",
          background: "linear-gradient(135deg, #1e3a5f 0%, #2563EB 55%, #60a5fa 100%)",
          padding: "14px 14px",
          display: "flex", alignItems: "center", gap: 11,
          position: "relative",
          boxShadow: "0 4px 18px rgba(37,99,235,0.32)",
          transition: "box-shadow 0.18s, transform 0.18s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(37,99,235,0.38)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 18px rgba(37,99,235,0.28)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* decorative blobs */}
        <div style={{ position: "absolute", top: -18, right: -18, width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -12, right: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

        {/* Avatar */}
        <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
          {doctor?.avatarUrl ? (
            <img src={doctor.avatarUrl} alt={fullName} style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "2.5px solid rgba(255,255,255,0.8)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
              objectFit: "cover", display: "block",
            }} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.22)",
              border: "2.5px solid rgba(255,255,255,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 800, color: "#fff",
            }}>{initials}</div>
          )}
          <span style={{
            position: "absolute", bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: "50%",
            background: "#2563EB", border: "2px solid #fff",
          }} />
        </div>

        {/* Text */}
        <div style={{ minWidth: 0, zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isAdmin ? `${doctor?.firstName} ${doctor?.lastName}` : fullName}
          </div>
          {isAdmin ? (
            <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", borderRadius: 5, padding: "2px 8px" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>System Administrator</span>
            </div>
          ) : isPatient ? (
            <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", borderRadius: 5, padding: "2px 8px" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Patient</span>
            </div>
          ) : (
            <>
              {specialty && (
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.8)", fontWeight: 600, marginTop: 1 }}>
                  {specialty}
                </div>
              )}
              {doctor?.hospital && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {doctor.hospital}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* ── NAVIGATION ── */}
      <nav style={{
        flex: 1,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        overflowY: "auto",
      }}>
        {isGuest ? (
          <>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.8, textTransform: "uppercase", padding: "8px 14px 6px" }}>
              Guest Access
            </div>
            <button
              onClick={() => router.push("/live?guest=true")}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 11,
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))",
                color: "#2563EB", fontWeight: 700, fontSize: 13.5,
                border: "none", borderLeft: "3px solid #2563EB",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <Ico d={I.live} s={18} c="#2563EB" />
              <span>AI Diagnostics</span>
              <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8" }} />
            </button>
          </>
        ) : null}

        {!isGuest && !isAdmin && !isPatient && (
          <div style={{
            fontSize: 9, fontWeight: 800, color: "#94a3b8",
            letterSpacing: 1.8, textTransform: "uppercase",
            padding: "8px 14px 6px",
          }}>
            Main Menu
          </div>
        )}

        {/* ── PATIENT nav ── */}
        {!isGuest && isPatient && (() => {
          const portalItems: { path: string; label: string; icoKey: keyof typeof I }[] = [
            { path: "/portal",              label: "My Dashboard", icoKey: "dash"  },
            { path: "/portal/appointments", label: "Appointments", icoKey: "cases" },
          ];
          const systemItems: { path: string; label: string; icoKey: keyof typeof I }[] = [
            { path: "/account",  label: "Account",  icoKey: "user"     },
            { path: "/settings", label: "Settings", icoKey: "settings" },
          ];
          const NavBtn = ({ path, label, icoKey }: { path: string; label: string; icoKey: keyof typeof I }) => {
            const active = pathname === path;
            return (
              <button
                onClick={() => router.push(path)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 11,
                  background: active ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))" : "transparent",
                  color: active ? "#2563EB" : "#64748b",
                  fontWeight: active ? 700 : 500, fontSize: 13.5,
                  border: "none", borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <Ico d={I[icoKey]} s={18} c={active ? "#2563EB" : "#94A3B8"} />
                <span>{label}</span>
              </button>
            );
          };
          return (
            <>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.8, textTransform: "uppercase", padding: "8px 14px 6px" }}>
                Patient Portal
              </div>
              {portalItems.map(it => <NavBtn key={it.path} {...it} />)}

              <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.8, textTransform: "uppercase", padding: "14px 14px 6px" }}>
                System
              </div>
              {systemItems.map(it => <NavBtn key={it.path} {...it} />)}
            </>
          );
        })()}

        {(!isGuest && !isAdmin && !isPatient ? navItems : []).map((n) => {
          const active = isActive(n.id);
          return (
            <button
              key={n.id}
              onClick={() => handleNavClick(n.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 11,
                background: active
                  ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))"
                  : "transparent",
                color: active ? "#2563EB" : "#64748b",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
                border: "none",
                borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Ico
                d={I[n.ico]}
                s={18}
                c={active ? "#2563EB" : "#94A3B8"}
              />
              <span>{n.label}</span>

              {n.id === "live" && (
                <span style={{
                  marginLeft: "auto",
                  width: 7, height: 7,
                  borderRadius: "50%",
                  background: "#1D4ED8",
                }} />
              )}
            </button>
          );
        })}

        {/* ── ADMIN: Management section ── */}
        {!isGuest && isAdmin && (() => {
          const currentTab = searchParams.get("tab") ?? "overview";
          const isOnAdmin = pathname.startsWith("/admin");

          const adminItems: { tab: string; label: string; icoKey: keyof typeof I; badge?: string }[] = [
            { tab: "overview", label: "Overview",  icoKey: "dash",     badge: "ADMIN" },
            { tab: "doctors",  label: "Doctors",   icoKey: "user"     },
            { tab: "patients", label: "Patients",  icoKey: "patients" },
            { tab: "reports",  label: "Reports",   icoKey: "reports"  },
            { tab: "analyses", label: "Analyses",  icoKey: "cpu"      },
            { tab: "activity", label: "Activity",  icoKey: "activity" },
          ];

          return (
            <>
              <div style={{
                fontSize: 9, fontWeight: 800, color: "#94a3b8",
                letterSpacing: 1.8, textTransform: "uppercase",
                padding: "14px 14px 6px",
              }}>
                Management
              </div>

              {adminItems.map(it => {
                const active = isOnAdmin && currentTab === it.tab && !pathname.startsWith("/admin/doctors/");
                return (
                  <Link key={it.tab} href={`/admin?tab=${it.tab}`} style={{ textDecoration: "none" }}>
                    <button style={{
                      width: "100%",
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 11,
                      background: active
                        ? "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(29,78,216,0.08))"
                        : "transparent",
                      color: active ? "#2563EB" : "#64748b",
                      fontWeight: active ? 700 : 500,
                      fontSize: 13.5,
                      border: "none",
                      borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
                      cursor: "pointer", transition: "all 0.18s", textAlign: "left",
                    }}>
                      <Ico d={I[it.icoKey]} s={18} c={active ? "#2563EB" : "#94A3B8"} />
                      <span>{it.label}</span>
                      {it.badge && (
                        <span style={{
                          marginLeft: "auto", fontSize: 9, fontWeight: 800,
                          background: "linear-gradient(135deg,#2563EB,#1D4ED8)",
                          color: "#fff", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.05em",
                        }}>{it.badge}</span>
                      )}
                    </button>
                  </Link>
                );
              })}
            </>
          );
        })()}

        {/* System section — doctors and admin only */}
        {!isGuest && !isPatient && (
          <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.8, textTransform: "uppercase", padding: "14px 14px 6px" }}>
            System
          </div>
        )}

        {/* Availability — doctors only */}
        {!isGuest && !isAdmin && !isPatient && (
          <Link href="/availability" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 11,
              background: pathname.startsWith("/availability") ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))" : "transparent",
              color: pathname.startsWith("/availability") ? "#2563EB" : "#64748b",
              fontWeight: pathname.startsWith("/availability") ? 700 : 500, fontSize: 13.5,
              border: "none", borderLeft: pathname.startsWith("/availability") ? "3px solid #2563EB" : "3px solid transparent",
              cursor: "pointer", transition: "all 0.18s",
            }}>
              <Ico d={I.cases} s={18} c={pathname.startsWith("/availability") ? "#2563EB" : "#94A3B8"} />
              <span>Availability</span>
            </button>
          </Link>
        )}

        {/* Account + Settings — hidden for patients and guests */}
        {!isGuest && !isPatient && (
          <>
            <Link href="/account" style={{ textDecoration: "none" }}>
              <button style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 11,
                background: pathname.startsWith("/account")
                  ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))"
                  : "transparent",
                color: pathname.startsWith("/account") ? "#2563EB" : "#64748b",
                fontWeight: pathname.startsWith("/account") ? 700 : 500,
                fontSize: 13.5,
                border: "none",
                borderLeft: pathname.startsWith("/account") ? "3px solid #2563EB" : "3px solid transparent",
                cursor: "pointer", transition: "all 0.18s",
              }}>
                <Ico d={I.user} s={18} c={pathname.startsWith("/account") ? "#2563EB" : "#94A3B8"} />
                <span>Account</span>
              </button>
            </Link>

            <Link href="/settings" style={{ textDecoration: "none" }}>
              <button style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 11,
                background: pathname.startsWith("/settings")
                  ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,148,136,0.06))"
                  : "transparent",
                color: pathname.startsWith("/settings") ? "#2563EB" : "#64748b",
                fontWeight: pathname.startsWith("/settings") ? 700 : 500,
                fontSize: 13.5,
                border: "none",
                borderLeft: pathname.startsWith("/settings") ? "3px solid #2563EB" : "3px solid transparent",
                cursor: "pointer", transition: "all 0.18s",
              }}>
                <Ico d={I.settings} s={18} c={pathname.startsWith("/settings") ? "#2563EB" : "#94A3B8"} />
                <span>Settings</span>
              </button>
            </Link>
          </>
        )}
      </nav>

      {/* ── SIGN OUT / BACK ── */}
      <div style={{ padding: "12px 10px 20px" }}>
        {isGuest ? (
          <button
            onClick={() => router.push("/welcome")}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 11,
              border: "1px solid rgba(37,99,235,0.15)",
              background: "rgba(37,99,235,0.05)",
              color: "#2563EB", fontWeight: 600, fontSize: 13.5,
              cursor: "pointer", transition: "all 0.18s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back to Home</span>
          </button>
        ) : (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 11,
              border: "1px solid rgba(239,68,68,0.12)",
              background: "rgba(239,68,68,0.04)",
              color: "#ef4444", fontWeight: 600, fontSize: 13.5,
              cursor: "pointer", transition: "all 0.18s",
            }}
          >
            <Ico d={I.logout} s={18} c="#EF4444" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulseLive {
          0%, 100% { box-shadow: 0 0 4px rgba(13,148,136,0.5); }
          50% { box-shadow: 0 0 10px rgba(13,148,136,0.9); }
        }
        @keyframes sidebarModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </aside>

    {/* ── SIGN-OUT CONFIRMATION MODAL (portalled to body to escape sticky/fixed stacking context) ── */}
    {mounted && showLogoutConfirm && createPortal(
      <div
        onClick={() => setShowLogoutConfirm(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#fff", borderRadius: 20, padding: "2rem",
            width: "100%", maxWidth: 380,
            boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
            display: "flex", flexDirection: "column", gap: "1.25rem",
            animation: "sidebarModalIn 0.2s ease",
          }}
        >
          {/* Icon */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#fef2f2", border: "1px solid #fecaca",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", margin: "0 0 0.4rem" }}>
              Sign Out?
            </p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
              Are you sure you want to sign out of your account?
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              style={{
                flex: 1, padding: "0.65rem", borderRadius: 10,
                border: "1px solid #e2e8f0", background: "#f8fafc",
                color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("doctor");
                setShowLogoutConfirm(false);
                router.push("/welcome");
              }}
              style={{
                flex: 1, padding: "0.65rem", borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Yes, Sign Out
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}