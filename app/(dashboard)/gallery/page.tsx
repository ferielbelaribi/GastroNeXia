"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FrameDetection {
  id: string;
  label: string;
  confidence: number;
  severity: string;
  boundingBox: string;
}

interface GalleryFrame {
  id: string;
  frameIndex: number;
  frameUrl: string;
  timestampSeconds: number;
  hasDetection: boolean;
  overallRisk: string;
  frameDetections: FrameDetection[];
}

interface GalleryMedia {
  id: string;
  mediaType: string;
  filename: string;
  totalFrames: number | null;
  storageUrl: string;
  overlayUrl?: string | null;
  captureSource?: string | null;
  uploadedAt?: string;
  frames: GalleryFrame[];
}

interface GalleryVisit {
  id: string;
  visitDate: string;
  visitType: string;
  patient: { id: string; firstName: string; lastName: string; gender: string };
  media: GalleryMedia[];
}

interface PatientGroup {
  patient: { id: string; firstName: string; lastName: string; gender: string };
  visits: GalleryVisit[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function riskColor(risk: string) {
  if (risk === "high")     return "#ef4444";
  if (risk === "moderate") return "#f59e0b";
  return "#2563EB";
}

function severityColor(sev: string) {
  if (sev === "high")     return "#ef4444";
  if (sev === "moderate") return "#f59e0b";
  return "#2563EB";
}

function avatarGradient(name: string) {
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(name.length - 1) * 13) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue + 40) % 360},70%,45%))`;
}

function normalizeBbox(bbox: any): { x: number; y: number; w: number; h: number } {
  const x = bbox?.x ?? 10;
  const y = bbox?.y ?? 10;
  const w = bbox?.w ?? 20;
  const h = bbox?.h ?? 20;
  if (x > 100 || y > 100 || w > 100 || h > 100) {
    const maxVal = Math.max(x + w, y + h);
    const scale  = 100 / maxVal;
    return {
      x: Math.min(Math.max(x * scale, 0), 95),
      y: Math.min(Math.max(y * scale, 0), 95),
      w: Math.min(w * scale, 100 - x * scale),
      h: Math.min(h * scale, 100 - y * scale),
    };
  }
  return { x, y, w, h };
}

// distinct palette so multiple boxes on the same frame are always distinguishable
const DET_PALETTE = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#DC2626", // emerald
  "#f97316", // orange
  "#ec4899", // pink
];

// ─── Media deduplication (shared by cards + viewer) ──────────────────────────
function deduplicateMedia(media: GalleryMedia[]): GalleryMedia[] {
  // Only collapse exact DB duplicate records (same id appearing twice).
  // Different IDs = intentionally separate uploads → keep both.
  const seen = new Set<string>();
  return media.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

// ─── Detection SVG Overlay ────────────────────────────────────────────────────
function DetectionOverlay({ detections }: { detections: FrameDetection[] }) {
  const LABEL_H = 5.5;

  // Pre-compute label slots: prefer above → below → inside-top, avoid collision
  type Slot = { x: number; y: number; w: number; h: number };
  const occupied: Slot[] = [];
  const overlaps = (a: Slot, b: Slot) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const labelSlots = detections.map((_, i) => {
    let parsed: any = {};
    try { parsed = JSON.parse(detections[i].boundingBox); } catch {}
    const { x, y, w, h } = normalizeBbox(parsed);

    const above:  Slot = { x, y: y - LABEL_H, w, h: LABEL_H };
    const below:  Slot = { x, y: y + h,        w, h: LABEL_H };
    const inside: Slot = { x, y,                w, h: LABEL_H };

    const trySlot = (s: Slot) => s.y >= 0 && s.y + s.h <= 100 && !occupied.some(o => overlaps(s, o));

    let chosen: Slot;
    if      (trySlot(above))  chosen = above;
    else if (trySlot(below))  chosen = below;
    else                      chosen = inside;

    occupied.push(chosen);
    return chosen;
  });

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {detections.map((d, i) => {
        let parsed: any = {};
        try { parsed = JSON.parse(d.boundingBox); } catch {}
        const { x, y, w, h } = normalizeBbox(parsed);
        const color  = DET_PALETTE[i % DET_PALETTE.length];
        const slot   = labelSlots[i];
        const textY  = slot.y + LABEL_H - 1.5;

        return (
          <g key={d.id ?? i}>
            {/* box */}
            <rect x={x} y={y} width={w} height={h}
              fill="none" stroke={color} strokeWidth="0.75" rx="0.8" />
            {/* label background */}
            <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h}
              fill={color} opacity={0.93} rx="0.8" />
            {/* label text */}
            <text x={slot.x + slot.w / 2} y={textY}
              textAnchor="middle" fontSize="2.6"
              fill="#fff" fontWeight="bold" fontFamily="sans-serif">
              {d.label} {Math.round(d.confidence)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Frame Thumbnail ──────────────────────────────────────────────────────────
function FrameThumb({
  frame, showBoxes, onClick,
}: {
  frame: GalleryFrame;
  showBoxes: boolean;
  onClick: () => void;
}) {
  const [hov,      setHov]     = useState(false);
  const [imgError, setImgErr]  = useState(false);
  const rc = riskColor(frame.overallRisk);
  const showImg = !!frame.frameUrl && !imgError;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 10, overflow: "hidden", cursor: "pointer",
        border: `2px solid ${hov ? "#2563EB" : frame.hasDetection ? "#fecaca" : "#e5e7eb"}`,
        background: "#000", position: "relative", aspectRatio: "16/9",
        boxShadow: hov ? "0 4px 16px rgba(37,99,235,0.2)" : "none",
        transform: hov ? "scale(1.03)" : "none", transition: "all 0.15s",
      }}
    >
      {showImg ? (
        <img
          src={frame.frameUrl}
          alt={`Frame ${frame.frameIndex}`}
          onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%", background: "#111",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style={{ color: "#555", fontSize: 9 }}>
            {imgError ? "Unavailable" : "No preview"}
          </span>
        </div>
      )}
      {showBoxes && frame.frameDetections.length > 0 && (
        <DetectionOverlay detections={frame.frameDetections} />
      )}
      <div style={{
        position: "absolute", bottom: 4, left: 4,
        background: "rgba(0,0,0,0.7)", color: "#fff",
        fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, fontFamily: "monospace",
      }}>
        F{frame.frameIndex + 1} · {fmtTime(frame.timestampSeconds)}
      </div>
      {frame.hasDetection && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          width: 8, height: 8, borderRadius: "50%",
          background: rc, boxShadow: `0 0 6px ${rc}`,
        }} />
      )}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  frames, index, showBoxes, onClose, onPrev, onNext,
}: {
  frames: GalleryFrame[];
  index: number;
  showBoxes: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const frame = frames[index];
  const [lbImgError, setLbImgError] = React.useState(false);
  // reset error state when frame changes
  React.useEffect(() => { setLbImgError(false); }, [index]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onPrev, onNext]);

  if (!frame) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Header */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1.25rem",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>
          Frame {frame.frameIndex + 1} · {fmtTime(frame.timestampSeconds)}
          {frame.hasDetection && (
            <span style={{ marginLeft: 8, color: riskColor(frame.overallRisk), fontWeight: 800 }}>
              ● {frame.overallRisk.charAt(0).toUpperCase() + frame.overallRisk.slice(1)} Risk
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          {index + 1} / {frames.length} · ESC to close
        </span>
      </div>

      {/* Image + overlay — inline-block so SVG matches image exactly */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: "relative", display: "inline-block" }}
      >
        {frame.frameUrl && !lbImgError ? (
          <img
            src={frame.frameUrl}
            alt={`Frame ${frame.frameIndex}`}
            onError={() => setLbImgError(true)}
            style={{
              maxWidth: "90vw", maxHeight: "82vh",
              objectFit: "contain", borderRadius: 8, display: "block",
              boxShadow: "0 0 80px rgba(0,0,0,0.8)",
            }}
          />
        ) : (
          <div style={{
            width: "60vw", height: "50vh", borderRadius: 8,
            background: "#0f172a", border: "1px solid #1e293b",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p style={{ color: "#475569", fontSize: 13, fontWeight: 600, margin: 0 }}>
              {lbImgError ? "Image unavailable" : "No preview available"}
            </p>
          </div>
        )}
        {showBoxes && frame.frameDetections.length > 0 && (
          <DetectionOverlay detections={frame.frameDetections} />
        )}
      </div>

      {/* Nav arrows */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev(); }}
          style={{
            position: "absolute", left: "1.5rem", top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >‹</button>
      )}
      {index < frames.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext(); }}
          style={{
            position: "absolute", right: "1.5rem", top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >›</button>
      )}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: "1rem", right: "1.25rem",
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", width: 32, height: 32, borderRadius: "50%",
          cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>
    </div>
  );
}

// ─── Visit Viewer Modal ────────────────────────────────────────────────────────
function VisitViewer({ visit, onClose }: { visit: GalleryVisit; onClose: () => void }) {
  const uniqueMedia = deduplicateMedia(visit.media);

  // Re-number frames globally so frame indices are unique across multiple videos
  const allFrames = uniqueMedia.flatMap((m, mi) =>
    m.frames.map(f => ({ ...f, _mediaIdx: mi, _mediaId: m.id, _mediaName: m.filename ?? `Video ${mi + 1}` }))
  );
  const videos             = uniqueMedia.filter(m => m.mediaType === "video" && m.storageUrl);
  // Only show overlays from live video frame segmentation (not static image analyses)
  const segmentationResults = uniqueMedia.filter(m =>
    m.mediaType === "image" && m.overlayUrl && m.captureSource === "live_frame"
  );
  const [lbIdx,        setLbIdx]        = useState<number | null>(null);
  const [overlayLbIdx, setOverlayLbIdx] = useState<number | null>(null);
  const [filter,       setFilter]       = useState<"all" | "detections" | "overlay">("all");
  const [search,     setSearch]     = useState("");
  const [viewMode,   setViewMode]   = useState<"frames" | "video">("frames");
  const [videoIdx,   setVideoIdx]   = useState(0);

  const p    = visit.patient;
  const grad = avatarGradient(p.firstName + p.lastName);
  const detectionFrames = allFrames.filter(f => f.hasDetection);
  const displayed = (filter === "detections" ? detectionFrames : allFrames)
    .filter(f => search === "" || String(f.frameIndex + 1) === search.trim());

  const showBoxes = filter === "detections";
  const showOverlay = filter === "overlay";

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && lbIdx === null) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, lbIdx]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", inset: "3vh 3vw", zIndex: 201,
          background: "#f8fafc", borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div style={{
          background: "#fff", borderBottom: "1px solid #e5e7eb",
          padding: "0.85rem 1.25rem",
          display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", background: grad, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff",
          }}>
            {initials(p)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>
              {p.firstName} {p.lastName}
            </p>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "0.1rem 0 0" }}>
              {visit.visitDate} · {visit.visitType} · {allFrames.length} frames
              {detectionFrames.length > 0 && (
                <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 8 }}>
                  · {detectionFrames.length} with findings
                </span>
              )}
            </p>
          </div>

          {/* View mode + frame filter + search */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>

            {/* Frames / Video tabs */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: "2px" }}>
              <button type="button" onClick={() => setViewMode("frames")}
                style={{ padding: "4px 11px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: viewMode === "frames" ? "#fff" : "transparent", color: viewMode === "frames" ? "#1e3a5f" : "#6b7280", boxShadow: viewMode === "frames" ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                Frames
              </button>
              {videos.length > 0 && (
                <button type="button" onClick={() => setViewMode("video")}
                  style={{ padding: "4px 11px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: viewMode === "video" ? "#fff" : "transparent", color: viewMode === "video" ? "#1e3a5f" : "#6b7280", boxShadow: viewMode === "video" ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Video
                </button>
              )}
            </div>

            {/* Frame filter (only when in frames view) */}
            {viewMode === "frames" && (
              <>
                <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: "2px" }}>
                  {([
                    { id: "all",        label: "All Frames" },
                    { id: "detections", label: "Findings Only" },
                    ...(segmentationResults.length > 0 ? [{ id: "overlay", label: `Overlay · ${segmentationResults.length}` }] : []),
                  ] as { id: "all" | "detections" | "overlay"; label: string }[]).map(f => (
                    <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: filter === f.id ? "#fff" : "transparent", color: filter === f.id ? (f.id === "overlay" ? "#a855f7" : "#1e3a5f") : "#6b7280", boxShadow: filter === f.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text" placeholder="Frame #" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 11, fontFamily: "inherit", outline: "none", width: 80, background: "#fff", color: "#374151" }}
                />
              </>
            )}
          </div>

          <button type="button" onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "1px solid #e5e7eb",
              background: "#f8fafc", cursor: "pointer", fontSize: 18, color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>×</button>
        </div>

        {/* Content area */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "1rem 1.25rem",
          scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent",
        }}>
          {viewMode === "video" ? (
            /* ── Video section ── */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {videos.map((vid, i) => {
                const ext        = (vid.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
                const supported  = ["mp4", "webm", "ogg"].includes(ext);
                const frameCount = vid.frames.length || allFrames.length;
                const findings   = vid.frames.filter(f => f.hasDetection).length || allFrames.filter(f => f.hasDetection).length;

                return (
                  <div key={vid.id} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

                    {supported ? (
                      /* ── Playable video ── */
                      <div style={{ background: "#0f172a", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
                        <video src={vid.storageUrl} controls preload="metadata"
                          style={{ width: "100%", maxHeight: "60vh", display: "block" }} />
                      </div>
                    ) : (
                      /* ── Non-playable: download card ── */
                      <div style={{
                        background: "#fff", borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                        overflow: "hidden",
                      }}>
                        {/* Top banner */}
                        <div style={{
                          background: "linear-gradient(135deg, #1e293b 0%, #1e3a5f 100%)",
                          padding: "2.5rem 2rem",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem",
                        }}>
                          <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: "rgba(255,255,255,0.07)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                              <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                              <line x1="2" y1="12" x2="22" y2="12"/>
                              <line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>
                              <line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>
                            </svg>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", margin: "0 0 0.3rem",
                              maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {vid.filename || "Original Video"}
                            </p>
                            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                              {frameCount} frames extracted · {visit.visitDate}
                            </p>
                          </div>
                        </div>

                        {/* Bottom action */}
                        <div style={{
                          padding: "1.25rem 1.5rem",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                              color: "#64748b", background: "#f1f5f9",
                              border: "1px solid #e2e8f0", borderRadius: 5, padding: "3px 9px",
                            }}>
                              .{ext.toUpperCase()}
                            </span>
                            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                              Cannot be played in browser — use VLC or any media player
                            </p>
                          </div>
                          <a
                            href={vid.storageUrl}
                            download={vid.filename ?? "video"}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0,
                              padding: "0.55rem 1.25rem", borderRadius: 8, textDecoration: "none",
                              background: "linear-gradient(135deg, #1e3a5f 0%, #2563EB 100%)",
                              color: "#fff", fontSize: 12, fontWeight: 700,
                              boxShadow: "0 2px 12px rgba(37,99,235,0.35)",
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Info strip */}
                    <div style={{
                      background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
                      padding: "0.7rem 1rem",
                      display: "flex", alignItems: "center", gap: "0.75rem",
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {vid.filename || "Original Video"}
                        </p>
                        <p style={{ fontSize: 10, color: "#6b7280", margin: "0.1rem 0 0" }}>
                          {frameCount} frames extracted · {visit.visitDate} · {visit.visitType}
                        </p>
                      </div>
                      {videos.length > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", background: "#ede9fe", borderRadius: 5, padding: "2px 8px" }}>
                          Video {i + 1}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : showOverlay ? (
            /* ── Overlay / Segmentation grid ── */
            <>
              {/* Overlay lightbox */}
              {overlayLbIdx !== null && segmentationResults[overlayLbIdx] && (
                <div onClick={() => setOverlayLbIdx(null)}
                  style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
                  <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
                    <img src={segmentationResults[overlayLbIdx].overlayUrl!}
                      alt={`Segmentation ${overlayLbIdx + 1}`}
                      style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, display: "block", objectFit: "contain" }} />
                    {/* Prev */}
                    {overlayLbIdx > 0 && (
                      <button onClick={() => setOverlayLbIdx(overlayLbIdx - 1)}
                        style={{ position: "absolute", left: -48, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                    )}
                    {/* Next */}
                    {overlayLbIdx < segmentationResults.length - 1 && (
                      <button onClick={() => setOverlayLbIdx(overlayLbIdx + 1)}
                        style={{ position: "absolute", right: -48, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                    )}
                    {/* Close */}
                    <button onClick={() => setOverlayLbIdx(null)}
                      style={{ position: "absolute", top: -14, right: -14, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    {/* Download */}
                    <a href={segmentationResults[overlayLbIdx].overlayUrl!} download={`segmentation_${overlayLbIdx + 1}.jpg`}
                      onClick={e => e.stopPropagation()}
                      style={{ position: "absolute", bottom: -42, right: 0, background: "#a855f7", color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </a>
                  </div>
                </div>
              )}

              {segmentationResults.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem", paddingTop: "3rem" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                  <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>No live-session segmentations yet</p>
                  <p style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 400, textAlign: "center", maxWidth: 260 }}>
                    Pause a live video frame, click a detection box, and run segmentation to populate this section.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "center" }}>
                  {segmentationResults.map((m, i) => (
                    <div key={m.id} style={{ width: 185, flexShrink: 0, cursor: "pointer" }} onClick={() => setOverlayLbIdx(i)}>
                      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#0f172a", border: "1px solid #a855f744", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 18px rgba(168,85,247,0.35)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
                        <img src={m.overlayUrl!} alt={`Segmentation ${i + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                        <div style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(168,85,247,0.88)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, display: "flex", alignItems: "center", gap: 3 }}>
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          Live Frame Seg
                        </div>
                        <a href={m.overlayUrl!} download={`segmentation_${i + 1}.jpg`} onClick={e => e.stopPropagation()}
                          style={{ position: "absolute", top: 5, right: 5, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 4, padding: "3px 5px", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                          title="Download">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : displayed.length === 0 ? (
            /* ── Empty state ── */
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: "0.75rem",
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>No frames found</p>
            </div>
          ) : (
            /* ── Frames grid — each video in its own folder section ── */
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {uniqueMedia.map((m, mi) => {
                const groupFrames = displayed.filter(f => (f as any)._mediaIdx === mi);
                if (groupFrames.length === 0) return null;
                const findingsCount = groupFrames.filter(f => f.hasDetection).length;
                return (
                  <div key={m.id} style={{
                    background: "#fff", borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                  }}>
                    {/* Video folder header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.65rem",
                      padding: "0.7rem 1rem",
                      background: "linear-gradient(135deg, #1e3a5f 0%, #1D4ED8 100%)",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 800, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Video {mi + 1}{m.filename ? ` · ${m.filename}` : ""}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", margin: "0.1rem 0 0" }}>
                          {groupFrames.length} frame{groupFrames.length !== 1 ? "s" : ""}
                          {findingsCount > 0 && (
                            <span style={{ marginLeft: 6, color: "#fca5a5", fontWeight: 700 }}>
                              · {findingsCount} finding{findingsCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      {videos.length > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.15)", borderRadius: 5, padding: "2px 8px", flexShrink: 0 }}>
                          {mi + 1} / {videos.length}
                        </span>
                      )}
                    </div>
                    {/* Frames inside this video */}
                    <div style={{ padding: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "flex-start" }}>
                      {groupFrames.map(frame => {
                        const globalIdx = displayed.indexOf(frame);
                        return (
                          <div key={frame.id} style={{ width: 185, flexShrink: 0 }}>
                            <FrameThumb
                              frame={frame}
                              showBoxes={showBoxes}
                              onClick={() => setLbIdx(globalIdx)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer stats */}
        <div style={{
          flexShrink: 0, padding: "0.6rem 1.25rem",
          background: "#fff", borderTop: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", gap: "1.5rem",
        }}>
          {viewMode === "video" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563EB" }} />
                <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Source video{videos.length > 1 ? "s" : ""}:</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB" }}>{videos.length}</span>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>
                Download to play AVI · MP4/WebM play directly in browser
              </span>
            </>
          ) : (
            <>
              {videos.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1D4ED8" }} />
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Videos:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#1D4ED8" }}>{videos.length}</span>
                </div>
              )}
              {([
                ["Total",         allFrames.length,                          "#2563EB"],
                ["With Findings", detectionFrames.length,                    "#ef4444"],
                ["Clean",         allFrames.length - detectionFrames.length, "#2563EB"],
              ] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{l}:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{v}</span>
                </div>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 10, color: showBoxes ? "#2563EB" : "#9ca3af", fontWeight: showBoxes ? 600 : 400 }}>
                {showBoxes ? "Detection boxes active" : "Click a frame to enlarge · ← → to navigate"}
              </span>
            </>
          )}
        </div>
      </div>

      {lbIdx !== null && (
        <Lightbox
          frames={displayed}
          index={lbIdx}
          showBoxes={showBoxes}
          onClose={() => setLbIdx(null)}
          onPrev={() => setLbIdx(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLbIdx(i => (i !== null && i < displayed.length - 1 ? i + 1 : i))}
        />
      )}
    </>
  );
}

// ─── Patient Folder Card ──────────────────────────────────────────────────────
function PatientFolderCard({ group, onClick }: { group: PatientGroup; onClick: () => void }) {
  const [hov,      setHov]      = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const p         = group.patient;
  const grad      = avatarGradient(p.firstName + p.lastName);
  const allFrames = group.visits.flatMap(v => deduplicateMedia(v.media).flatMap(m => m.frames));
  // pick first frame that has a non-empty frameUrl
  const thumbnail = allFrames.find(f => !!f.frameUrl)?.frameUrl ?? null;
  const findings  = allFrames.filter(f => f.hasDetection).length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 14, border: `1px solid ${hov ? "#2563EB" : "#e5e7eb"}`,
        background: "#fff", cursor: "pointer", overflow: "hidden",
        boxShadow: hov ? "0 8px 32px rgba(37,99,235,0.15)" : "0 2px 8px rgba(0,0,0,0.05)",
        transform: hov ? "translateY(-2px)" : "none", transition: "all 0.2s",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 130, background: (thumbnail && !thumbErr) ? "#000" : "#f1f5f9",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {thumbnail && !thumbErr ? (
          <img
            src={thumbnail} alt="thumb"
            onError={() => setThumbErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {/* gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 40%, transparent)" }} />
        <div style={{
          position: "absolute", bottom: 6, right: 6,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
        }}>
          {group.visits.length} visit{group.visits.length !== 1 ? "s" : ""} · {allFrames.length} frames
        </div>
        {findings > 0 && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(239,68,68,0.9)", color: "#fff",
            fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 8,
          }}>
            {findings} findings
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "0.7rem 0.85rem", display: "flex", alignItems: "center", gap: "0.55rem" }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: grad, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: "#fff",
        }}>
          {initials(p)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 13, fontWeight: 800, color: "#1e3a5f", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {p.firstName} {p.lastName}
          </p>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0.1rem 0 0", fontWeight: 500 }}>
            {group.visits.length} visit{group.visits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <svg
          style={{ flexShrink: 0, opacity: hov ? 1 : 0.35, transition: "opacity 0.15s" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Delete Visit Modal ───────────────────────────────────────────────────────
const DELETE_STEPS = [
  "Removing frames…",
  "Clearing analysis records…",
  "Finalizing…",
];

function DeleteVisitModal({
  visit, phase, stepIdx, onConfirm, onCancel,
}: {
  visit: GalleryVisit;
  phase: "idle" | "deleting" | "done";
  stepIdx: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const deleting = phase === "deleting";
  const done     = phase === "done";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "2rem",
        width: "100%", maxWidth: 400,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", gap: "1.25rem",
        transition: "all 0.3s",
      }}>
        {/* Icon */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {done ? (
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "#fef2f2", border: "1px solid #fecaca",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {deleting ? (
                <div style={{ width: 22, height: 22, border: "3px solid #fca5a5", borderTopColor: "#ef4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ textAlign: "center" }}>
          {done ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#15803d", margin: "0 0 0.35rem" }}>
                Visit Deleted
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                The visit and all its data have been removed successfully.
              </p>
            </>
          ) : deleting ? (
            <>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: "0 0 0.65rem" }}>
                Deleting…
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {DELETE_STEPS.map((s, i) => {
                  const finished = i < stepIdx;
                  const active   = i === stepIdx;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "center" }}>
                      {finished ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : active ? (
                        <div style={{ width: 11, height: 11, border: "2px solid #e5e7eb", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: active ? 700 : 400,
                        color: finished ? "#2563EB" : active ? "#1e293b" : "#94a3b8",
                        transition: "color 0.2s",
                      }}>
                        {s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: "0 0 0.4rem", fontFamily: "var(--font-display, inherit)" }}>
                Delete Visit
              </p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.55 }}>
                You are about to permanently delete{" "}
                <strong style={{ color: "#1e293b" }}>{visit.visitType}</strong>{" "}
                from <strong style={{ color: "#1e293b" }}>{visit.visitDate}</strong>{" "}
                including all frames, analyses, and reports. This action cannot be undone.
              </p>
            </>
          )}
        </div>

        {/* Buttons — only on idle state */}
        {!deleting && !done && (
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button type="button" onClick={onCancel}
              style={{
                flex: 1, padding: "0.65rem", borderRadius: 9,
                border: "1px solid #e2e8f0", background: "#f8fafc",
                color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}>
              Cancel
            </button>
            <button type="button" onClick={onConfirm}
              style={{
                flex: 1, padding: "0.65rem", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                boxShadow: "0 4px 14px rgba(239,68,68,0.4)", transition: "all 0.15s",
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Visit Folder Card ────────────────────────────────────────────────────────
function VisitFolderCard({
  visit, onClick, onDelete,
}: {
  visit: GalleryVisit;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const [hov,         setHov]         = useState(false);
  const [confirm,     setConfirm]     = useState(false);
  const [deletePhase, setDeletePhase] = useState<"idle" | "deleting" | "done">("idle");
  const [stepIdx,     setStepIdx]     = useState(0);
  const [thumbErr,    setThumbErr]    = useState(false);
  const dedupMedia = deduplicateMedia(visit.media);
  const allFrames  = dedupMedia.flatMap(m => m.frames);
  const thumbnail  = allFrames.find(f => !!f.frameUrl)?.frameUrl ?? null;
  const findings   = allFrames.filter(f => f.hasDetection).length;
  const videoCount = dedupMedia.filter(m => m.mediaType === "video").length;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletePhase("idle");
    setStepIdx(0);
    setConfirm(true);
  };

  const confirmDelete = async () => {
    setDeletePhase("deleting");
    setStepIdx(0);

    const t1 = setTimeout(() => setStepIdx(1), 1400);
    const t2 = setTimeout(() => setStepIdx(2), 2900);

    try {
      await fetch(`/api/visits/${visit.id}`, { method: "DELETE" });
      clearTimeout(t1); clearTimeout(t2);
      setStepIdx(DELETE_STEPS.length); // all green
      setDeletePhase("done");
      setTimeout(() => onDelete(visit.id), 950);
    } catch {
      clearTimeout(t1); clearTimeout(t2);
      setDeletePhase("idle");
      setConfirm(false);
    }
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 12, border: `1px solid ${hov ? "#2563EB" : "#e5e7eb"}`,
        background: "#fff", cursor: "pointer", overflow: "hidden",
        boxShadow: hov ? "0 6px 24px rgba(37,99,235,0.15)" : "0 2px 6px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-2px)" : "none", transition: "all 0.2s",
        opacity: deletePhase !== "idle" ? 0.5 : 1,
      }}
    >
      <div style={{
        height: 110, background: (thumbnail && !thumbErr) ? "#000" : "#f1f5f9",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {thumbnail && !thumbErr ? (
          <img
            src={thumbnail} alt="thumb"
            onError={() => setThumbErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 40%, transparent)" }} />
        <div style={{
          position: "absolute", bottom: 5, right: 5,
          background: "rgba(0,0,0,0.7)", color: "#fff",
          fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 8,
        }}>
          {allFrames.length} frames
        </div>
        {videoCount > 1 && (
          <div style={{
            position: "absolute", bottom: 5, left: 5,
            background: "rgba(29,78,216,0.9)", color: "#fff",
            fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 8,
          }}>
            {videoCount} videos
          </div>
        )}
        {findings > 0 && (
          <div style={{
            position: "absolute", top: 5, right: 5,
            background: "rgba(239,68,68,0.9)", color: "#fff",
            fontSize: 7, fontWeight: 800, padding: "2px 5px", borderRadius: 7,
          }}>
            {findings} findings
          </div>
        )}
        {/* Delete button */}
        {hov && deletePhase === "idle" && (
          <button
            type="button"
            onClick={handleDelete}
            style={{
              position: "absolute", top: 5, left: 5,
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(239,68,68,0.85)", border: "none",
              color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Delete visit"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}
        {deletePhase === "deleting" && (
          <div style={{
            position: "absolute", top: 5, left: 5,
            width: 24, height: 24, borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff", borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
          </div>
        )}
      </div>
      <div style={{ padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>{visit.visitType}</p>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0.1rem 0 0", fontWeight: 500 }}>{visit.visitDate}</p>
        </div>
        <svg
          style={{ flexShrink: 0, opacity: hov ? 1 : 0.35, transition: "opacity 0.15s" }}
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {confirm && createPortal(
        <DeleteVisitModal
          visit={visit}
          phase={deletePhase}
          stepIdx={stepIdx}
          onConfirm={confirmDelete}
          onCancel={() => { if (deletePhase === "idle") setConfirm(false); }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GalleryPage() {
  const [visits,   setVisits]  = useState<GalleryVisit[]>([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState("");
  const [selPatient, setPatient] = useState<PatientGroup | null>(null);
  const [selVisit,   setVisit]   = useState<GalleryVisit | null>(null);
  // keep a stable ref to the current patient id so handleDeleteVisit can read it
  const selPatientIdRef = React.useRef<string | null>(null);
  selPatientIdRef.current = selPatient?.patient.id ?? null;

  const fetchGallery = React.useCallback((opts?: { silent?: boolean }) => {
    const stored = localStorage.getItem("doctor");
    const doctor = stored ? JSON.parse(stored) : null;
    if (!doctor?.id) { if (!opts?.silent) setLoading(false); return; }
    if (!opts?.silent) setLoading(true);
    fetch(`/api/gallery?doctorId=${doctor.id}`)
      .then(r => r.json())
      .then(d => {
        const fresh: GalleryVisit[] = d.visits ?? [];
        setVisits(fresh);

        // If patient was selected, check if they still have visits; if not → go back
        const pid = selPatientIdRef.current;
        if (pid) {
          const stillHasVisits = fresh.some(v => v.patient.id === pid && v.media.some(m => m.frames.length > 0));
          if (!stillHasVisits) setPatient(null);
        }
      })
      .catch(() => {})
      .finally(() => { if (!opts?.silent) setLoading(false); });
  }, []);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  const handleDeleteVisit = (visitId: string) => {
    // Immediately close any open viewer
    setVisit(null);
    // Silent re-fetch — refreshes the grid, auto-back to patient list if now empty
    fetchGallery({ silent: true });
  };

  // Group visits by patient (only those with frames)
  const patientMap = new Map<string, PatientGroup>();
  for (const v of visits) {
    if (!v.media.some(m => m.frames.length > 0)) continue;
    if (!patientMap.has(v.patient.id)) {
      patientMap.set(v.patient.id, { patient: v.patient, visits: [] });
    }
    patientMap.get(v.patient.id)!.visits.push(v);
  }
  const allPatients = Array.from(patientMap.values());

  const filteredPatients = allPatients.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.patient.firstName.toLowerCase().includes(q) ||
      g.patient.lastName.toLowerCase().includes(q)
    );
  });

  const filteredVisits = (selPatient?.visits ?? []).filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.visitDate.includes(q) || v.visitType.toLowerCase().includes(q);
  });

  const totalFrames   = allPatients.reduce((s, g) => s + g.visits.flatMap(v => v.media.flatMap(m => m.frames)).length, 0);
  const totalFindings = allPatients.reduce((s, g) => s + g.visits.flatMap(v => v.media.flatMap(m => m.frames)).filter(f => f.hasDetection).length, 0);
  const totalVisits   = allPatients.reduce((s, g) => s + g.visits.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header / breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.15rem" }}>
            <span
              onClick={() => { setPatient(null); setSearch(""); }}
              style={{
                fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em",
                color: selPatient ? "#2563EB" : "var(--ink)",
                cursor: selPatient ? "pointer" : "default",
                fontFamily: "var(--font-display)",
              }}
            >
              Media Gallery
            </span>
            {selPatient && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  {selPatient.patient.firstName} {selPatient.patient.lastName}
                </span>
              </>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            {selPatient
              ? `${filteredVisits.length} visit${filteredVisits.length !== 1 ? "s" : ""}`
              : "Video frames organised by patient"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {selPatient && (
            <button
              type="button"
              onClick={() => { setPatient(null); setSearch(""); }}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                padding: "0.4rem 0.85rem", borderRadius: 8,
                border: "1px solid #e2e8f0", background: "#fff",
                color: "#6b7280", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              All Patients
            </button>
          )}
          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder={selPatient ? "Filter visits…" : "Search patient…"}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 12,
                fontFamily: "inherit", outline: "none", background: "#fff",
                color: "#374151", width: 210, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Stats (top level only) ── */}
      {!loading && !selPatient && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {([
            ["Patients",      allPatients.length, "#2563EB"],
            ["Total Visits",  totalVisits,         "#1D4ED8"],
            ["Frames",        totalFrames,         "#64748b"],
            ["With Findings", totalFindings,       "#ef4444"],
          ] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{
              background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
              padding: "0.5rem 0.9rem", display: "flex", alignItems: "center", gap: "0.5rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{l}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: "0.75rem", padding: "4rem 0",
        }}>
          <div style={{
            width: 32, height: 32, border: "3px solid #e5e7eb",
            borderTopColor: "#2563EB", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>Loading gallery…</p>
        </div>

      ) : !selPatient ? (
        /* ── Patient folder grid ── */
        filteredPatients.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "0.75rem", padding: "4rem 0",
            background: "#fff", borderRadius: 14, border: "1px dashed #e2e8f0",
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21"/>
            </svg>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>
                {search ? "No patients match your search" : "No video frames yet"}
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0.25rem 0 0" }}>
                {search ? "Try a different name" : "Process a live endoscopy video to populate the gallery"}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {filteredPatients.map(group => (
              <PatientFolderCard
                key={group.patient.id}
                group={group}
                onClick={() => { setPatient(group); setSearch(""); }}
              />
            ))}
          </div>
        )

      ) : (
        /* ── Visit folder grid for selected patient ── */
        filteredVisits.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "0.75rem", padding: "4rem 0",
            background: "#fff", borderRadius: 14, border: "1px dashed #e2e8f0",
          }}>
            <p style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>No visits found</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
            {filteredVisits.map(visit => (
              <VisitFolderCard
                key={visit.id}
                visit={visit}
                onClick={() => setVisit(visit)}
                onDelete={handleDeleteVisit}
              />
            ))}
          </div>
        )
      )}

      {/* ── Visit frame viewer modal ── */}
      {selVisit && (
        <VisitViewer visit={selVisit} onClose={() => setVisit(null)} />
      )}
    </div>
  );
}
