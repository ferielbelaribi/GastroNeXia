// app/layout.tsx
export const dynamic = 'force-dynamic'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GastroNeXia — AI Diagnostic Platform",
  description: "Real-time AI analysis of gastrointestinal endoscopy feeds.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
