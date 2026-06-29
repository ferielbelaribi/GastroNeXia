"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Variant = "danger" | "warning" | "primary";

interface Options {
  title?: string;
  message: string | React.ReactNode;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}

interface ConfirmContextValue {
  confirm: (opts: Options) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const palette: Record<Variant, { gradient: string; ring: string; iconBg: string; iconFg: string; shadow: string }> = {
  danger: {
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
    ring:    "rgba(239,68,68,0.18)",
    iconBg:  "rgba(239,68,68,0.12)",
    iconFg:  "#dc2626",
    shadow:  "0 10px 30px rgba(239,68,68,0.32)",
  },
  warning: {
    gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
    ring:    "rgba(245,158,11,0.18)",
    iconBg:  "rgba(245,158,11,0.12)",
    iconFg:  "#d97706",
    shadow:  "0 10px 30px rgba(245,158,11,0.32)",
  },
  primary: {
    gradient: "linear-gradient(135deg,#2563EB,#1D4ED8)",
    ring:    "rgba(37,99,235,0.18)",
    iconBg:  "rgba(37,99,235,0.12)",
    iconFg:  "#2563EB",
    shadow:  "0 10px 30px rgba(37,99,235,0.32)",
  },
};

const icons: Record<Variant, React.ReactNode> = {
  danger: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6 M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  ),
  warning: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  primary: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8"  x2="12.01" y2="8"/>
    </svg>
  ),
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [open, setOpen] = useState(false);
  const [hoverConfirm, setHoverConfirm] = useState(false);
  const [hoverCancel,  setHoverCancel]  = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: Options) => {
    setOpts(o); setOpen(true);
    return new Promise<boolean>(resolve => { resolverRef.current = resolve; });
  }, []);

  const close = (result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
    setTimeout(() => setOpts(null), 200);
  };

  // ESC + Enter
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter")  close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const variant = opts?.variant ?? "danger";
  const p = palette[variant];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {opts && (
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(10,15,30,0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
            opacity: open ? 1 : 0,
            transition: "opacity 0.18s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 440,
              background: "#fff",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
              transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
              opacity: open ? 1 : 0,
              transition: "transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.18s ease",
              fontFamily: "inherit",
            }}
          >
            {/* Header band with icon */}
            <div style={{
              padding: "1.4rem 1.4rem 0.5rem",
              display: "flex", alignItems: "flex-start", gap: 14,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: p.iconBg, color: p.iconFg,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 0 0 6px ${p.ring}`,
              }}>
                {icons[variant]}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <p style={{
                  margin: 0, fontSize: 15, fontWeight: 800, color: "#0a0f1e",
                  letterSpacing: -0.2,
                }}>
                  {opts.title ?? (variant === "danger" ? "Confirm deletion" : "Please confirm")}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>
                  {opts.message}
                </p>
                {opts.detail && (
                  <div style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#f9fafb",
                    border: "1px solid #f3f4f6",
                    fontSize: 11, color: "#6b7280",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    wordBreak: "break-word",
                  }}>
                    {opts.detail}
                  </div>
                )}
              </div>
              <button
                onClick={() => close(false)}
                aria-label="Close"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  width: 28, height: 28, borderRadius: 7, color: "#94a3b8",
                  fontSize: 18, lineHeight: 1, flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; (e.currentTarget as HTMLButtonElement).style.color = "#0a0f1e"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
              >
                ×
              </button>
            </div>

            {/* Footer */}
            <div style={{
              padding: "1.1rem 1.4rem",
              marginTop: "0.6rem",
              borderTop: "1px solid #f3f4f6",
              background: "#fafbfd",
              display: "flex", justifyContent: "flex-end", gap: 8,
            }}>
              <button
                onClick={() => close(false)}
                onMouseEnter={() => setHoverCancel(true)}
                onMouseLeave={() => setHoverCancel(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: hoverCancel ? "#f9fafb" : "#fff",
                  color: "#374151",
                  fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                  cursor: "pointer", transition: "all 0.18s ease",
                }}
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                onMouseEnter={() => setHoverConfirm(true)}
                onMouseLeave={() => setHoverConfirm(false)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: p.gradient,
                  color: "#fff",
                  fontSize: 12.5, fontWeight: 800, fontFamily: "inherit",
                  cursor: "pointer", transition: "all 0.18s ease",
                  boxShadow: hoverConfirm ? p.shadow : "0 2px 8px rgba(0,0,0,0.08)",
                  transform: hoverConfirm ? "translateY(-1px)" : "translateY(0)",
                  letterSpacing: 0.2,
                }}
              >
                {opts.confirmLabel ?? (variant === "danger" ? "Delete" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx.confirm;
}
