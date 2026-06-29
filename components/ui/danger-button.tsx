"use client";

import { useState } from "react";

interface Props {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  iconOnly?: boolean;
}

export default function DangerButton({
  onClick, loading, disabled, size = "sm", label = "Delete", iconOnly = false,
}: Props) {
  const [hover, setHover] = useState(false);
  const isDisabled = disabled || loading;

  const padY = size === "sm" ? 6  : 9;
  const padX = size === "sm" ? 11 : 16;
  const fz   = size === "sm" ? 11 : 12.5;
  const ico  = size === "sm" ? 12 : 14;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: `${padY}px ${padX}px`,
        borderRadius: 9,
        fontSize: fz,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: "all 0.18s ease",
        border: hover && !isDisabled ? "1px solid transparent" : "1px solid rgba(239,68,68,0.18)",
        background: hover && !isDisabled
          ? "linear-gradient(135deg, #ef4444, #dc2626)"
          : "rgba(239,68,68,0.06)",
        color: hover && !isDisabled ? "#fff" : "#dc2626",
        boxShadow: hover && !isDisabled
          ? "0 4px 14px rgba(239,68,68,0.32)"
          : "0 1px 2px rgba(239,68,68,0.04)",
        transform: hover && !isDisabled ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {loading ? (
        <span style={{
          width: ico, height: ico,
          border: `2px solid ${hover ? "rgba(255,255,255,0.4)" : "rgba(220,38,38,0.25)"}`,
          borderTopColor: hover ? "#fff" : "#dc2626",
          borderRadius: "50%",
          animation: "dbtn-spin 0.7s linear infinite",
        }} />
      ) : (
        <svg width={ico} height={ico} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6 M14 11v6" />
          <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
        </svg>
      )}
      {!iconOnly && <span>{loading ? "Deleting…" : label}</span>}
      <style>{`@keyframes dbtn-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
