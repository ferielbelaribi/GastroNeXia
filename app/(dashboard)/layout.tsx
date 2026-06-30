export const dynamic = 'force-dynamic'
import type { Metadata } from "next";
import "@/lib/globals.css";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export const metadata: Metadata = {
  title: "GastroNeXia — Clinical AI",
  description: "AI-powered gastrointestinal endoscopy analysis platform",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfirmProvider>
    <div
      style={{
        display: "flex",
        height: "100vh", // نخليو full height
      }}
    >
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Right Side ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* ── Topbar (fixed) ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--bg)",
          }}
        >
          <Topbar />
        </div>

        {/* ── Scrollable Content ── */}
        <main
          style={{
            flex: 1,
            overflowY: "auto", // ✅ هنا الحل
            padding: "1.5rem",
            display: "block", // بدل flex باش ما يعطلش scroll
            scrollBehavior: "smooth",
          }}
        >
          {children}
        </main>
      </div>
    </div>
    </ConfirmProvider>
  );
}
