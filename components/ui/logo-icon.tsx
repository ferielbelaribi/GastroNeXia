"use client";

export default function LogoIcon({ size = 40 }: { size?: number }) {
  const height = size;
  const width = Math.round(size * 4.2);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="GastroNeXia"
      width={width}
      height={height}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
