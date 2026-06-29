"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface GalleryItem {
  filename: string;
  maskFilename: string | null;
  annotationCount: number;
}

interface RatingEntry {
  stars:   number | null;
  note:    string | null;
  savedAt: string;
}

type View = "folders" | "images" | "masks" | "ratings";

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.8rem", borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#111827" }}>{value}</span>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ items, startIdx, onClose }: {
  items: { src: string; name: string }[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const cur = items[idx];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowRight")  setIdx(i => Math.min(i + 1, items.length - 1));
      if (e.key === "ArrowLeft")   setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, items.length]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(2,6,23,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Prev */}
      {idx > 0 && (
        <button type="button" onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
          style={{ position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      {/* Next */}
      {idx < items.length - 1 && (
        <button type="button" onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
          style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      )}
      {/* Close */}
      <button type="button" onClick={onClose}
        style={{ position: "absolute", top: 20, right: 20, width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, maxWidth: "min(820px, 88vw)" }}>
        <img src={cur.src} alt={cur.name} style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: "10px 10px 0 0", display: "block" }} />
        <div style={{ width: "100%", background: "#111827", borderRadius: "0 0 10px 10px", padding: "0.55rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{cur.name}</p>
          <span style={{ fontSize: 11, color: "#4b5563" }}>{idx + 1} / {items.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </div>
        <p style={{ margin: "0 0 0.4rem", fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Confirm deletion</p>
        <p style={{ margin: "0 0 1.25rem", fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button type="button" onClick={onCancel}
            style={{ flex: 1, padding: "0.6rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#374151" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            style={{ flex: 1, padding: "0.6rem", borderRadius: 8, border: "none", background: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: "#fff" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Section = "manual" | "esophagitis";

export default function AnnotationResultsPage() {
  const [items,       setItems]       = useState<GalleryItem[]>([]);
  const [esophItems,  setEsophItems]  = useState<GalleryItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [section,     setSection]     = useState<Section>("manual");
  const [view,        setView]        = useState<View>("folders");
  const [lightbox,    setLightbox]    = useState<{ idx: number } | null>(null);
  const [confirm,     setConfirm]     = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [toast,       setToast]       = useState("");
  const [ratings,     setRatings]     = useState<Record<string, RatingEntry>>({});
  const [ratingsLoaded, setRatingsLoaded] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/annotation/gallery").then(r => r.json()),
      fetch("/api/annotation/gallery/esophagitis").then(r => r.json()),
      fetch("/api/annotation/ratings").then(r => r.json()),
    ]).then(([manual, esoph, ratingData]) => {
      setItems(manual.items ?? []);
      setEsophItems(esoph.items ?? []);
      setRatings(ratingData.ratings ?? {});
      setRatingsLoaded(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Active dataset depends on section
  const activeItems      = section === "esophagitis" ? esophItems : items;
  const withMask         = activeItems.filter(i => i.maskFilename !== null).length;
  const totalAnnotations = activeItems.reduce((s, i) => s + (i.annotationCount ?? 0), 0);

  // ── Delete helpers ─────────────────────────────────────────────────────────
  const deleteFile = (filename: string) => {
    setConfirm({
      message: `Delete "${filename}" and its corresponding mask? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        await fetch("/api/annotation/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "file", filename, section }),
        });
        showToast("File deleted");
        refresh();
      },
    });
  };

  const clearFolder = (folder: "images" | "masks" | "all") => {
    const label = folder === "all" ? "all annotation data" : `the ${folder}/ folder`;
    setConfirm({
      message: `Clear ${label}? All files will be permanently deleted.`,
      onConfirm: async () => {
        setConfirm(null);
        await fetch("/api/annotation/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "folder", folder, section }),
        });
        showToast(`${folder === "all" ? "All data" : folder + "/"} cleared`);
        setView("folders");
        refresh();
      },
    });
  };

  // ── Lightbox item lists ────────────────────────────────────────────────────
  const folderParam = section === "esophagitis" ? "&folder=esophagitis" : "";
  const imgLightboxItems = activeItems.map(i => ({
    src:  `/api/annotation/file?name=${encodeURIComponent(i.filename)}&type=image${folderParam}`,
    name: i.filename,
  }));
  const maskLightboxItems = activeItems
    .filter(i => i.maskFilename)
    .map(i => ({
      src:  `/api/annotation/file?name=${encodeURIComponent(i.maskFilename!)}&type=mask${folderParam}`,
      name: i.maskFilename!,
    }));

  // ── Current folder lightbox items ──────────────────────────────────────────
  const currentLightboxItems = view === "images" ? imgLightboxItems : maskLightboxItems;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>

      {/* Overlays */}
      {lightbox !== null && (
        <Lightbox items={currentLightboxItems} startIdx={lightbox.idx} onClose={() => setLightbox(null)} />
      )}
      {confirm && (
        <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9997, background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600, padding: "0.6rem 1.25rem", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ padding: "1.75rem 2rem 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            {view === "folders" ? (
              <Link
                href={section === "esophagitis" ? "/annotation?mode=auto" : "/annotation?mode=manual"}
                style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.45rem" }}
              >
                ← Back to Annotation
              </Link>
            ) : (
              <button type="button" onClick={() => setView("folders")}
                style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "inline-flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.45rem" }}>
                ← Back to folders
              </button>
            )}

            {/* Section tabs */}
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {(["manual", "esophagitis"] as Section[]).map(s => {
                const active = section === s && view !== "ratings";
                const label  = s === "manual" ? "Manual" : "Esophagitis AI";
                const accent = s === "manual" ? "#3b82f6" : "#10b981";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSection(s); setView("folders"); }}
                    style={{
                      padding: "0.3rem 0.85rem", borderRadius: 999,
                      border: active ? `1.5px solid ${accent}` : "1.5px solid #e5e7eb",
                      background: active ? (s === "manual" ? "#eff6ff" : "#ecfdf5") : "#fff",
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: active ? accent : "#6b7280",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              {/* Ratings tab — esophagitis only */}
              <button
                type="button"
                onClick={() => { setSection("esophagitis"); setView("ratings"); }}
                style={{
                  padding: "0.3rem 0.85rem", borderRadius: 999,
                  border: view === "ratings" ? "1.5px solid #f59e0b" : "1.5px solid #e5e7eb",
                  background: view === "ratings" ? "#fffbeb" : "#fff",
                  fontSize: 12, fontWeight: view === "ratings" ? 700 : 500,
                  color: view === "ratings" ? "#d97706" : "#6b7280",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={view === "ratings" ? "#f59e0b" : "none"} stroke={view === "ratings" ? "#f59e0b" : "#9ca3af"} strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Ratings
                {ratingsLoaded && Object.keys(ratings).length > 0 && (
                  <span style={{ background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "1px 5px", marginLeft: 2 }}>
                    {Object.keys(ratings).length}
                  </span>
                )}
              </button>
            </div>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
                {section === "esophagitis" ? "annotation_output/esophagitis/" : "annotation_output/manual/"}
              </span>
              {view !== "folders" && (
                <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace", fontWeight: 700 }}>{view}/</span>
              )}
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#111827", margin: "0 0 0.2rem", letterSpacing: "-0.02em" }}>
              {view === "ratings" ? "Doctor Assessments" : (section === "esophagitis" ? "Esophagitis AI Dataset" : "Annotation Dataset")}
            </h1>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              {view === "ratings"
                ? `${Object.keys(ratings).length} rated result${Object.keys(ratings).length !== 1 ? "s" : ""} · esophagitis_output/ratings.json`
                : view === "folders"
                  ? (section === "esophagitis"
                      ? "Auto-segmented esophagitis images · organised by folder"
                      : "Manually annotated images · organised by folder")
                  : view === "images"
                    ? `${activeItems.length} original image${activeItems.length !== 1 ? "s" : ""}`
                    : `${withMask} B&W mask${withMask !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div style={{ marginTop: "1.8rem", display: "flex", gap: "0.5rem" }}>
            {view !== "folders" && (
              <button type="button" onClick={() => clearFolder(view as "images" | "masks")}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Clear folder
              </button>
            )}
            {view === "folders" && activeItems.length > 0 && (
              <button type="button" onClick={() => clearFolder("all")}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.85rem", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Clear all
              </button>
            )}
            <button type="button" onClick={refresh}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats pills */}
        {!loading && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <StatPill dot="#3b82f6" label="Images"      value={activeItems.length} />
            <StatPill dot="#3b82f6" label="With Masks"  value={withMask} />
            {section === "manual" && <StatPill dot="#ef4444" label="Annotations" value={totalAnnotations} />}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div style={{ padding: "0 2rem 2.5rem" }}>

        {view === "ratings" ? (
          /* ── Ratings view ── */
          Object.keys(ratings).length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: "0.75rem" }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "0 0 0.35rem" }}>No ratings yet</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Rate a segmentation result from the AI Diagnostics page to see it here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(ratings).sort(([,a],[,b]) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).map(([baseName, r]) => (
                <div key={baseName} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {/* Filename */}
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {baseName}
                    </span>
                    {/* Stars */}
                    {r.stars !== null && r.stars > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= (r.stars ?? 0) ? "#f59e0b" : "none"} stroke={s <= (r.stars ?? 0) ? "#f59e0b" : "#d1d5db"} strokeWidth="1.8">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginLeft: 3 }}>
                          {["","Poor","Fair","Good","Very Good","Excellent"][r.stars ?? 0]}
                        </span>
                      </div>
                    )}
                    {/* Date */}
                    <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                      {new Date(r.savedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setConfirm({
                        message: `Delete assessment for "${baseName}"?`,
                        onConfirm: async () => {
                          setConfirm(null);
                          await fetch("/api/annotation/ratings", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ image_name: baseName }),
                          });
                          setRatings(prev => { const n = { ...prev }; delete n[baseName]; return n; });
                          showToast("Assessment deleted");
                        },
                      })}
                      style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                  {/* Comment */}
                  {r.note && r.note.trim() && (
                    <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.6, background: "#f8fafc", borderRadius: 8, padding: "0.55rem 0.75rem", border: "1px solid #f1f5f9" }}>
                      {r.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )

        ) : loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "3rem 0", color: "#9ca3af" }}>
            <div style={{ width: 18, height: 18, border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading…</span>
          </div>

        ) : activeItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#374151", margin: "0 0 0.35rem" }}>
              {section === "esophagitis" ? "No esophagitis segmentations yet" : "No saved annotations yet"}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 1.5rem" }}>
              {section === "esophagitis"
                ? "Upload an endoscopy image and click \"Run AI Segmentation & Save\" to see results here."
                : "Draw contours and click \"Generate Mask & Save\" to see results here."}
            </p>
            <Link href={section === "esophagitis" ? "/annotation?mode=auto" : "/annotation?mode=manual"}
              style={{ padding: "0.6rem 1.4rem", borderRadius: 8, background: section === "esophagitis" ? "#059669" : "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
              {section === "esophagitis" ? "Go to AI Segmentation" : "Go to Annotation Tool"}
            </Link>
          </div>

        ) : view === "folders" ? (
          /* ── Folder cards ── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", maxWidth: 640 }}>
            {/* images/ */}
            <div
              onClick={() => setView("images")}
              style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "1.4rem", cursor: "pointer", transition: "all 0.18s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#93c5fd"; el.style.boxShadow = "0 6px 20px rgba(59,130,246,0.12)"; el.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#e5e7eb"; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; el.style.transform = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="#3b82f6" stroke="none">
                    <path d="M10 4H2a2 2 0 00-2 2v12a2 2 0 002 2h20a2 2 0 002-2V8a2 2 0 00-2-2H12L10 4z"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              {/* Mini preview */}
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.9rem" }}>
                {activeItems.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ flex: 1, height: 56, borderRadius: 6, overflow: "hidden", background: "#0f172a" }}>
                    <img src={`/api/annotation/file?name=${encodeURIComponent(item.filename)}&type=image${folderParam}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 3 - activeItems.length) }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 56, borderRadius: 6, background: "#f1f5f9" }} />
                ))}
              </div>
              <p style={{ margin: "0 0 0.1rem", fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>images/</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{activeItems.length} file{activeItems.length !== 1 ? "s" : ""}</p>
            </div>

            {/* masks/ */}
            <div
              onClick={() => setView("masks")}
              style={{ background: "#0f172a", borderRadius: 14, border: "1px solid #1e293b", padding: "1.4rem", cursor: "pointer", transition: "all 0.18s", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#60a5fa"; el.style.boxShadow = "0 6px 20px rgba(59,130,246,0.2)"; el.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#1e293b"; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)"; el.style.transform = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="#60a5fa" stroke="none">
                    <path d="M10 4H2a2 2 0 00-2 2v12a2 2 0 002 2h20a2 2 0 002-2V8a2 2 0 00-2-2H12L10 4z"/>
                  </svg>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.9rem" }}>
                {activeItems.filter(i => i.maskFilename).slice(0, 3).map((item, i) => (
                  <div key={i} style={{ flex: 1, height: 56, borderRadius: 6, overflow: "hidden", background: "#000" }}>
                    <img src={`/api/annotation/file?name=${encodeURIComponent(item.maskFilename!)}&type=mask${folderParam}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 3 - withMask) }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 56, borderRadius: 6, background: "#1e293b" }} />
                ))}
              </div>
              <p style={{ margin: "0 0 0.1rem", fontSize: 13, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>masks/</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{withMask} file{withMask !== 1 ? "s" : ""}</p>
            </div>
          </div>

        ) : view === "images" ? (
          /* ── Images grid ── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: "0.55rem" }}>
            {activeItems.map((item, idx) => (
              <ImageThumb
                key={item.filename}
                src={`/api/annotation/file?name=${encodeURIComponent(item.filename)}&type=image${folderParam}`}
                name={item.filename}
                badge={item.annotationCount > 0 ? `${item.annotationCount} ann` : undefined}
                badgeColor="#ef4444"
                onOpen={() => setLightbox({ idx })}
                onDelete={() => deleteFile(item.filename)}
              />
            ))}
          </div>

        ) : (
          /* ── Masks grid ── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: "0.55rem" }}>
            {activeItems.map((item, idx) => {
              const masksOnly = activeItems.filter(i => i.maskFilename);
              const maskIdx   = masksOnly.indexOf(item);
              return item.maskFilename ? (
                <ImageThumb
                  key={item.filename}
                  src={`/api/annotation/file?name=${encodeURIComponent(item.maskFilename)}&type=mask${folderParam}`}
                  name={item.maskFilename}
                  badge="MASK"
                  badgeColor="#1d4ed8"
                  dark
                  onOpen={() => setLightbox({ idx: maskIdx })}
                  onDelete={() => deleteFile(item.filename)}
                />
              ) : (
                <div key={item.filename} style={{ borderRadius: 8, height: 136, border: "1px dashed #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem", background: "#f8fafc" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{ fontSize: 9, color: "#d1d5db", fontWeight: 600 }}>no mask</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Thumbnail card ───────────────────────────────────────────────────────────
function ImageThumb({ src, name, badge, badgeColor, dark, onOpen, onDelete }: {
  src: string; name: string; badge?: string; badgeColor?: string;
  dark?: boolean; onOpen: () => void; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{ borderRadius: 8, overflow: "hidden", background: dark ? "#000" : "#0f172a", border: `1.5px solid ${hov ? "#3b82f6" : "#1e293b"}`, position: "relative", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ position: "relative", height: 108 }} onClick={onOpen}>
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {badge && (
          <div style={{ position: "absolute", top: 5, right: 5, background: badgeColor, color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>
            {badge}
          </div>
        )}
        {/* Hover overlay */}
        {hov && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "0.3rem 0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>View</span>
            </div>
          </div>
        )}
      </div>
      {/* Bottom strip */}
      <div style={{ padding: "0.3rem 0.45rem", background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={name}>
          {name}
        </span>
        {/* Delete button — always visible on mobile, hover on desktop */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: "none", background: hov ? "rgba(220,38,38,0.15)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "background 0.15s" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hov ? "#ef4444" : "#475569"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
