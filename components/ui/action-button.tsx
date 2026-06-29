"use client";

import { useState } from "react";
import Link from "next/link";

type Variant = "primary" | "neutral" | "ghost";

interface BaseProps {
  label: string;
  icon?: React.ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  disabled?: boolean;
}
type ButtonProps = BaseProps & { onClick: () => void; href?: never; external?: never };
type LinkProps   = BaseProps & { href: string; onClick?: never; external?: boolean };
type Props = ButtonProps | LinkProps;

const palette: Record<Variant, { bg: string; bgHover: string; fg: string; fgHover: string; border: string; shadow: string }> = {
  primary: {
    bg: "rgba(37,99,235,0.08)",
    bgHover: "linear-gradient(135deg, #2563EB, #1D4ED8)",
    fg: "#2563EB", fgHover: "#fff",
    border: "rgba(37,99,235,0.18)",
    shadow: "0 4px 14px rgba(37,99,235,0.28)",
  },
  neutral: {
    bg: "#fff",
    bgHover: "#f9fafb",
    fg: "#374151", fgHover: "#0a0f1e",
    border: "#e5e7eb",
    shadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  ghost: {
    bg: "transparent",
    bgHover: "rgba(37,99,235,0.06)",
    fg: "#6b7280", fgHover: "#2563EB",
    border: "transparent",
    shadow: "none",
  },
};

export default function ActionButton(props: Props) {
  const { label, icon, variant = "neutral", size = "sm", disabled } = props;
  const [hover, setHover] = useState(false);
  const p = palette[variant];

  const padY = size === "sm" ? 6  : 9;
  const padX = size === "sm" ? 11 : 16;
  const fz   = size === "sm" ? 11 : 12.5;

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: `${padY}px ${padX}px`,
    borderRadius: 9,
    fontSize: fz,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "all 0.18s ease",
    border: `1px solid ${hover && !disabled && variant === "primary" ? "transparent" : p.border}`,
    background: hover && !disabled ? p.bgHover : p.bg,
    color: hover && !disabled ? p.fgHover : p.fg,
    boxShadow: hover && !disabled ? p.shadow : "none",
    transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const content = (
    <>
      {icon}
      <span>{label}</span>
    </>
  );

  if ("href" in props && props.href) {
    const isExternal = props.external || /^https?:\/\//.test(props.href);
    if (isExternal) {
      return (
        <a href={props.href} target="_blank" rel="noreferrer" style={style}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          {content}
        </a>
      );
    }
    return (
      <Link href={props.href} style={style}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={(props as ButtonProps).onClick} disabled={disabled} style={style}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {content}
    </button>
  );
}
