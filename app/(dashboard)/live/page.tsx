
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  type AnalysisState, type Severity, type XaiMethod,
  type Detection, type AnalysisResult,
  MOCK_LIVE_DETECTIONS, severityStyle,
} from "@/lib/data";

// ─── Guest helpers ────────────────────────────────────────────────────────────
const GUEST_LIMIT = 3;
const GUEST_KEY   = "guestDetections";
const getGuestCount = () => { try { return parseInt(localStorage.getItem(GUEST_KEY) ?? "0", 10) || 0; } catch { return 0; } };
const incGuestCount = () => { try { localStorage.setItem(GUEST_KEY, String(getGuestCount() + 1)); } catch {} };

interface ReportDraft {
  clinicalNotes: string;
  conclusion: string;
  recommendation: string;
}

function patientAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

interface FrameData {
  id:               string;
  frameIndex:       number;
  timestampSeconds: number;
  frameUrl:         string;
  hasDetection:     boolean;
}

interface ProcessedFrame {
  frameIndex:    number;
  frameUrl:      string;
  hasDetection:  boolean;
  overallRisk:   string;
  annotatedUrl:  string | null;
  gradcamUrl:    string | null;
  overlayUrl:    string | null;
  overlayBase64: string | null;
  detections:    any[];
  segments:      any[];
}

interface SessionItem {
  id:           string;
  file:         File;
  preview:      string;
  annotatedUrl: string | null;
  overlayUrl:   string | null;
  detections:   Detection[];
  segments:     any[];
  overallRisk:  string;
  analysisType: "detection" | "segmentation";
  analysisId:   string | null;
  mediaId:      string | null;
  gradcamInterp: string | null;
}

// ─── Video processing constants ───────────────────────────────────────────────
const EXTRACTION_FPS    = 2;            // frames extracted per second of video
const FRAME_INTERVAL_MS = 250;          // playback delay between displayed frames
const FRAME_INTERVAL_S  = FRAME_INTERVAL_MS / 1000;
const FETCH_CONCURRENCY = 3;            // parallel frame detection requests

// ─── Caliper / Ruler tool ─────────────────────────────────────────────────────
// SVG uses viewBox "0 0 160 90" (16:9) so 1 unit = 1% of each axis with no distortion.
// Physical estimate: typical colonoscope FOV width ≈ 30 mm at standard working distance.
const RULER_W = 160; // viewBox width  (= 16 proportional units)
const RULER_H = 90;  // viewBox height (= 9 proportional units)
const FOV_W_MM = 30; // estimated endoscope field-of-view width in mm

type RulerLine_t = { x1: number; y1: number; x2: number; y2: number };

function rulerMeasure(l: RulerLine_t) {
  const dxN = (l.x2 - l.x1) / RULER_W;
  const dyN = (l.y2 - l.y1) / RULER_H;
  const wMm    = Math.abs(dxN) * FOV_W_MM;
  const hMm    = Math.abs(dyN) * FOV_W_MM * (RULER_H / RULER_W); // correct for aspect
  const totalMm = Math.sqrt(wMm * wMm + hMm * hMm);
  return { wMm, hMm, totalMm };
}

const RLABEL_W = 30, RLABEL_H = 13; // label bounding box in SVG units

function resolveRulerLabels(lines: RulerLine_t[]): { dx: number; dy: number }[] {
  const offsets = lines.map(() => ({ dx: 0, dy: 0 }));
  const centers = lines.map(l => ({ x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 }));
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const ax = centers[i].x + offsets[i].dx, ay = centers[i].y + offsets[i].dy;
        const bx = centers[j].x + offsets[j].dx, by = centers[j].y + offsets[j].dy;
        const ox = Math.abs(ax - bx), oy = Math.abs(ay - by);
        if (ox < RLABEL_W && oy < RLABEL_H) {
          moved = true;
          const push = (RLABEL_H - oy) / 2 + 1.5;
          if (ay <= by) { offsets[i].dy -= push; offsets[j].dy += push; }
          else          { offsets[i].dy += push; offsets[j].dy -= push; }
        }
      }
    }
    if (!moved) break;
  }
  return offsets;
}

function RulerLineEl({ l, color = "#000000", draft = false, labelOff }: {
  l: RulerLine_t; color?: string; draft?: boolean;
  labelOff?: { dx: number; dy: number };
}) {
  const mx = (l.x1 + l.x2) / 2;
  const my = (l.y1 + l.y2) / 2;
  const lx = mx + (labelOff?.dx ?? 0);
  const ly = my + (labelOff?.dy ?? 0);
  const m  = rulerMeasure(l);

  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len * 3, ny = dx / len * 3;

  const hasLeader = !draft && labelOff && (Math.abs(labelOff.dx) > 3 || Math.abs(labelOff.dy) > 3);

  return (
    <g>
      {/* Main line */}
      <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
        stroke={color} strokeWidth="0.6" strokeDasharray={draft ? "2 1" : undefined} strokeLinecap="round" />
      {/* Endpoint ticks */}
      {!draft && <>
        <line x1={l.x1 + nx} y1={l.y1 + ny} x2={l.x1 - nx} y2={l.y1 - ny} stroke={color} strokeWidth="0.7" strokeLinecap="round" />
        <line x1={l.x2 + nx} y1={l.y2 + ny} x2={l.x2 - nx} y2={l.y2 - ny} stroke={color} strokeWidth="0.7" strokeLinecap="round" />
      </>}
      {/* Endpoint dots */}
      <circle cx={l.x1} cy={l.y1} r="1.2" fill={color} />
      <circle cx={l.x2} cy={l.y2} r="1.2" fill={color} />
      {/* Leader line from midpoint to displaced label */}
      {hasLeader && (
        <line x1={mx} y1={my} x2={lx} y2={ly}
          stroke={color} strokeWidth="0.35" strokeDasharray="1 0.6" opacity="0.55" />
      )}
      {/* Label — white bg, black text */}
      <rect x={lx - RLABEL_W / 2} y={ly - RLABEL_H / 2} width={RLABEL_W} height={RLABEL_H}
        fill="rgba(255,255,255,0.93)" rx="2" />
      <text x={lx} y={ly - 1} textAnchor="middle" fontSize="3.5" fill="#000" fontWeight="bold" fontFamily="monospace">
        ~{m.totalMm.toFixed(1)} mm
      </text>
      <text x={lx} y={ly + 4.2} textAnchor="middle" fontSize="2.3" fill="#444" fontFamily="monospace">
        W {m.wMm.toFixed(1)} · H {m.hMm.toFixed(1)}
      </text>
    </g>
  );
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
      <div style={{ flex: 1, height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

// ─── Detection Boxes (SVG overlay) ───────────────────────────────────────────

// Label can go above the box, below it, or inside it (top edge) as last resort.
type LabelPos = "above" | "below" | "inside";

function assignLabelPositions(detections: Detection[]): (Detection & { labelPos: LabelPos })[] {
  type R = { x1: number; y1: number; x2: number; y2: number };
  const occupied: R[] = [];
  const overlaps = (a: R, b: R) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const H = 9.5;

  return detections.map(d => {
    const above:  R = { x1: d.x, y1: d.y - H,      x2: d.x + d.w, y2: d.y         };
    const below:  R = { x1: d.x, y1: d.y + d.h,    x2: d.x + d.w, y2: d.y + d.h + H };
    const inside: R = { x1: d.x, y1: d.y,           x2: d.x + d.w, y2: d.y + H     };

    const aboveOk  = d.y >= H           && !occupied.some(r => overlaps(above,  r));
    const belowOk  = d.y + d.h + H <= 100 && !occupied.some(r => overlaps(below,  r));
    const insideOk = d.h >= H           && !occupied.some(r => overlaps(inside, r));

    let labelPos: LabelPos;
    let chosen: R;
    if      (aboveOk)  { labelPos = "above";  chosen = above;  }
    else if (belowOk)  { labelPos = "below";  chosen = below;  }
    else if (insideOk) { labelPos = "inside"; chosen = inside; }
    else               { labelPos = "inside"; chosen = inside; } // always safe fallback

    occupied.push(chosen);
    return { ...d, labelPos };
  });
}

const DET_PALETTE = [
  "#06b6d4", "#f59e0b", "#8b5cf6", "#1D4ED8",
  "#3b82f6", "#f97316", "#a3e635", "#ec4899",
];

function DetectionBoxes({ detections, activeId, onSelect, svgStyle }: {
  detections: Detection[]; activeId: number | null; onSelect: (id: number) => void;
  svgStyle?: React.CSSProperties;
}) {
  const swBase    = 0.5;
  const swActive  = 0.7;
  const swCorner  = 0.85;
  const doShowConf = true;

  const withPos = assignLabelPositions(detections);
  const sorted = [...withPos].sort((a, b) =>
    a.id === activeId ? 1 : b.id === activeId ? -1 : 0
  );

  return (
    <svg
      style={svgStyle ?? { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {sorted.map(d => {
        const color  = DET_PALETTE[d.id % DET_PALETTE.length];
        const active = activeId === d.id;
        const cLen   = Math.min(d.w, d.h) * 0.22;
        const labelY =
          d.labelPos === "above"  ? d.y - 9 :
          d.labelPos === "below"  ? d.y + d.h + 0.3 :
          d.y + 0.3;
        const textY =
          d.labelPos === "above"  ? d.y - 5.5 :
          d.labelPos === "below"  ? d.y + d.h + 3.8 :
          d.y + 3.8;
        const dimY =
          d.labelPos === "above"  ? d.y - 2.0 :
          d.labelPos === "below"  ? d.y + d.h + 7.3 :
          d.y + 7.3;
        return (
          <g key={d.id} style={{ pointerEvents: "all", cursor: "pointer" }} onClick={() => onSelect(d.id)}>
            {/* Dashed main rect */}
            <rect
              x={d.x} y={d.y} width={d.w} height={d.h}
              fill="none" stroke={color}
              strokeWidth={active ? swActive : swBase}
              strokeDasharray="2 1.5"
              opacity={active ? 0.9 : 0.7}
              rx="0.5"
            />
            {/* Solid L-corner measurement markers */}
            {([
              `${d.x},${d.y + cLen} ${d.x},${d.y} ${d.x + cLen},${d.y}`,
              `${d.x + d.w - cLen},${d.y} ${d.x + d.w},${d.y} ${d.x + d.w},${d.y + cLen}`,
              `${d.x},${d.y + d.h - cLen} ${d.x},${d.y + d.h} ${d.x + cLen},${d.y + d.h}`,
              `${d.x + d.w - cLen},${d.y + d.h} ${d.x + d.w},${d.y + d.h} ${d.x + d.w},${d.y + d.h - cLen}`,
            ] as string[]).map((pts, i) => (
              <polyline key={i} points={pts} fill="none" stroke={color}
                strokeWidth={active ? swCorner * 1.3 : swCorner} strokeLinecap="round" />
            ))}
            {/* Label — only when showConf is on */}
            {doShowConf && (
              <>
                <rect x={d.x} y={labelY} width={d.w} height={9} fill={color} opacity={0.93} rx="0.8" />
                <text x={d.x + d.w / 2} y={textY} textAnchor="middle" fontSize="2.4" fill="#fff" fontWeight="bold">
                  {d.label} · {d.confidence}%
                </text>
                <text x={d.x + d.w / 2} y={dimY} textAnchor="middle" fontSize="2.0" fill="rgba(255,255,255,0.82)" fontWeight="600" fontStyle="italic">
                  W {d.w.toFixed(1)}%  ·  H {d.h.toFixed(1)}%
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function XaiOverlay({ detections, activeId }: { detections: Detection[]; activeId: number | null; }) {
  return (
    <>
      {detections.map(d => {
        const s = severityStyle(d.severity);
        if (d.gradcamBase64) return (
          <img key={d.id} src={d.gradcamBase64} alt="gradcam"
            style={{
              position: "absolute", left: `${d.x}%`, top: `${d.y}%`,
              width: `${d.w}%`, height: `${d.h}%`, objectFit: "cover", borderRadius: 3,
              opacity: activeId === null || activeId === d.id ? 0.75 : 0.2,
              pointerEvents: "none", transition: "opacity 0.2s",
            }} />
        );
        return (
          <svg key={d.id} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs><filter id={`b${d.id}`}><feGaussianBlur stdDeviation="2" /></filter></defs>
            <rect x={d.x + 1} y={d.y + 1} width={d.w - 2} height={d.h - 2} fill={s.dot}
              opacity={activeId === null || activeId === d.id ? 0.3 : 0.1}
              filter={`url(#b${d.id})`} rx="1" />
          </svg>
        );
      })}
    </>
  );
}

// ─── Patient Strip ────────────────────────────────────────────────────────────
function PatientStrip({ patient, visit }: { patient: any; visit: any }) {
  if (!patient) return null;
  const age = patient.dateOfBirth ? patientAge(patient.dateOfBirth) : null;
  const initials = `${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
      border: "1px solid #bfdbfe", borderRadius: 12,
      padding: "0.7rem 1rem", marginBottom: "1rem",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800, color: "#fff",
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>
          {patient.firstName} {patient.lastName}
        </p>
        <p style={{ fontSize: 11, color: "#3b82f6", margin: "0.1rem 0 0", fontWeight: 500 }}>
          {[age !== null && `${age} yrs`, patient.gender, patient.condition, visit?.visitType, visit?.visitDate].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
        Linked
      </span>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function uploadMedia(
  file: File, visitId: string, doctorId?: string,
  extras?: { annotatedB64?: string | null; gradcamB64?: string | null; overlayB64?: string | null; captureSource?: string; }
): Promise<string | null> {
  try {
    const mf = new FormData();
    mf.append("file", file);
    if (doctorId)               mf.append("doctorId",      doctorId);
    if (extras?.annotatedB64)   mf.append("annotatedB64",  extras.annotatedB64);
    if (extras?.gradcamB64)     mf.append("gradcamB64",    extras.gradcamB64);
    if (extras?.overlayB64)     mf.append("overlayB64",    extras.overlayB64);
    if (extras?.captureSource)  mf.append("captureSource", extras.captureSource);
    const mr = await fetch(`/api/visits/${visitId}/media`, { method: "POST", body: mf });
    if (!mr.ok) return null;
    const md = await mr.json();
    return md.media?.id ?? null;
  } catch { return null; }
}

async function saveAnalysis(payload: {
  visitId: string; mediaId: string | null; doctorId: string | undefined;
  analysisType: string; modelVersion: string; overallConfidence: number;
  overallRisk: string; framesWithDetection: number; rawOutput: string; detectedLesions: any[];
}): Promise<string | null> {
  try {
    const sr = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, status: "completed" }),
    });
    if (!sr.ok) return null;
    const sd = await sr.json();
    return sd.analysis?.id ?? null;
  } catch { return null; }
}

// ─── Grad-CAM interpretation via LLM ─────────────────────────────────────────
async function interpretGradcam(params: {
  gradcamBase64: string;
  detections: any[];
  analysisType: string;
  overallRisk: string;
  modelVersion: string;
}): Promise<string | null> {
  try {
    const res = await fetch("/api/ai/interpret-gradcam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.interpretation ?? null;
  } catch { return null; }
}

// ─── Multi-Image Report Panel ─────────────────────────────────────────────────
function MultiReportPanel({ session, patient, visit, visitId, onBack }: {
  session: SessionItem[]; patient: any; visit: any; visitId: string | null;
  onBack: () => void;
}) {
  type AllFinding = any & { imageIdx: number; imageLabel: string };
  const allFindings: AllFinding[] = session.flatMap((item, idx) => {
    const label = `Image ${idx + 1}`;
    return [
      ...item.detections.map(d => ({ ...d, imageIdx: idx, imageLabel: label })),
      ...item.segments.map(s => ({ ...s, imageIdx: idx, imageLabel: label })),
    ];
  });

  const primaryAnalysisId = session.find(i => i.analysisId)?.analysisId ?? null;

  // Which session items are included in the report (all by default)
  const [includedIds,  setIncludedIds]  = useState<Set<string>>(() => new Set(session.map(i => i.id)));
  const includedItems = session.filter(i => includedIds.has(i.id));

  const toggleInclude = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIncludedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const includedFindings: AllFinding[] = includedItems.flatMap((item, idx) => {
    const label = `Image ${idx + 1}`;
    return [
      ...item.detections.map(d => ({ ...d, imageIdx: idx, imageLabel: label })),
      ...item.segments.map(s => ({ ...s, imageIdx: idx, imageLabel: label })),
    ];
  });

  const worstRisk = includedItems.reduce((worst: string, item) => {
    const order: Record<string, number> = { normal: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return (order[item.overallRisk] ?? 0) > (order[worst] ?? 0) ? item.overallRisk : worst;
  }, "normal");

  const worstStyle = severityStyle(worstRisk as Severity);

  const [selectedIdx,  setSelectedIdx]  = useState(0);
  const [showGradcam,  setShowGradcam]  = useState(false);
  const [draft, setDraft] = useState(() => ({
    clinicalNotes: "",
    conclusion: allFindings.length > 0
      ? `${[...new Set(allFindings.map((f: any) => f.label ?? f.lesionType ?? "Finding"))].length} lesion(s) identified across ${session.length} endoscopic image(s). Findings: ${[...new Set(allFindings.map((f: any) => f.label ?? f.lesionType ?? "Finding"))].join(", ")}.`
      : `No pathological findings detected across ${session.length} analyzed endoscopic image(s). Appearance within normal limits.`,
    recommendation: allFindings.length > 0
      ? "Specialist gastroenterology review recommended. Targeted biopsy and follow-up colonoscopy advised within 3 months."
      : "Routine follow-up as clinically indicated. No immediate intervention required.",
  }));
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [error,         setError]         = useState("");
  const [doctor,        setDoctor]        = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const s = localStorage.getItem("doctor");
    if (s) { try { setDoctor(JSON.parse(s)); } catch {} }
  }, []);

  const handleSave = async () => {
    if (!visitId) { setError("No visit linked"); return; }
    if (includedItems.length === 0) { setError("Select at least one image to include in the report"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId:      patient?.id,
          visitId,
          analysisId:     includedItems.find(i => i.analysisId)?.analysisId ?? primaryAnalysisId,
          doctorId:       doctor?.id,
          title: `Endoscopy Report · ${includedItems.length} image(s) · ${new Date().toLocaleDateString()}`,
          clinicalNotes:  draft.clinicalNotes,
          conclusion:     draft.conclusion,
          recommendation: draft.recommendation,
          gradcamInterpretation: includedItems.map((item, idx) => item.gradcamInterp ? `[Image ${idx + 1}]: ${item.gradcamInterp}` : null).filter(Boolean).join("\n\n") || null,
          mediaIds: JSON.stringify(includedItems.map(i => i.mediaId).filter(Boolean)),
          status:         "draft",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(true);
        setSavedReportId(data?.report?.id ?? null);
      } else { const d = await res.json(); setError(d.error ?? "Failed to save"); }
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const selectedItem = session[selectedIdx];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.8rem", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Analysis
        </button>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>Endoscopy Report</h2>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0.1rem 0 0" }}>
            {includedIds.size}/{session.length} image{session.length !== 1 ? "s" : ""} selected · {includedFindings.length} finding{includedFindings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem", background: `${worstStyle.dot}18`, border: `1px solid ${worstStyle.dot}44`, borderRadius: 7, padding: "4px 12px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: worstStyle.dot }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: worstStyle.color }}>Overall: {worstStyle.label}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1rem", alignItems: "start" }}>

        {/* Left: image selector + findings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          {/* Thumbnails + selected image + heatmap */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                Analysed Images ({session.length})
              </p>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#1D4ED8", background: "#ede9fe", borderRadius: 4, padding: "1px 7px" }}>
                {includedIds.size} / {session.length} selected for report
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              {session.map((item, idx) => {
                const s       = severityStyle(item.overallRisk as Severity);
                const cnt     = item.detections.length + item.segments.length;
                const active  = selectedIdx === idx;
                const included = includedIds.has(item.id);
                return (
                  <div key={item.id} style={{ position: "relative", flexShrink: 0 }}>
                    <button type="button" onClick={() => { setSelectedIdx(idx); setShowGradcam(false); }}
                      style={{ position: "relative", padding: 0, border: `2px solid ${active ? s.dot : included ? "#e2e8f0" : "#e2e8f0"}`, borderRadius: 10, overflow: "visible", cursor: "pointer", background: "none", boxShadow: active ? `0 0 0 3px ${s.dot}33` : "none", transition: "all 0.15s", opacity: included ? 1 : 0.4 }}>
                      <img src={item.annotatedUrl ?? item.overlayUrl ?? item.preview}
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, display: "block" }} />
                      <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", background: s.dot, color: "#fff", fontSize: 7, fontWeight: 800, padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>
                        {cnt > 0 ? `${cnt} finding${cnt !== 1 ? "s" : ""}` : "Normal"}
                      </span>
                    </button>
                    {/* Include/exclude toggle */}
                    <button type="button" onClick={(e) => toggleInclude(item.id, e)}
                      title={included ? "Exclude from report" : "Include in report"}
                      style={{
                        position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%",
                        border: `2px solid ${included ? "#2563EB" : "#e2e8f0"}`,
                        background: included ? "#2563EB" : "#fff",
                        cursor: "pointer", padding: 0, zIndex: 2,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.15)", transition: "all 0.15s",
                      }}>
                      {included
                        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      }
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedItem && (
              <div style={{ marginTop: "0.75rem" }}>
                {/* 4-image grid: Original / Detection / Heatmap / Mucosal Analysis */}
                {(() => {
                  const gradcamB64 = selectedItem.detections[0]?.gradcamBase64 ?? null;
                  const panels: { label: string; src: string | null; color: string }[] = [
                    { label: "Original",         src: selectedItem.preview,      color: "#6b7280" },
                    { label: "Detection",         src: selectedItem.annotatedUrl, color: "#2563EB" },
                    { label: "Activation Map",    src: gradcamB64,                color: "#f59e0b" },
                    { label: "Mucosal Analysis",  src: selectedItem.overlayUrl,   color: "#a855f7" },
                  ];
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      {panels.map(p => (
                        <div key={p.label} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", background: "#0f172a", position: "relative" }}>
                          {p.src ? (
                            <img src={p.src} style={{ width: "100%", aspectRatio: "4/3", objectFit: "contain", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                              <span style={{ fontSize: 9, color: "#475569", fontWeight: 500 }}>Not available</span>
                            </div>
                          )}
                          <div style={{ position: "absolute", bottom: "0.35rem", left: "0.35rem", background: `${p.color}dd`, color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.03em" }}>
                            {p.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* All findings list with confidence bars */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.6rem" }}>
              Findings in selected images ({includedFindings.length})
            </p>
            {includedFindings.length === 0 ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#15803d", margin: 0 }}>No pathological findings in selected images</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {includedFindings.map((f: any, i: number) => {
                  const s = severityStyle((f.severity ?? "normal") as Severity);
                  return (
                    <div key={i} style={{ borderRadius: 8, padding: "0.5rem 0.65rem", border: "1px solid #e5e7eb", background: "#fafafa" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: "#6b7280", background: "#f1f5f9", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>{f.imageLabel}</span>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1f2937" }}>{f.label ?? f.lesionType ?? "Finding"}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 6px" }}>{s.label}</span>
                      </div>
                      {(f.location || f.area_pct) && (
                        <p style={{ fontSize: 9, color: "#6b7280", margin: "0.1rem 0 0 0.9rem" }}>
                          {[f.location, f.area_pct && `${f.area_pct}% area`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <ConfBar value={Math.round(f.confidence ?? 0)} color={s.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grad-CAM Interpretations — only for included items */}
          {includedItems.some(item => item.gradcamInterp) && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.6rem" }}>
                AI Interpretations
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {includedItems.map((item, idx) => item.gradcamInterp ? (
                  <div key={item.id}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", margin: "0 0 0.3rem" }}>Image {idx + 1}</p>
                    <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)", border: "1px solid #bfdbfe", borderRadius: 8, padding: "0.65rem 0.75rem" }}>
                      <p style={{ fontSize: 10.5, lineHeight: 1.65, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>
                        {item.gradcamInterp}
                      </p>
                    </div>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </div>

        {/* Right: report draft + save */}
        <div style={{ position: "sticky", top: 0, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.85rem 0.9rem", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)" }}>
            {patient && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {`${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1f2937", margin: 0 }}>{patient.firstName} {patient.lastName}</p>
                  {visit?.visitDate && <p style={{ fontSize: 9, color: "#9ca3af", margin: 0 }}>{visit.visitDate} · {visit.visitType}</p>}
                </div>
              </div>
            )}
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Report Draft</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem 0.9rem", scrollbarWidth: "thin" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {([
                { k: "clinicalNotes",  l: "Clinical Observations",   r: 3, p: "Describe endoscopic findings across all images..." },
                { k: "conclusion",     l: "Conclusion",               r: 3, p: "Diagnostic summary..." },
                { k: "recommendation", l: "Clinical Recommendation",  r: 2, p: "Management plan..." },
              ] as { k: keyof typeof draft; l: string; r: number; p: string }[]).map(({ k, l, r, p }) => (
                <div key={k}>
                  <label style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{l}</label>
                  <textarea rows={r} placeholder={p} value={draft[k]}
                    onChange={e => setDraft(prev => ({ ...prev, [k]: e.target.value }))}
                    style={{ width: "100%", borderRadius: 7, border: "1px solid #e5e7eb", padding: "0.4rem 0.6rem", fontSize: 11, resize: "none", fontFamily: "inherit", boxSizing: "border-box", outline: "none", background: "#fafafa", lineHeight: 1.5, color: "#374151", transition: "border-color 0.15s, background 0.15s" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fafafa"; }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "0.75rem 0.9rem", borderTop: "1px solid #f1f5f9", background: "#fff", boxShadow: "0 -4px 12px rgba(0,0,0,0.04)" }}>
            {error && <p style={{ fontSize: 10, color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.35rem 0.6rem", margin: "0 0 0.5rem" }}>{error}</p>}
            {saved ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>Report saved successfully</span>
                </div>
                {savedReportId && (
                  <button type="button" onClick={() => router.push(`/reports?patientId=${patient?.id ?? ""}&reportId=${savedReportId}`)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", boxShadow: "0 2px 10px rgba(37,99,235,0.35)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    View Report
                  </button>
                )}
              </div>
            ) : !visitId ? (
              <div style={{ background: "#fafafa", border: "1px dashed #d1d5db", borderRadius: 8, padding: "0.6rem", textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>No visit linked — open from a visit to save</span>
              </div>
            ) : (
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ width: "100%", padding: "0.7rem", borderRadius: 9, border: "none", background: saving ? "#94a3b8" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", boxShadow: saving ? "none" : "0 4px 16px rgba(37,99,235,0.4)", transition: "all 0.18s" }}>
                {saving ? (
                  <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Saving...</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Save Report</>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Guest UI components ──────────────────────────────────────────────────────
function GuestUpgradeModal({ reason, onClose }: { reason: "limit" | "segmentation"; onClose: () => void }) {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,15,30,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "2rem", maxWidth: 400, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #eff6ff, #fef2f2)", border: "1px solid rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0a0f1e", margin: "0 0 0.5rem" }}>
            {reason === "limit" ? "Guest Limit Reached" : "Account Required"}
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, margin: 0 }}>
            {reason === "limit"
              ? "You've used all 3 free guest detections. Create a free account to get unlimited analyses, segmentation, reports, and full patient management."
              : "Pixel-level segmentation is available to registered users only. Create your free account to unlock it."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <button onClick={() => router.push("/auth")} style={{ padding: "0.75rem", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
            Create Free Account
          </button>
          <button onClick={onClose} style={{ padding: "0.65rem", borderRadius: 11, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestBanner({ count }: { count: number }) {
  const router = useRouter();
  const remaining = Math.max(0, GUEST_LIMIT - count);
  return (
    <div style={{ background: "linear-gradient(90deg, #eff6ff, #fff)", border: "1px solid rgba(37,99,235,0.12)", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map(i => {
          const used = i < count;
          const urgent = !used && remaining <= 1;
          return (
            <div key={i} style={{
              width: 11, height: 11, borderRadius: "50%",
              background: used ? "transparent" : urgent ? "#DC2626" : "#2563EB",
              border: used ? "2px solid #cbd5e1" : urgent ? "2px solid #DC2626" : "2px solid #2563EB",
              boxShadow: used ? "none" : urgent ? "0 0 6px rgba(220,38,38,0.5)" : "0 0 6px rgba(37,99,235,0.45)",
              transition: "all 0.35s",
            }} />
          );
        })}
      </div>
      <span style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, flex: 1 }}>
        Guest mode · {remaining} free detection{remaining !== 1 ? "s" : ""} remaining · Detection only
      </span>
      <button onClick={() => router.push("/auth")} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", border: "none", borderRadius: 7, padding: "4px 14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        Create Account
      </button>
    </div>
  );
}

// ─── Detection Mode ───────────────────────────────────────────────────────────
function DetectionMode({ visitId, patient, visit, onAddToSession, onUpdateLastSession, isGuest = false }: {
  visitId: string | null; patient: any; visit: any;
  onAddToSession: (item: Omit<SessionItem, "id">) => void;
  onUpdateLastSession: (updates: Partial<Omit<SessionItem, "id">>) => void;
  isGuest?: boolean;
}) {
  const [state,           setState]           = useState<AnalysisState>("idle");
  const [progress,        setProgress]        = useState(0);
  const [file,            setFile]            = useState<File | null>(null);
  const [preview,         setPreview]         = useState<string | null>(null);
  const [result,          setResult]          = useState<AnalysisResult | null>(null);
  const [showXai,         setShowXai]         = useState(false);
  const [dragging,        setDragging]        = useState(false);
  const [activeDetection, setActiveDetection] = useState<number | null>(null);
  const [error,           setError]           = useState("");
  const [analysisId,      setAnalysisId]      = useState<string | null>(null);
  const [annotatedUrl,    setAnnotatedUrl]    = useState<string | null>(null);
  const [showOriginal,    setShowOriginal]    = useState(false);
  const [gradcamInterp,   setGradcamInterp]   = useState<string | null>(null);
  const [stepIndex,        setStepIndex]        = useState(-1);
  const [validation,       setValidation]       = useState<"idle"|"checking"|"valid"|"invalid">("idle");
  const [validReason,      setValidReason]      = useState("");
  const [segState,      setSegState]      = useState<"idle"|"running"|"done">("idle");
  const [segOverlay,    setSegOverlay]    = useState<string | null>(null);
  const [detRulerLines,  setDetRulerLines]  = useState<RulerLine_t[]>([]);
  const [detRulerActive, setDetRulerActive] = useState(false);
  const [detRulerDraft,  setDetRulerDraft]  = useState<RulerLine_t | null>(null);
  const [detRulerCursor, setDetRulerCursor] = useState<"crosshair"|"not-allowed">("crosshair");
  const [segResult,     setSegResult]     = useState<any>(null);
  const [segStepIndex,     setSegStepIndex]     = useState(-1);
  const [segProgress,      setSegProgress]      = useState(0);
  const [segCompositeUrl,   setSegCompositeUrl]   = useState<string | null>(null);
  const [detectionMediaId,  setDetectionMediaId]  = useState<string | null>(null);
  const [viewStep,      setViewStep]      = useState(2);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [gradcamState,  setGradcamState]  = useState<"idle"|"processing"|"done">("idle");
  const [guestCount,    setGuestCount]    = useState<number>(0);
  const [guestUpgrade,  setGuestUpgrade]  = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const detMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isGuest) setGuestCount(getGuestCount());
  }, [isGuest]);

  useEffect(() => {
    if (!segOverlay) { detMaskCanvasRef.current = null; return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) { ctx.drawImage(img, 0, 0); detMaskCanvasRef.current = c; }
    };
    img.onerror = () => { detMaskCanvasRef.current = null; };
    img.src = segOverlay;
  }, [segOverlay]);

  const isOnDetMask = (svgX: number, svgY: number): boolean => {
    const c = detMaskCanvasRef.current;
    if (!c) return false; // mask not ready → block
    try {
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      const px = Math.min(Math.max(0, Math.round((svgX / RULER_W) * c.width)),  c.width  - 1);
      const py = Math.min(Math.max(0, Math.round((svgY / RULER_H) * c.height)), c.height - 1);
      const d = ctx.getImageData(px, py, 1, 1).data;
      return d[0] + d[1] + d[2] > 100;
    } catch { return false; }
  };

  useEffect(() => {
    if (validation === "valid" && state === "idle") {
      setAnalysisReady(false);
      const t = setTimeout(() => setAnalysisReady(true), 1500);
      return () => clearTimeout(t);
    }
  }, [validation, state]);

  const DETECTION_STEPS = [
    "Running polyp detection model",
    "AI detecting polyp lesions",
    "Rendering detection overlay",
    "Saving image to visit record",
    "Generating saliency interpretation",
    "Saving analysis record",
  ];

  const SEGMENT_STEPS = [
    "Running mucosal analysis model",
    "AI delineating lesion boundaries",
    "Saving imagery to visit record",
    "Saving analysis record",
  ];

  const handleFile = (f: File) => {
    setFile(f); setPreview(URL.createObjectURL(f));
    setState("idle"); setResult(null); setError(""); setAnalysisId(null);
    setActiveDetection(null); setShowXai(false); setAnnotatedUrl(null);
    setShowOriginal(false); setGradcamInterp(null); setStepIndex(-1);
    setViewStep(2); setAnalysisReady(false);
    setValidation("checking"); setValidReason("");

    const fd1 = new FormData(); fd1.append("file", f);
    fetch("/api/ai/validate-content", { method: "POST", body: fd1 })
      .then(r => r.json())
      .then(d => {
        if (d.isValid) { setValidation("valid"); setViewStep(1); }
        else { setValidation("invalid"); setValidReason(d.reason ?? ""); }
      })
      .catch(() => { setValidation("valid"); setViewStep(1); });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  // ── Esophagitis secondary analysis (optional, runs after primary) ────────────

  const runAnalysis = async () => {
    if (!file) return;
    if (isGuest && getGuestCount() >= GUEST_LIMIT) { setGuestUpgrade(true); return; }
    setViewStep(2); setAnalysisReady(false);
    setError(""); setState("uploading"); setProgress(0); setStepIndex(0);

    // ── Polyp path: YOLO detection + Grad-CAM (always primary) ───────────────
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      const pi = setInterval(() => setProgress(p => p >= 85 ? 85 : p + Math.random() * 12), 200);

      // Step 0 — uploading
      const aiForm = new FormData();
      aiForm.append("file", file);
      const ar = await fetch("/api/ai/analyze", { method: "POST", body: aiForm });
      clearInterval(pi); setProgress(100); setState("analyzing");

      if (!ar.ok) {
        const ed = await ar.json().catch(() => ({}));
        setError(ed.error ?? "Analysis failed"); setState("idle"); setStepIndex(-1); return;
      }
      setStepIndex(1); // Step 1 — AI done, drawing overlay
      const aiData = await ar.json();

      // Always draw client-side to use controlled colors (cyan/purple/green, not AI server red)
      let annotatedB64: string | null = null;
      setStepIndex(2); // Step 2 — drawing annotation
      if (aiData.detections?.length > 0) {
        const { drawAnnotatedImage } = await import("@/lib/drawAnnotated");
        annotatedB64 = await drawAnnotatedImage(file,
          aiData.detections.map((d: any) => ({ label: d.label, confidence: d.confidence, severity: d.severity, bbox: d.bbox }))
        );
      }

      const gradcamB64 = aiData.detections?.[0]?.gradcamBase64 ?? null;

      const annotatedUrlForSession = annotatedB64
        ? `data:image/jpeg;base64,${annotatedB64.replace(/^data:[^;]+;base64,/, "")}`
        : null;
      if (annotatedUrlForSession) setAnnotatedUrl(annotatedUrlForSession);

      const mapped: Detection[] = aiData.detections.map((d: any) => ({
        id: d.id, label: d.label, confidence: Math.round(d.confidence),
        severity: d.severity as Severity, location: d.location,
        x: d.bbox.x, y: d.bbox.y, w: d.bbox.w, h: d.bbox.h,
        gradcamBase64: d.gradcamBase64, cropBase64: d.cropBase64,
      }));

      // Steps 3 & 4 run in parallel — media upload and Grad-CAM interpretation are independent
      setStepIndex(3);
      const [mediaId, gradcamInterpretation] = await Promise.all([
        visitId
          ? uploadMedia(file, visitId, doctor?.id, { annotatedB64, gradcamB64 })
          : Promise.resolve(null),
        gradcamB64 && aiData.detections?.length > 0
          ? interpretGradcam({
              gradcamBase64: gradcamB64,
              detections: aiData.detections.map((d: any) => ({
                label: d.label, confidence: d.confidence,
                severity: d.severity, location: d.location,
              })),
              analysisType: "detection",
              overallRisk: aiData.overallRisk,
              modelVersion: aiData.modelVersion,
            })
          : Promise.resolve(null),
      ]);
      setDetectionMediaId(mediaId);
      if (gradcamInterpretation) setGradcamInterp(gradcamInterpretation);

      setStepIndex(5); // Step 5 — saving to DB
      let analysisIdVal: string | null = null;
      if (visitId) {
        analysisIdVal = await saveAnalysis({
          visitId,
          mediaId,
          doctorId: doctor?.id,
          analysisType: "detection",
          modelVersion: aiData.modelVersion,
          overallConfidence: aiData.detections[0]?.confidence ?? 0,
          overallRisk: aiData.overallRisk,
          framesWithDetection: aiData.totalDetected,
          rawOutput: JSON.stringify(aiData),
          detectedLesions: aiData.detections.map((d: any) => ({
            lesionType: d.label,
            classification: d.label,
            confidence: d.confidence,
            severity: d.severity,
            location: d.location,
            boundingBox: JSON.stringify(d.bbox),
          })),
        });
        setAnalysisId(analysisIdVal);
      }

      setResult({ model: aiData.modelVersion, duration: aiData.duration, overallRisk: aiData.overallRisk, frameCount: aiData.totalDetected, recommendation: aiData.totalDetected > 0 ? "Lesion(s) detected — specialist review recommended." : "No significant findings.", detections: mapped });
      setState("done"); setStepIndex(-1);
      if (isGuest) { incGuestCount(); setGuestCount(getGuestCount()); window.dispatchEvent(new Event("guest-detection")); }
      /* Heatmap already in response — switch directly to Activation Map view (guests stay on Detection) */
      if (isGuest) {
        setViewStep(2);
      } else {
        setGradcamState("done"); setViewStep(2); setShowXai(false);
      }

      onAddToSession({
        file: file!,
        preview: preview!,
        annotatedUrl: annotatedUrlForSession,
        overlayUrl: null,
        detections: mapped,
        segments: [],
        overallRisk: aiData.overallRisk,
        analysisType: "detection",
        analysisId: analysisIdVal,
        mediaId: mediaId,
        gradcamInterp: gradcamInterpretation,
      });
    } catch (e: any) { setError(e.message ?? "Error"); setState("idle"); setStepIndex(-1); }
  };

  const runSegment = async () => {
    if (!file) return;
    setViewStep(4); setShowOriginal(false); setShowXai(false);
    setSegState("running"); setSegProgress(0); setSegStepIndex(0);
    const pi = setInterval(() => setSegProgress(p => p >= 88 ? 88 : p + Math.random() * 8), 300);
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/ai/segment", { method: "POST", body: fd });
      clearInterval(pi); setSegProgress(100);
      if (!res.ok) { setSegState("idle"); setSegStepIndex(-1); return; }
      setSegStepIndex(1);
      const data = await res.json();
      const overlayB64: string | null = data.overlayBase64 ?? null;

      // Re-render raw vivid mask → orange transparent overlay with thick contour
      const rawOverlayUrl = overlayB64 ? `data:image/png;base64,${overlayB64.replace(/^data:[^;]+;base64,/, "")}` : null;
      let processedOverlayUrl: string | null = null;
      if (rawOverlayUrl) {
        const { renderSegmentationOverlay } = await import("@/lib/drawAnnotated");
        processedOverlayUrl = await renderSegmentationOverlay(rawOverlayUrl);
      }

      // Build composite (detection bboxes + processed overlay) for saving to DB
      let compositeUrl: string | null = null;
      if (processedOverlayUrl && annotatedUrl) {
        const { compositeWithOverlay } = await import("@/lib/drawAnnotated");
        compositeUrl = await compositeWithOverlay(annotatedUrl, processedOverlayUrl, 1.0);
      }

      // Save composite to DB: PATCH the existing media record to add overlayUrl
      const compositeB64 = compositeUrl ? compositeUrl.replace(/^data:image\/jpeg;base64,/, "") : overlayB64;
      setSegStepIndex(2);
      let segMediaId: string | null = null;
      if (visitId && detectionMediaId && compositeB64) {
        await fetch(`/api/visits/${visitId}/media`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: detectionMediaId, overlayB64: compositeB64 }),
        });
        segMediaId = detectionMediaId;
      } else if (visitId && compositeB64) {
        segMediaId = await uploadMedia(file, visitId, doctor?.id, { overlayB64: compositeB64 });
      }
      setSegStepIndex(3);
      if (visitId) {
        await saveAnalysis({
          visitId, mediaId: segMediaId, doctorId: doctor?.id, analysisType: "segmentation",
          modelVersion: data.modelVersion ?? "DeepLabV3++", overallConfidence: data.segments?.[0]?.confidence ?? 0,
          overallRisk: data.overallRisk ?? "normal", framesWithDetection: data.segments?.length ?? 0,
          rawOutput: JSON.stringify(data),
          detectedLesions: (data.segments ?? []).map((s: any) => ({
            lesionType: s.label, classification: s.label, confidence: s.confidence,
            severity: s.severity, location: s.location, boundingBox: JSON.stringify(s.bbox ?? {}),
          })),
        });
      }
      setSegResult(data);
      setSegOverlay(processedOverlayUrl);      // orange transparent overlay — no screen blend needed
      setSegCompositeUrl(compositeUrl);        // save image button + session
      setSegState("done"); setSegStepIndex(-1);
      const sessionOverlay = compositeUrl ?? rawOverlayUrl;
      if (sessionOverlay) onUpdateLastSession({ overlayUrl: sessionOverlay, segments: data.segments ?? [] });
    } catch { clearInterval(pi); setSegState("idle"); setSegStepIndex(-1); }
  };

  const reset = () => {
    setState("idle"); setFile(null); setPreview(null); setResult(null);
    setProgress(0); setError(""); setAnalysisId(null);
    setActiveDetection(null); setShowXai(false); setAnnotatedUrl(null);
    setShowOriginal(false); setGradcamInterp(null); setStepIndex(-1);
    setViewStep(2); setAnalysisReady(false);
    setValidation("idle"); setValidReason("");
    setGradcamState("idle");
    setSegState("idle"); setSegOverlay(null); setSegResult(null);
    setSegStepIndex(-1); setSegProgress(0); setSegCompositeUrl(null);
    setDetectionMediaId(null);
    setDetRulerLines([]); setDetRulerActive(false); setDetRulerDraft(null); setDetRulerCursor("crosshair");
  };

  const overallStyle = result ? severityStyle(result.overallRisk) : null;
  const gradcamFull = result?.detections?.[0]?.gradcamBase64 ?? null;
  // Base image: detection annotated (with bboxes) or gradcam or original
  const displayPreview =
    showXai && gradcamFull
      ? gradcamFull
      : result && annotatedUrl && result.detections.length > 0 && !showOriginal
        ? annotatedUrl
        : preview;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* Pipeline Progress Stepper */}
        {(() => {
          const allPhases: { label: string; est: string; done: boolean; active: boolean; onView?: () => void }[] = [
            { label: "Upload",           est: "—",     done: !!file,                    active: false,
              onView: () => { setShowOriginal(true);  setShowXai(false); setViewStep(0); } },
            { label: "Verification",     est: "~2s",   done: validation === "valid",    active: validation === "checking",
              onView: () => { setShowOriginal(true);  setShowXai(false); setViewStep(1); } },
            { label: "Detection",        est: "~15s",  done: state === "done",           active: state === "uploading" || state === "analyzing",
              onView: () => { setShowOriginal(false); setShowXai(false); setViewStep(2); } },
            { label: "Activation Map",   est: "~2s",   done: gradcamState === "done",    active: gradcamState === "processing",
              onView: () => { setShowOriginal(false); setShowXai(true);  setViewStep(3); } },
            { label: "Mucosal Analysis", est: "~60s",  done: segState === "done",        active: segState === "running",
              onView: () => { setShowOriginal(false); setShowXai(false); setViewStep(4); } },
          ];
          const phases = isGuest ? allPhases.slice(0, 3) : allPhases;
          const selectedIdx = viewStep;
          const lastDone = phases.reduce((acc, p, i) => p.done ? i : acc, -1);
          const overallPct = isGuest
            ? (state === "done"                                        ? 100 :
               state === "uploading" || state === "analyzing"          ? 50  :
               validation === "valid"                                  ? Math.round((1 / 3) * 100) :
               validation === "checking"                               ? 22  :
               file                                                    ? Math.round((1 / 3) * 100) : 0)
            : (segState === "done"                                     ? 100 :
               segState === "running"                                  ? 88  :
               gradcamState === "done"                                 ? Math.round((4 / 5) * 100) :
               state === "uploading" || state === "analyzing"          ? 50  :
               validation === "valid"                                  ? Math.round((2 / 5) * 100) :
               validation === "checking"                               ? 22  :
               file                                                    ? Math.round((1 / 5) * 100) : 0);
          return (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.55rem 0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                {phases.map((ph, i) => {
                  const isDone    = ph.done;
                  const isActive  = ph.active;
                  const isSelected = isDone && i === selectedIdx;
                  const clickable  = isDone && !!ph.onView;
                  return (
                    <React.Fragment key={ph.label}>
                      <div
                        onClick={clickable ? ph.onView : undefined}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", cursor: clickable ? "pointer" : "default", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                            background: isDone ? "#2563EB" : isActive ? "#2563EB" : "#e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.3s",
                            boxShadow: isSelected ? "0 0 0 3px #2563EB" : isDone ? "0 0 0 3px #dcfce7" : isActive ? "0 0 0 3px #dbeafe" : "none",
                          }}>
                            {isDone
                              ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : isActive
                                ? <div style={{ width: 6, height: 6, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                                : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#94a3b8", display: "block" }} />
                            }
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: isDone ? 700 : isActive ? 700 : 500, color: isSelected ? "#2563eb" : isDone ? "#16a34a" : isActive ? "#1d4ed8" : "#94a3b8", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                              {ph.label}
                            </div>
                            <div style={{ fontSize: 8, color: isDone ? "#2563EB" : isActive ? "#60a5fa" : "#cbd5e1", fontWeight: 600, lineHeight: 1 }}>
                              {isDone ? "✓ done" : isActive ? "running…" : ph.est}
                            </div>
                          </div>
                        </div>
                      </div>
                      {i < phases.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: isDone ? "#86efac" : "#e2e8f0", borderRadius: 99, minWidth: 8, transition: "background 0.3s" }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Global progress bar */}
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${overallPct}%`, height: "100%", background: "linear-gradient(90deg, #2563EB, #a855f7)", borderRadius: 99, transition: "width 0.4s ease" }} />
              </div>
            </div>
          );
        })()}

        {!preview ? (
          <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? "#2563EB" : "#cbd5e1"}`, borderRadius: 12, padding: "2.5rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", cursor: "pointer", background: dragging ? "#eff6ff" : "#f8fafc", transition: "all 0.2s" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: dragging ? "#dbeafe" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dragging ? "#2563EB" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>Upload Endoscopic Image</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "0.2rem 0 0" }}>Supports JPG, PNG · max 50 MB</p>
            </div>
            <span style={{ padding: "0.45rem 1.25rem", borderRadius: 7, background: "#fff", border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 600, color: "#374151" }}>Browse Files</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        ) : (
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ position: "relative", background: "#000", maxHeight: "55vh", overflow: "hidden" }}>
              {/* Base image: annotated detection or gradcam or original */}
              <img src={displayPreview ?? ""} alt="Endoscopy"
                style={{ width: "100%", display: "block", maxHeight: "55vh", objectFit: "contain" }} />

              {/* Segmentation overlay — only when Mucosal Analysis step is selected */}
              {segState === "done" && segOverlay && viewStep === 4 && (
                <img src={segOverlay} alt="Mucosal analysis overlay"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
              )}

              {/* ── Caliper ruler (Mucosal Analysis step only) ── */}
              {segState === "done" && viewStep === 4 && (
                <>
                  {/* Mucosal Analysis badge + ruler controls in one row */}
                  <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ background: "rgba(168,85,247,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "4px 8px", borderRadius: 5, display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Mucosal Analysis
                    </div>
                    {detRulerActive && detRulerLines.length > 0 && (
                      <button type="button" onClick={() => { setDetRulerLines([]); setDetRulerDraft(null); }}
                        style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(239,68,68,0.75)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Clear
                      </button>
                    )}
                    <button type="button"
                      onClick={() => { setDetRulerActive(r => !r); setDetRulerDraft(null); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 5, border: `1px solid ${detRulerActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: detRulerActive ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l18 0M3 15l18 0M3 9v6M21 9v6"/>
                        <path d="M7 9v3M11 9v3M15 9v3M19 9v3"/>
                      </svg>
                      {detRulerActive ? "Measuring…" : "Measure"}
                    </button>
                  </div>

                  {/* Interactive SVG ruler */}
                  {detRulerActive && (
                    <svg
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 8, cursor: detRulerCursor }}
                      viewBox={`0 0 ${RULER_W} ${RULER_H}`}
                      preserveAspectRatio="none"
                      onMouseDown={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - r.left) / r.width  * RULER_W;
                        const y = (e.clientY - r.top)  / r.height * RULER_H;
                        if (!isOnDetMask(x, y)) return;
                        setDetRulerDraft({ x1: x, y1: y, x2: x, y2: y });
                        e.preventDefault();
                      }}
                      onMouseMove={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - r.left) / r.width  * RULER_W;
                        const y = (e.clientY - r.top)  / r.height * RULER_H;
                        setDetRulerCursor(isOnDetMask(x, y) ? "crosshair" : "not-allowed");
                        if (detRulerDraft)
                          setDetRulerDraft(prev => prev ? { ...prev, x2: x, y2: y } : null);
                      }}
                      onMouseUp={e => {
                        if (!detRulerDraft) return;
                        const r = e.currentTarget.getBoundingClientRect();
                        const ex = (e.clientX - r.left) / r.width  * RULER_W;
                        const ey = (e.clientY - r.top)  / r.height * RULER_H;
                        const dx = detRulerDraft.x2 - detRulerDraft.x1;
                        const dy = detRulerDraft.y2 - detRulerDraft.y1;
                        if (Math.sqrt(dx * dx + dy * dy) > 3 && isOnDetMask(ex, ey))
                          setDetRulerLines(prev => [...prev, detRulerDraft]);
                        setDetRulerDraft(null);
                      }}
                      onMouseLeave={() => setDetRulerDraft(null)}
                    >
                      {(() => { const offs = resolveRulerLabels(detRulerLines); return detRulerLines.map((l, i) => <RulerLineEl key={i} l={l} labelOff={offs[i]} />); })()}
                      {detRulerDraft && <RulerLineEl l={detRulerDraft} draft />}
                    </svg>
                  )}

                  {detRulerActive && detRulerLines.length === 0 && !detRulerDraft && (
                    <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "4px 10px", borderRadius: 4, pointerEvents: "none", whiteSpace: "nowrap" }}>
                      Click and drag to measure
                    </div>
                  )}
                </>
              )}

              {state === "done" && result && result.detections.length > 0 && !annotatedUrl && !showXai && (
                <DetectionBoxes detections={result.detections} activeId={activeDetection}
                  onSelect={id => setActiveDetection(p => p === id ? null : id)} />
              )}

              {(state === "uploading" || state === "analyzing") && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(6,12,26,0.88)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.25rem", padding: "2rem" }}>
                  {/* Pulsing ring */}
                  <div style={{ position: "relative", width: 48, height: 48 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(37,99,235,0.15)", borderTopColor: "#2563EB", animation: "spin 0.9s linear infinite" }} />
                    <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "2px solid rgba(29,78,216,0.2)", borderBottomColor: "#1D4ED8", animation: "spin 1.4s linear infinite reverse" }} />
                  </div>

                  {/* Step list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", width: "100%", maxWidth: 260 }}>
                    {DETECTION_STEPS.map((step, idx) => {
                      const done    = idx < stepIndex;
                      const active  = idx === stepIndex;
                      const pending = idx > stepIndex;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.6rem", opacity: pending ? 0.3 : 1, transition: "opacity 0.3s" }}>
                          {done ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : active ? (
                            <div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 12, fontWeight: active ? 700 : done ? 500 : 400, color: done ? "#4ade80" : active ? "#e2e8f0" : "#94a3b8", letterSpacing: "0.01em" }}>
                            {step}
                          </span>
                          {active && (
                            <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                              {[0,1,2].map(i => (
                                <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#2563EB", animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress bar (upload phase) */}
                  {state === "uploading" && (
                    <div style={{ width: "100%", maxWidth: 260, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99 }}>
                      <div style={{ width: `${Math.min(progress, 100)}%`, height: "100%", background: "linear-gradient(90deg, #2563EB, #1D4ED8)", borderRadius: 99, transition: "width 0.2s" }} />
                    </div>
                  )}
                </div>
              )}

              {state === "done" && result && overallStyle && viewStep >= 2 && (
                <div style={{ position: "absolute", top: "0.5rem", left: "0.5rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: `1px solid ${overallStyle.dot}66`, borderRadius: 6, padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: overallStyle.dot, boxShadow: `0 0 6px ${overallStyle.dot}` }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: overallStyle.dot }}>{overallStyle.label}</span>
                </div>
              )}

              {showXai && state === "done" && segState !== "done" && (
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "rgba(37,99,235,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>Grad-CAM Active</div>
              )}
              {/* Mucosal Analysis badge — only when ruler bar isn't showing (viewStep !== 4) */}
              {segState === "done" && viewStep !== 4 && (
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "rgba(168,85,247,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Mucosal Analysis
                </div>
              )}

              {/* ── Mucosal Analysis loading overlay ── */}
              {segState === "running" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(6,12,26,0.88)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.25rem", padding: "2rem" }}>
                  <div style={{ position: "relative", width: 48, height: 48 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(168,85,247,0.15)", borderTopColor: "#a855f7", animation: "spin 0.9s linear infinite" }} />
                    <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "2px solid rgba(192,132,252,0.2)", borderBottomColor: "#c084fc", animation: "spin 1.4s linear infinite reverse" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", width: "100%", maxWidth: 260 }}>
                    {SEGMENT_STEPS.map((step, idx) => {
                      const done    = idx < segStepIndex;
                      const active  = idx === segStepIndex;
                      const pending = idx > segStepIndex;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.6rem", opacity: pending ? 0.3 : 1, transition: "opacity 0.3s" }}>
                          {done
                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                            : active
                              ? <div style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                              : <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                          }
                          <span style={{ fontSize: 12, fontWeight: active ? 700 : done ? 500 : 400, color: done ? "#4ade80" : active ? "#e2e8f0" : "#94a3b8" }}>
                            {step}
                          </span>
                          {active && (
                            <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                              {[0,1,2].map(i => (
                                <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#a855f7", animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ width: "100%", maxWidth: 260, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99 }}>
                    <div style={{ width: `${Math.min(segProgress, 100)}%`, height: "100%", background: "linear-gradient(90deg, #a855f7, #c084fc)", borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                </div>
              )}

              {/* ── Content validation overlay ── */}
              {validation === "checking" && state === "idle" && (
                <div style={{ position: "absolute", top: "0.6rem", left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.82)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: 11, height: 11, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fbbf24", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#fbbf24" }}>Verifying content…</span>
                </div>
              )}
              {validation === "invalid" && state === "idle" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.85rem", padding: "1.5rem" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(251,191,36,0.15)", border: "2px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#fef3c7", margin: 0 }}>Image Outside Domain</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "0.35rem 0 0", maxWidth: 260, lineHeight: 1.5 }}>
                      {validReason || "This image does not appear to be a valid colonoscopy/endoscopy image. Please upload a gastrointestinal endoscopy image."}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button type="button" onClick={reset}
                      style={{ padding: "0.5rem 1.1rem", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Remove File
                    </button>
                    <button type="button" onClick={() => setValidation("valid")}
                      style={{ padding: "0.5rem 1.1rem", borderRadius: 7, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Upload Anyway
                    </button>
                  </div>
                </div>
              )}
              {viewStep === 1 && validation === "valid" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
                  <div style={{ background: "rgba(15,23,42,0.92)", border: "1px solid rgba(37,99,235,0.4)", color: "#fff", padding: "1.8rem 2.4rem", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(37,99,235,0.15)", minWidth: 240 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(37,99,235,0.12)", border: "2px solid #2563EB", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(37,99,235,0.3)" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.01em" }}>Endoscopy Image Verified</span>
                      <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Valid endoscopic content</span>
                    </div>
                    <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.07)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", boxShadow: "0 0 6px #2563EB" }} />
                      <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>AI content validation passed</span>
                    </div>
                  </div>
                </div>
              )}
              {validation === "valid" && state === "idle" && viewStep !== 1 && (
                <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", background: "rgba(37,99,235,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Endoscopy Verified
                </div>
              )}

            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.85rem", background: "#0f172a", flexWrap: "wrap" }}>
              <p style={{ fontSize: 10, color: "#64748b", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</p>

              {state === "done" && annotatedUrl && result && result.detections.length > 0 && (
                <a
                  href={viewStep === 4 && segCompositeUrl ? segCompositeUrl : displayPreview ?? ""}
                  download={viewStep === 4 && segCompositeUrl ? `mucosal_${file?.name ?? "mucosal.jpg"}` : viewStep === 3 && gradcamFull ? `gradcam_${file?.name ?? "gradcam.jpg"}` : viewStep <= 1 ? (file?.name ?? "original.jpg") : `annotated_${file?.name ?? "analysis.jpg"}`}
                  style={{ padding: "0.35rem 0.7rem", borderRadius: 5, border: "1px solid #2563EB", background: "rgba(37,99,235,0.12)", color: "#16a34a", fontSize: 10, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Save Image
                </a>
              )}

              {state === "done" && !isGuest && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 700 }}>Saved to consultation · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              )}

              {state === "done" && gradcamState === "done" && viewStep === 2 && !isGuest && (
                <button type="button" onClick={() => { setViewStep(3); setShowXai(true); }}
                  style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "1px solid #f59e0b", background: "rgba(245,158,11,0.1)", color: "#d97706", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  View Activation Map →
                </button>
              )}

              {state === "done" && segState === "idle" && (
                isGuest ? (
                  <button type="button" onClick={() => setGuestUpgrade(true)}
                    style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "1px solid #94a3b8", background: "rgba(148,163,184,0.08)", color: "#94a3b8", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Mucosal Analysis
                  </button>
                ) : (
                  <button type="button" onClick={runSegment}
                    style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "1px solid #a855f7", background: "rgba(168,85,247,0.1)", color: "#a855f7", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="3"/></svg>
                    Run Mucosal Analysis
                  </button>
                )
              )}
              {state === "done" && segState === "done" && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#a855f7", background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 5, padding: "3px 10px" }}>
                  ✓ Mucosal Analysis Done
                </span>
              )}

              {state === "done" && (
                <button type="button" onClick={reset}
                  style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)" }}>
                  + Analyse Another Image
                </button>
              )}

              {state === "idle" && (
                (!visitId && !isGuest)
                  ? <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>No visit linked</span>
                  : validation === "checking"
                    ? <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>Verifying image…</span>
                    : validation === "invalid"
                      ? <span style={{ fontSize: 10, color: "#f87171", fontWeight: 600 }}>Remove image or click "Upload Anyway"</span>
                      : !analysisReady
                        ? <span style={{ fontSize: 10, color: "#2563EB", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Endoscopy Verified
                          </span>
                        : <button type="button" onClick={runAnalysis}
                            style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)" }}>
                            Run CAD Analysis
                          </button>
              )}
              {state !== "done" && (
                <button type="button" onClick={reset}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Reset
                </button>
              )}
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 11, padding: "0.45rem 0.85rem", background: "#1c0909", margin: 0 }}>{error}</p>}
          </div>
        )}

    {/* Guest upgrade modal */}
    {guestUpgrade && (
      <GuestUpgradeModal
        reason={getGuestCount() >= GUEST_LIMIT ? "limit" : "segmentation"}
        onClose={() => setGuestUpgrade(false)}
      />
    )}
    </div>
  );
}

// ─── Session Strip ────────────────────────────────────────────────────────────
function SessionStrip({ session, onRemove, onGenerateReport }: {
  session: SessionItem[];
  onRemove: (id: string) => void;
  onGenerateReport: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "0.75rem" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
        Visit · {session.length} image{session.length !== 1 ? "s" : ""}
      </span>
      {session.map((item, idx) => {
        const s = severityStyle(item.overallRisk as Severity);
        const cnt = item.detections.length + item.segments.length;
        return (
          <div key={item.id} title={`Image ${idx + 1} · ${cnt} finding(s)`} style={{ position: "relative", flexShrink: 0 }}>
            <img src={item.annotatedUrl ?? item.overlayUrl ?? item.preview}
              style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8, border: `2px solid ${s.dot}`, display: "block" }} />
            <span style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", background: s.dot, color: "#fff", fontSize: 7, fontWeight: 800, padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap" }}>
              {s.label}
            </span>
            {cnt > 0 && (
              <span style={{ position: "absolute", top: -5, left: -5, background: "#1e3a5f", color: "#fff", fontSize: 7, fontWeight: 800, width: 14, height: 14, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cnt}
              </span>
            )}
            <button type="button" onClick={() => onRemove(item.id)}
              style={{ position: "absolute", top: -5, right: -5, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 9, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              ×
            </button>
          </div>
        );
      })}
      <button type="button" onClick={onGenerateReport}
        style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 1.1rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)", whiteSpace: "nowrap" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Generate Report
      </button>
    </div>
  );
}

// ─── Image Analysis Wrapper ───────────────────────────────────────────────────
function ImageAnalysisMode({ visitId, patient, visit, isGuest = false }: { visitId: string | null; patient: any; visit: any; isGuest?: boolean; }) {
  const [session,    setSession]    = useState<SessionItem[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [guestUpgradeReport, setGuestUpgradeReport] = useState(false);

  const addToSession = useCallback((item: Omit<SessionItem, "id">) => {
    setSession(prev => [...prev, { ...item, id: `${Date.now()}_${Math.random()}` }]);
  }, []);

  const updateLastSession = useCallback((updates: Partial<Omit<SessionItem, "id">>) => {
    setSession(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, ...updates }];
    });
  }, []);

  const removeFromSession = useCallback((id: string) => {
    setSession(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.mediaId) {
        fetch(`/api/visit-media/${item.mediaId}`, { method: "DELETE" }).catch(() => {});
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  if (showReport && !isGuest) {
    return (
      <MultiReportPanel
        session={session} patient={patient} visit={visit} visitId={visitId}
        onBack={() => setShowReport(false)}
      />
    );
  }

  return (
    <div>
      {guestUpgradeReport && <GuestUpgradeModal reason="segmentation" onClose={() => setGuestUpgradeReport(false)} />}
      {session.length > 0 && (
        <SessionStrip session={session} onRemove={removeFromSession} onGenerateReport={() => isGuest ? setGuestUpgradeReport(true) : setShowReport(true)} />
      )}
      <DetectionMode visitId={visitId} patient={patient} visit={visit} onAddToSession={addToSession} onUpdateLastSession={updateLastSession} isGuest={isGuest} />
    </div>
  );
}

// ─── Live Video Report Panel ─────────────────────────────────────────────────
function LiveVideoReportPanel({ patient, visit, visitId, mediaId, processedCount, framesWithDetection, highRiskFrames, allResults, frameList, onBack }: {
  patient: any; visit: any; visitId: string | null; mediaId: string | null;
  processedCount: number; framesWithDetection: number; highRiskFrames: number;
  allResults: any[]; frameList: any[]; onBack: () => void;
}) {
  // Map frameUrl → frameId (VideoFrame DB id)
  const frameUrlToId = Object.fromEntries(frameList.map((f: any) => [f.frameUrl, f.id]));
  const allDetections = allResults.flatMap((r: any) => r.detections ?? []);
  const worstRisk = allResults.reduce((worst: string, r: any) => {
    const order: Record<string, number> = { normal: 0, low: 1, medium: 2, moderate: 2, high: 3, critical: 4 };
    return (order[r.overallRisk] ?? 0) > (order[worst] ?? 0) ? r.overallRisk : worst;
  }, "normal");
  const avgConf = allDetections.length > 0
    ? Math.round(allDetections.reduce((s: number, d: any) => s + (d.confidence ?? 0), 0) / allDetections.length)
    : 0;

  // unique lesion types seen across all frames
  const uniqueLabels = [...new Set(allDetections.map((d: any) => d.label as string))];

  // Frames with detections sorted by highest confidence — for key-frame picker
  const framesForGallery = allResults
    .filter((r: any) => (r.detections ?? []).length > 0)
    .sort((a: any, b: any) => {
      const maxConf = (r: any) => Math.max(...(r.detections ?? []).map((d: any) => d.confidence ?? 0));
      return maxConf(b) - maxConf(a);
    });

  type SelFrame = { frameId: string; frameUrl: string; timestampMs: number; detections: any[] };
  const [selectedFrames, setSelectedFrames] = useState<SelFrame[]>([]);
  const isSelected = (url: string) => selectedFrames.some(f => f.frameUrl === url);
  const toggleFrame = (r: any) => {
    const frameId = frameUrlToId[r.frameUrl] ?? "";
    setSelectedFrames(prev =>
      prev.some(f => f.frameUrl === r.frameUrl)
        ? prev.filter(f => f.frameUrl !== r.frameUrl)
        : [...prev, { frameId, frameUrl: r.frameUrl, timestampMs: r.timestampMs ?? 0, detections: r.detections ?? [] }]
    );
  };

  const [draft, setDraft] = useState({
    clinicalNotes: "",
    conclusion: framesWithDetection > 0
      ? `Live monitoring of endoscopic video (${processedCount} frames). ${framesWithDetection} frame(s) with findings detected. Lesion types identified: ${uniqueLabels.length > 0 ? uniqueLabels.join(", ") : "none"}.`
      : `Live monitoring of endoscopic video (${processedCount} frames). No pathological findings detected.`,
    recommendation: framesWithDetection > 0
      ? "Targeted biopsy recommended for frames with high-confidence detections. Gastroenterology specialist review advised."
      : "No significant findings. Routine follow-up as clinically indicated.",
  });
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [error,         setError]         = useState("");
  const router = useRouter();
  const worstStyle = severityStyle(worstRisk as Severity);

  const handleSave = async () => {
    if (!visitId) { setError("No visit linked"); return; }
    setSaving(true); setError("");
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;

      // 1. Save analysis result for the video session
      const analysisId = await saveAnalysis({
        visitId,
        mediaId,
        doctorId: doctor?.id,
        analysisType: "video",
        modelVersion: "LiveCAD-1.0",
        overallConfidence: avgConf,
        overallRisk: worstRisk,
        framesWithDetection,
        rawOutput: JSON.stringify({ totalFrames: processedCount, framesWithDetection, highRiskFrames }),
        detectedLesions: [...new Map(allDetections.map((d: any) => [d.label, d])).values()].map((d: any) => ({
          lesionType: d.label, classification: d.label, confidence: d.confidence ?? 0,
          severity: d.severity ?? "normal", location: d.location ?? "",
          boundingBox: JSON.stringify({ x: d.x ?? 0, y: d.y ?? 0, w: d.w ?? 0, h: d.h ?? 0 }),
        })),
      });

      if (!analysisId) { setError("Failed to save analysis record"); setSaving(false); return; }

      // 2. Save the report
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId:      patient?.id,
          visitId,
          analysisId,
          doctorId:       doctor?.id,
          title: `Live Monitoring Report · ${framesWithDetection} finding(s) · ${new Date().toLocaleDateString()}`,
          clinicalNotes:  draft.clinicalNotes,
          conclusion:     draft.conclusion,
          recommendation: draft.recommendation,
          status:         "draft",
          mediaIds:         JSON.stringify([mediaId].filter(Boolean)),
          selectedFrameIds: selectedFrames.map(f => f.frameId).filter(Boolean),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(true);
        setSavedReportId(data?.report?.id ?? null);
      } else { const d = await res.json(); setError(d.error ?? "Failed to save report"); }
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.8rem", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Monitoring
        </button>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: "#1e3a5f", margin: 0 }}>Live Monitoring Report</h2>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0.1rem 0 0" }}>
            {processedCount} frames analysed · {framesWithDetection} with finding(s) · {highRiskFrames} high-risk
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem", background: `${worstStyle.dot}18`, border: `1px solid ${worstStyle.dot}44`, borderRadius: 7, padding: "4px 12px" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: worstStyle.dot }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: worstStyle.color }}>Overall: {worstStyle.label}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1rem", alignItems: "start" }}>

        {/* Left: stats + findings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

          {/* Video stats */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.65rem" }}>Visit Statistics</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.5rem" }}>
              {([
                ["Total Frames",   String(processedCount),                       "#2563EB"],
                ["With Findings",  String(framesWithDetection),                  "#f59e0b"],
                ["High Risk",      String(highRiskFrames),                       "#ef4444"],
                ["Avg Confidence", avgConf > 0 ? `${avgConf}%` : "—",           "#2563EB"],
              ] as [string, string, string][]).map(([l, v, c]) => (
                <div key={l} style={{ background: "#f8fafc", borderRadius: 8, padding: "0.65rem 0.5rem", textAlign: "center", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: c, margin: 0 }}>{v}</p>
                  <p style={{ fontSize: 9, color: "#6b7280", margin: "0.1rem 0 0", fontWeight: 600, textTransform: "uppercase", lineHeight: 1.3 }}>{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Detected lesion types */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.6rem" }}>
              Findings Across All Frames ({allDetections.length})
            </p>
            {allDetections.length === 0 ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#15803d", margin: 0 }}>No pathological findings detected</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {/* Group by label */}
                {[...new Map(allDetections.map((d: any) => [d.label, d])).values()].map((d: any, i: number) => {
                  const count = allDetections.filter((x: any) => x.label === d.label).length;
                  const s = severityStyle((d.severity ?? "normal") as Severity);
                  return (
                    <div key={i} style={{ borderRadius: 8, padding: "0.5rem 0.65rem", border: "1px solid #e5e7eb", background: "#fafafa" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1f2937" }}>{d.label}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px" }}>{count} frame{count !== 1 ? "s" : ""}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 6px" }}>{s.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                        <div style={{ flex: 1, height: 3, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(d.confidence ?? 0)}%`, height: "100%", background: s.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: s.color, minWidth: 30 }}>{Math.round(d.confidence ?? 0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Key Frame Picker */}
          {framesForGallery.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                    Key Frames for Report
                  </p>
                  <p style={{ fontSize: 10, color: "#6b7280", margin: "0.2rem 0 0" }}>
                    Select frames to attach · {selectedFrames.length} selected
                  </p>
                </div>
                {selectedFrames.length > 0 && (
                  <button type="button" onClick={() => setSelectedFrames([])}
                    style={{ fontSize: 9, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    Clear all
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
                {framesForGallery.slice(0, 12).map((r: any) => {
                  const dets     = r.detections ?? [];
                  const topDet   = dets.reduce((best: any, d: any) => (!best || d.confidence > best.confidence) ? d : best, null);
                  const selected = isSelected(r.frameUrl);
                  const DET_COLORS = ["#ef4444","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#f97316","#ec4899","#10b981"];
                  return (
                    <div key={r.frameUrl} onClick={() => toggleFrame(r)}
                      style={{ position: "relative", borderRadius: 7, overflow: "hidden", cursor: "pointer",
                        border: selected ? "2px solid #2563EB" : "2px solid rgba(0,0,0,0.08)",
                        boxShadow: selected ? "0 0 0 3px rgba(37,99,235,0.2)" : "0 1px 4px rgba(0,0,0,0.1)",
                        transition: "all 0.15s",
                      }}>
                      <img src={r.frameUrl} alt={`F${r.frameIndex}`}
                        style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />

                      {/* Bounding boxes SVG overlay */}
                      {dets.length > 0 && (
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                          {dets.map((d: any, i: number) => {
                            const x = d.x ?? 10, y = d.y ?? 10, w = d.w ?? 20, h = d.h ?? 20;
                            const color = DET_COLORS[i % DET_COLORS.length];
                            return (
                              <g key={i}>
                                <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth="1.2" rx="1" />
                                <rect x={x} y={Math.max(0, y - 6)} width={w} height="6" fill={color} opacity="0.9" rx="0.8" />
                                <text x={x + w / 2} y={Math.max(0, y - 6) + 4.5} textAnchor="middle"
                                  fontSize="3.5" fill="#fff" fontWeight="bold" fontFamily="sans-serif">
                                  {d.label} {Math.round(d.confidence ?? 0)}%
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}

                      {/* Bottom gradient */}
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)", padding: "0.3rem 0.4rem 0.2rem", pointerEvents: "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <span style={{ fontSize: 7, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
                            {`${String(Math.floor((r.timestampMs ?? 0) / 60000)).padStart(2,"0")}:${String(Math.floor(((r.timestampMs ?? 0) % 60000) / 1000)).padStart(2,"0")}`}
                          </span>
                          {topDet && (
                            <span style={{ fontSize: 7, fontWeight: 800, color: "#fbbf24" }}>
                              {Math.round(topDet.confidence ?? 0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selected checkmark */}
                      {selected && (
                        <div style={{ position: "absolute", top: 4, right: 4, width: 17, height: 17, borderRadius: "50%", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {framesForGallery.length > 12 && (
                <p style={{ fontSize: 9, color: "#94a3b8", margin: "0.5rem 0 0", textAlign: "center" }}>
                  Showing top 12 frames by confidence · {framesForGallery.length} total with findings
                </p>
              )}
            </div>
          )}

          {/* Patient strip */}
          {patient && (
            <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)", border: "1px solid #bfdbfe", borderRadius: 12, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {`${patient.firstName?.[0] ?? ""}${patient.lastName?.[0] ?? ""}`.toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>{patient.firstName} {patient.lastName}</p>
                <p style={{ fontSize: 10, color: "#3b82f6", margin: "0.1rem 0 0" }}>
                  {[visit?.visitDate, visit?.visitType].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: report draft */}
        <div style={{ position: "sticky", top: 0, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.85rem 0.9rem", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d" }}>Live Monitoring</span>
            </div>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Report Draft</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem 0.9rem", scrollbarWidth: "thin" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {([
                { k: "clinicalNotes",  l: "Clinical Observations",  r: 3, p: "Describe findings from video monitoring..." },
                { k: "conclusion",     l: "Conclusion",              r: 3, p: "Diagnostic summary..." },
                { k: "recommendation", l: "Clinical Recommendation", r: 2, p: "Management plan..." },
              ] as { k: keyof typeof draft; l: string; r: number; p: string }[]).map(({ k, l, r, p }) => (
                <div key={k}>
                  <label style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{l}</label>
                  <textarea rows={r} placeholder={p} value={draft[k]}
                    onChange={e => setDraft(prev => ({ ...prev, [k]: e.target.value }))}
                    style={{ width: "100%", borderRadius: 7, border: "1px solid #e5e7eb", padding: "0.4rem 0.6rem", fontSize: 11, resize: "none", fontFamily: "inherit", boxSizing: "border-box", outline: "none", background: "#fafafa", lineHeight: 1.5, color: "#374151" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "#2563EB"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fafafa"; }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "0.75rem 0.9rem", borderTop: "1px solid #f1f5f9", background: "#fff" }}>
            {error && <p style={{ fontSize: 10, color: "#ef4444", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.35rem 0.6rem", margin: "0 0 0.5rem" }}>{error}</p>}
            {saved ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>Report saved successfully</span>
                </div>
                {savedReportId && (
                  <button type="button" onClick={() => router.push(`/reports?patientId=${patient?.id ?? ""}&reportId=${savedReportId}`)}
                    style={{ width: "100%", padding: "0.6rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", boxShadow: "0 2px 10px rgba(37,99,235,0.35)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    View Report
                  </button>
                )}
              </div>
            ) : !visitId ? (
              <div style={{ background: "#fafafa", border: "1px dashed #d1d5db", borderRadius: 8, padding: "0.6rem", textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>No visit linked — open from a visit to save</span>
              </div>
            ) : (
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ width: "100%", padding: "0.7rem", borderRadius: 9, border: "none", background: saving ? "#94a3b8" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", boxShadow: saving ? "none" : "0 4px 16px rgba(37,99,235,0.4)" }}>
                {saving ? (
                  <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Saving...</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Save Report</>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Live Mode ────────────────────────────────────────────────────────────────

// ── Helper: normalize bbox to percentage coordinates (0–100) ──────────────────
// The SVG overlay uses viewBox="0 0 100 100" with preserveAspectRatio="none",
// so every coordinate must be in the 0–100 range.
// If the API returns pixel values (e.g. x:320, y:180 on a 640×480 image)
// they need to be converted. If they are already 0–100 we leave them as-is.
function normalizeBbox(bbox: any): { x: number; y: number; w: number; h: number } {
  const x = bbox?.x ?? 10;
  const y = bbox?.y ?? 10;
  const w = bbox?.w ?? 20;
  const h = bbox?.h ?? 20;
  // Heuristic: if any value > 1 and > 100, it's likely pixels on a ~1000px image.
  // Otherwise assume already percentage.
  if (x > 100 || y > 100 || w > 100 || h > 100) {
    // Guess image dimensions from largest value; clamp to safe range.
    const maxVal = Math.max(x + w, y + h);
    const scale = 100 / maxVal;
    return {
      x: Math.min(Math.max(x * scale, 0), 95),
      y: Math.min(Math.max(y * scale, 0), 95),
      w: Math.min(w * scale, 100 - x * scale),
      h: Math.min(h * scale, 100 - y * scale),
    };
  }
  return { x, y, w, h };
}

// ── Convert raw API detections to Detection[] compatible with DetectionBoxes ──
function mapLiveDetections(rawDetections: any[]): Detection[] {
  return rawDetections.map((d: any, i: number) => {
    const bbox = normalizeBbox(d.bbox ?? d.boundingBox ?? {});
    return {
      id:            i,
      label:         d.label         ?? "Finding",
      confidence:    Math.round(d.confidence ?? 0),
      severity:      (d.severity     ?? "normal") as Severity,
      location:      d.location      ?? "",
      x:             bbox.x,
      y:             bbox.y,
      w:             bbox.w,
      h:             bbox.h,
      gradcamBase64: d.gradcamBase64 ?? null,
      cropBase64:    d.cropBase64    ?? null,
    };
  });
}

function LiveMode({ visitId, patient, visit }: { visitId: string | null; patient: any; visit: any; }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [file,           setFile]           = useState<File | null>(null);
  const [dragging,       setDragging]       = useState(false);
  const [stage,          setStage]          = useState<
    "idle" | "uploading" | "ready" | "processing" | "done"
  >("idle");
  const [uploadPct,      setUploadPct]      = useState(0);
  const [mediaId,        setMediaId]        = useState<string | null>(null);
  const [frameList,      setFrameList]      = useState<any[]>([]);
  const [totalFrames,    setTotalFrames]    = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentFrame,   setCurrentFrame]   = useState<any>(null);
  const [modelProcessMs, setModelProcessMs] = useState<number | null>(null); // actual AI inference time per frame
  const modelMsHistRef   = useRef<number[]>([]); // rolling window for avg
  const [allResults,     setAllResults]     = useState<any[]>([]);
  const [alerts,         setAlerts]         = useState<string[]>([]);
  const [error,          setError]          = useState("");
  const [isRunning,      setIsRunning]      = useState(false);
  const [viewMode,       setViewMode]       = useState<"analysis" | "video">("analysis");
  const [localVideoUrl,  setLocalVideoUrl]  = useState<string | null>(null);
  const [transcodeUrl,   setTranscodeUrl]   = useState<string | null>(null);
  const [transcoding,    setTranscoding]    = useState(false);
  const [showLiveReport,    setShowLiveReport]    = useState(false);
  const [videoValidation,   setVideoValidation]   = useState<"idle"|"checking"|"valid"|"invalid">("idle");
  const [videoValidReason,  setVideoValidReason]  = useState("");

  // ── Multi-part (split) state ──────────────────────────────────────────────
  type VideoPartMeta = { index: number; startSecs: number; endSecs: number; durationSecs: number; url: string };
  const [videoParts,     setVideoParts]     = useState<VideoPartMeta[]>([]);
  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const [isSplitting,    setIsSplitting]    = useState(false);

  // ── Segmentation-on-click (interactive, freezes playback) ────────────────
  // User clicks a bounding box → playback freezes on that frame while
  // segmentation runs. The detection fetcher (fetchAll) keeps filling the
  // buffer in the background, so when the user closes the modal playback
  // resumes from the SAME frame it stopped on — no frames are skipped.
  const pausedRef = useRef(false);
  const [segModal, setSegModal] = useState<{
    open: boolean;
    frame: any | null;
    bboxId: number | null;
    state: "idle" | "running" | "done" | "error";
    overlayB64: string | null;
    compositeUrl: string | null;
    segments: any[];
    error: string;
    saved: boolean;
  }>({ open: false, frame: null, bboxId: null, state: "idle", overlayB64: null, compositeUrl: null, segments: [], error: "", saved: false });

  const [rulerLines,  setRulerLines]  = useState<RulerLine_t[]>([]);
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerDraft,  setRulerDraft]  = useState<RulerLine_t | null>(null);
  const [rulerCursor, setRulerCursor] = useState<"crosshair"|"not-allowed">("crosshair");
  const liveMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const src = segModal.overlayB64;
    if (!src) { liveMaskCanvasRef.current = null; return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) { ctx.drawImage(img, 0, 0); liveMaskCanvasRef.current = c; }
    };
    img.onerror = () => { liveMaskCanvasRef.current = null; };
    img.src = src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
  }, [segModal.overlayB64]);

  const isOnLiveMask = (svgX: number, svgY: number): boolean => {
    const c = liveMaskCanvasRef.current;
    if (!c) return false; // mask not ready → block
    try {
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      const px = Math.min(Math.max(0, Math.round((svgX / RULER_W) * c.width)),  c.width  - 1);
      const py = Math.min(Math.max(0, Math.round((svgY / RULER_H) * c.height)), c.height - 1);
      const d = ctx.getImageData(px, py, 1, 1).data;
      return d[0] + d[1] + d[2] > 100;
    } catch { return false; }
  };

  const handleBoxClick = (id: number) => {
    if (!currentFrame) return;
    pausedRef.current = true;
    setSegModal({
      open: true, frame: currentFrame, bboxId: id,
      state: "idle", overlayB64: null, compositeUrl: null, segments: [], error: "", saved: false,
    });
  };

  const closeSegModal = () => {
    pausedRef.current = false;
    setSegModal({ open: false, frame: null, bboxId: null, state: "idle", overlayB64: null, compositeUrl: null, segments: [], error: "", saved: false });
    setRulerLines([]); setRulerActive(false); setRulerDraft(null); setRulerCursor("crosshair");
  };

  // Match the SVG overlay rect to the displayed (letterboxed) image rect
  // inside the modal — otherwise bboxes drift over the black bars.
  const modalImgRef = useRef<HTMLImageElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [modalOverlayStyle, setModalOverlayStyle] = useState<React.CSSProperties>({
    position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
  });
  useEffect(() => {
    if (!segModal.open) return;
    // Cached images may skip onLoad; recompute on open and on resize
    const id = setTimeout(computeModalOverlay, 50);
    const onResize = () => computeModalOverlay();
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(id); window.removeEventListener("resize", onResize); };
  }, [segModal.open, segModal.frame?.frameUrl]);

  const computeModalOverlay = () => {
    const img = modalImgRef.current;
    const con = modalContainerRef.current;
    if (!img || !con || !img.naturalWidth || !img.naturalHeight) return;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const ew = img.clientWidth,  eh = img.clientHeight;
    const imgAspect = nw / nh, elAspect = ew / eh;
    let rw: number, rh: number, rl: number, rt: number;
    if (imgAspect > elAspect) { rw = ew; rh = ew / imgAspect; rl = 0; rt = (eh - rh) / 2; }
    else                      { rh = eh; rw = eh * imgAspect; rl = (ew - rw) / 2; rt = 0; }
    const ir = img.getBoundingClientRect(), cr = con.getBoundingClientRect();
    setModalOverlayStyle({
      position: "absolute",
      left:   (ir.left - cr.left) + rl,
      top:    (ir.top  - cr.top)  + rt,
      width:  rw, height: rh, pointerEvents: "none",
    });
  };

  const runSegmentationOnFrame = async () => {
    if (!segModal.frame?.frameUrl) return;
    setSegModal(prev => ({ ...prev, state: "running", error: "" }));
    try {
      const imgRes = await fetch(segModal.frame.frameUrl);
      if (!imgRes.ok) throw new Error("Could not fetch frame image");
      const blob = await imgRes.blob();
      const fname = `frame_${segModal.frame.frameIndex ?? 0}.jpg`;
      const frameFile = new File([blob], fname, { type: blob.type || "image/jpeg" });
      const fd = new FormData();
      fd.append("file", frameFile);
      const res = await fetch("/api/ai/segment", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Segmentation failed");
      }
      const data = await res.json();
      const overlayB64: string | null = data.overlayBase64 ?? null;

      let blueOverlayUrl: string | null = null;
      let compositeUrl: string | null = null;
      let saved = false;

      if (overlayB64) {
        const rawOverlayUrl = `data:image/png;base64,${overlayB64.replace(/^data:[^;]+;base64,/, "")}`;
        const frameObjUrl = URL.createObjectURL(blob);
        try {
          const { renderSegmentationOverlay, compositeWithOverlay } = await import("@/lib/drawAnnotated");
          const processedUrl = await renderSegmentationOverlay(rawOverlayUrl);
          blueOverlayUrl = processedUrl;
          compositeUrl = await compositeWithOverlay(frameObjUrl, processedUrl, 1.0);
        } catch {}
        URL.revokeObjectURL(frameObjUrl);

        // Upload composite to DB
        if (visitId) {
          const stored = localStorage.getItem("doctor");
          const doctor = stored ? JSON.parse(stored) : null;
          const saveB64 = compositeUrl
            ? compositeUrl.replace(/^data:image\/jpeg;base64,/, "")
            : overlayB64;
          try {
            await uploadMedia(frameFile, visitId, doctor?.id, { overlayB64: saveB64, captureSource: "live_frame" });
            saved = true;
          } catch {}
        }
      }

      setSegModal(prev => ({
        ...prev, state: "done",
        overlayB64: blueOverlayUrl,   // orange transparent overlay (RGBA, no blend mode needed)
        compositeUrl,
        segments: data.segments ?? [],
        saved,
      }));
    } catch (e: any) {
      setSegModal(prev => ({ ...prev, state: "error", error: e.message ?? "Segmentation error" }));
    }
  };

  // Create / revoke a blob URL whenever the file changes
  useEffect(() => {
    if (!file) { setLocalVideoUrl(null); setTranscodeUrl(null); return; }
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Auto-start detection for segments 2+ (already validated)
  useEffect(() => {
    if (stage === "ready" && videoValidation === "valid" && videoParts.length > 1 && currentPartIdx > 0) {
      startProcessing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, videoValidation]);

  // Switch to video view — transcode non-native formats automatically
  const switchToVideo = async () => {
    setViewMode("video");
    if (!file || transcodeUrl || transcoding) return;

    // Check native browser support
    const probe = document.createElement("video");
    const canPlay = probe.canPlayType(file.type);
    if (canPlay === "probably" || canPlay === "maybe") return; // plays natively

    // Not natively playable (e.g. AVI) — transcode to MP4 silently
    setTranscoding(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/video/transcode", { method: "POST", body: fd });
      const data = await res.json();
      if (data.mp4Url) setTranscodeUrl(data.mp4Url);
    } catch { /* keep localVideoUrl as fallback */ }
    finally { setTranscoding(false); }
  };

  const abortRef     = useRef(false);
  const fileRef      = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const liveImgRef   = useRef<HTMLImageElement>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({
    position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
  });

  const computeOverlay = () => {
    const img = liveImgRef.current;
    const con = containerRef.current;
    if (!img || !con || !img.naturalWidth || !img.naturalHeight) return;
    const nw = img.naturalWidth,  nh = img.naturalHeight;
    const ew = img.clientWidth,   eh = img.clientHeight;
    const imgAspect = nw / nh, elAspect = ew / eh;
    let rw: number, rh: number, rl: number, rt: number;
    if (imgAspect > elAspect) { rw = ew; rh = ew / imgAspect; rl = 0; rt = (eh - rh) / 2; }
    else { rh = eh; rw = eh * imgAspect; rl = (ew - rw) / 2; rt = 0; }
    const ir = img.getBoundingClientRect(), cr = con.getBoundingClientRect();
    setOverlayStyle({ position: "absolute", left: (ir.left - cr.left) + rl, top: (ir.top - cr.top) + rt, width: rw, height: rh, pointerEvents: "none" });
  };

  const fmtMs = (ms: number) =>
    `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  const resetPartState = () => {
    abortRef.current = true;
    setStage("idle"); setUploadPct(0);
    setMediaId(null); setFrameList([]); setTotalFrames(0);
    setProcessedCount(0); setCurrentFrame(null); setAllResults([]);
    setAlerts([]); setError(""); setIsRunning(false);
    setViewMode("analysis"); setTranscoding(false);
    // transcodeUrl intentionally not cleared — set to next part's URL in uploadVideo
    setShowLiveReport(false);
    setVideoValidation("idle"); setVideoValidReason("");
    modelMsHistRef.current = [];
  };

  const resetAll = () => {
    resetPartState();
    setFile(null);
    setVideoParts([]); setCurrentPartIdx(0); setIsSplitting(false);
  };

  const getVideoDuration = (f: File): Promise<number> =>
    new Promise(resolve => {
      const url = URL.createObjectURL(f);
      const v   = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
      v.onerror          = () => { URL.revokeObjectURL(url); resolve(0); };
      v.src = url;
    });

  const handleFile = async (f: File) => {
    if (!f.type.startsWith("video/")) { setError("Please upload a video file (MP4, MOV, AVI)"); return; }
    resetAll();
    setFile(f); abortRef.current = false;

    const duration = await getVideoDuration(f);
    // duration === 0 means browser can't read metadata (e.g. AVI) — let the server decide
    if (duration === 0 || duration > 30) {
      setIsSplitting(true);
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res  = await fetch("/api/video/split", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Failed to split video");
        const data = await res.json();
        if (data.needsSplit && data.parts?.length > 1) {
          setVideoParts(data.parts);
          setCurrentPartIdx(0);
        }
      } catch (e: any) {
        setError(e.message ?? "Could not split video");
      } finally {
        setIsSplitting(false);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  // ── 1. Upload video ────────────────────────────────────────────────────────
  const uploadVideo = async (partIdxOverride?: number) => {
    if (!file || !visitId) return;
    setStage("uploading"); setError(""); setUploadPct(0);
    try {
      const stored = localStorage.getItem("doctor");
      const doctor = stored ? JSON.parse(stored) : null;

      let videoFile: File = file;
      const partIdx = partIdxOverride ?? currentPartIdx;

      if (videoParts.length > 0) {
        const part  = videoParts[partIdx];
        const dlPi  = setInterval(() => setUploadPct(p => Math.min(p + 3, 40)), 300);
        const pRes  = await fetch(part.url);
        clearInterval(dlPi);
        if (!pRes.ok) throw new Error("Failed to fetch video part");
        const blob = await pRes.blob();
        videoFile  = new File([blob], `part_${partIdx + 1}.mp4`, { type: "video/mp4" });
        setUploadPct(42);
        // Part is already MP4 from the split — use it directly, no transcode needed
        setTranscodeUrl(part.url);
      }

      const fd = new FormData();
      fd.append("file", videoFile);
      fd.append("fps", String(EXTRACTION_FPS));
      if (doctor?.id) fd.append("doctorId", doctor.id);
      const pi = setInterval(() => setUploadPct(p => Math.min(p + 4, 90)), 500);
      const res = await fetch(`/api/visits/${visitId}/video`, { method: "POST", body: fd });
      clearInterval(pi); setUploadPct(100);
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Upload failed"); }
      const data = await res.json();
      setMediaId(data.media?.id ?? null);
      setTotalFrames(data.media?.totalFrames ?? 0);
      setFrameList(data.frames ?? []);
      setStage("ready");
      switchToVideo();
      // Skip validation for segments after the first — already validated
      if (videoParts.length > 1 && partIdx > 0) {
        setVideoValidation("valid");
        return; // useEffect will auto-start processing once state settles
      }
      // Validate first frame in the background
      const firstFrameUrl = data.frames?.[0]?.frameUrl;
      if (firstFrameUrl) {
        setVideoValidation("checking");
        const vfd = new FormData();
        vfd.append("frameUrl", firstFrameUrl);
        fetch("/api/ai/validate-content", { method: "POST", body: vfd })
          .then(r => r.json())
          .then(d => { setVideoValidation(d.isValid ? "valid" : "invalid"); setVideoValidReason(d.reason ?? ""); })
          .catch(() => setVideoValidation("valid"));
      } else {
        setVideoValidation("valid");
      }
    } catch (e: any) { setError(e.message ?? "Upload error"); setStage("idle"); }
  };

  // ── 2. Process frames sequentially + smooth playback ─────────────────────
  const startProcessing = async () => {
    if (!visitId || !mediaId || frameList.length === 0) return;
    setIsRunning(true); abortRef.current = false;
    setStage("processing"); setProcessedCount(0); setAllResults([]); setAlerts([]);

    const resultsBuffer: (any | null)[] = new Array(frameList.length).fill(null);

    const fetchFrame = async (i: number) => {
      if (abortRef.current) return;
      const frame = frameList[i];
      const t0 = performance.now();
      try {
        const res  = await fetch(`/api/visits/${visitId}/video/process`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frameId: frame.id, mediaId }),
        });
        const data = await res.json();
        const elapsed = Math.round(performance.now() - t0);
        // rolling average over last 5 frames
        modelMsHistRef.current = [...modelMsHistRef.current.slice(-4), elapsed];
        const avg = Math.round(modelMsHistRef.current.reduce((a, b) => a + b, 0) / modelMsHistRef.current.length);
        setModelProcessMs(avg);
        if (res.ok) {
          resultsBuffer[i] = {
            frameIndex:  data.frameIndex  ?? i,
            timestampMs: data.timestampMs ?? Math.round(i * 500),
            frameUrl:    frame.frameUrl,
            detections:  mapLiveDetections(data.detections ?? []),
            overallRisk: data.overallRisk ?? "normal",
          };
          // Kick off image preload so it's in the browser cache when playback reaches this frame
          new Image().src = frame.frameUrl;
        }
      } catch { /* leave null */ }
    };

    const fetchAll = async () => {
      for (let i = 0; i < frameList.length; i += FETCH_CONCURRENCY) {
        if (abortRef.current) break;
        const batch = Array.from(
          { length: Math.min(FETCH_CONCURRENCY, frameList.length - i) },
          (_, j) => fetchFrame(i + j)
        );
        await Promise.all(batch);
      }
    };

    const playback = async () => {
      for (let i = 0; i < frameList.length; i++) {
        if (abortRef.current) break;
        const deadline = Date.now() + 15_000;
        while (resultsBuffer[i] === null && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 80));
        }
        const result = resultsBuffer[i];
        if (result) {
          // Wait for the frame image to be cached before switching — prevents black-frame flash under detections
          await new Promise<void>(resolve => {
            const preload = new Image();
            const timeout = setTimeout(resolve, 200);
            preload.onload = preload.onerror = () => { clearTimeout(timeout); resolve(); };
            preload.src = result.frameUrl;
          });
          if (abortRef.current) break;
          setCurrentFrame(result);
          setAllResults(prev => [...prev, result]);
          const highDet = result.detections.find((d: Detection) => d.severity === "high" && d.confidence > 80);
          if (highDet) {
            setAlerts(prev =>
              [`⚠️ ${highDet.label} (${highDet.confidence}%) @ ${fmtMs(result.timestampMs)}`, ...prev].slice(0, 5)
            );
          }
        }
        setProcessedCount(i + 1);
        await new Promise(r => setTimeout(r, FRAME_INTERVAL_MS));
        // Freeze on the current frame while the user is segmenting.
        // fetchAll() keeps populating resultsBuffer in parallel, so when the
        // user closes the modal we just resume the loop and the next frame
        // is already detected and ready.
        while (pausedRef.current && !abortRef.current) {
          await new Promise(r => setTimeout(r, 120));
        }
      }
      setIsRunning(false); setStage("done");
    };

    await Promise.all([fetchAll(), playback()]);
  };

  const stopProcessing = () => { abortRef.current = true; setIsRunning(false); };

  const goToNextPart = () => {
    const nextIdx = currentPartIdx + 1;
    if (nextIdx >= videoParts.length) return;
    setCurrentPartIdx(nextIdx);
    resetPartState();
    setTimeout(() => uploadVideo(nextIdx), 0);
  };

  const goToPrevPart = () => {
    const prevIdx = currentPartIdx - 1;
    if (prevIdx < 0) return;
    setCurrentPartIdx(prevIdx);
    resetPartState();
    setTimeout(() => uploadVideo(prevIdx), 0);
  };

  const captureFrame = async () => {
    if (!currentFrame?.frameUrl) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = currentFrame.frameUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const dets: Detection[] = liveDetections;
    if (dets.length > 0) {
      const fontSize = Math.max(12, Math.round(canvas.width / 50));
      const lineW    = Math.max(2, Math.round(canvas.width / 300));
      ctx.font = `bold ${fontSize}px sans-serif`;
      for (const d of dets) {
        const { dot } = severityStyle(d.severity);
        const bx = (d.x / 100) * canvas.width, by = (d.y / 100) * canvas.height;
        const bw = (d.w / 100) * canvas.width, bh = (d.h / 100) * canvas.height;

        // L-corner measurement markers
        const cLen = Math.max(8, Math.min(bw, bh) * 0.14);
        ctx.strokeStyle = dot; ctx.lineWidth = Math.max(3, canvas.width * 0.005); ctx.setLineDash([]);
        for (const [px, py, dx, dy] of [
          [bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1],
        ] as [number, number, number, number][]) {
          ctx.beginPath(); ctx.moveTo(px, py + dy * cLen); ctx.lineTo(px, py); ctx.lineTo(px + dx * cLen, py); ctx.stroke();
        }
        // Dashed main rect
        ctx.strokeStyle = dot; ctx.lineWidth = lineW; ctx.setLineDash([8, 5]);
        ctx.strokeRect(bx, by, bw, bh); ctx.setLineDash([]);

        // 2-line label background
        const txt    = `${d.label} · ${d.confidence}%`;
        const dimTxt = `W ${d.w.toFixed(1)}%  ·  H ${d.h.toFixed(1)}%`;
        const dimFs  = Math.max(10, Math.round(canvas.width / 65));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const tw1 = ctx.measureText(txt).width;
        ctx.font = `600 ${dimFs}px sans-serif`;
        const tw2 = ctx.measureText(dimTxt).width;
        const bgW = Math.max(tw1, tw2) + 12;
        const bgH = fontSize + dimFs + 14;
        const ly = by < bgH + 4 ? by + bh : by - bgH;
        ctx.fillStyle = dot; ctx.fillRect(bx, ly, bgW, bgH);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#fff"; ctx.fillText(txt, bx + 6, ly + fontSize + 3);
        ctx.font = `600 ${dimFs}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText(dimTxt, bx + 6, ly + fontSize + dimFs + 8);
      }
    }
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `frame_${currentFrame.frameIndex + 1}_annotated.jpg`;
      a.click(); URL.revokeObjectURL(url);
    }, "image/jpeg", 0.92);
  };

  const progressPct         = totalFrames > 0 ? Math.round((processedCount / totalFrames) * 100) : 0;
  const framesWithDetection = allResults.filter(r => r.detections.length > 0).length;
  const highRiskFrames      = allResults.filter(r => r.overallRisk === "high").length;
  const overallStyle        = currentFrame ? severityStyle(currentFrame.overallRisk) : null;
  const liveDetections: Detection[] = currentFrame?.detections ?? [];

  if (showLiveReport) {
    return (
      <LiveVideoReportPanel
        patient={patient} visit={visit} visitId={visitId}
        mediaId={mediaId}
        processedCount={processedCount}
        framesWithDetection={framesWithDetection}
        highRiskFrames={highRiskFrames}
        allResults={allResults}
        frameList={frameList}
        onBack={() => setShowLiveReport(false)}
      />
    );
  }

  // ── Live Monitoring pipeline stepper ────────────────────────────────────
  const livePhases = [
    {
      label: "Upload",
      est: "~10s",
      done: stage === "ready" || stage === "processing" || stage === "done",
      active: stage === "uploading",
      onView: undefined as (() => void) | undefined,
    },
    {
      label: "Watch Video",
      est: "—",
      done: stage === "processing" || stage === "done",
      active: stage === "ready",
      onView: (stage === "ready" || stage === "processing" || stage === "done")
        ? () => { switchToVideo(); }
        : undefined,
    },
    {
      label: "AI Detection",
      est: "~varies",
      done: stage === "done",
      active: stage === "processing",
      onView: (stage === "processing" || stage === "done")
        ? () => setViewMode("analysis")
        : undefined,
    },
  ];
  const liveSelectedIdx = stage === "done" ? 2 : stage === "processing" ? 2 : stage === "ready" ? 1 : 0;
  const liveOverallPct =
    stage === "done"       ? 100 :
    stage === "processing" ? 65  :
    stage === "ready"      ? 33  :
    stage === "uploading"  ? 16  : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* ── Pipeline stepper ── */}
      {(file || stage !== "idle") && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.55rem 0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
            {livePhases.map((ph, i) => {
              const isDone     = ph.done;
              const isActive   = ph.active;
              const isSelected = i === liveSelectedIdx;
              const clickable  = !!ph.onView;
              return (
                <React.Fragment key={ph.label}>
                  <div
                    onClick={clickable ? ph.onView : undefined}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", cursor: clickable ? "pointer" : "default", userSelect: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        background: isDone ? "#2563EB" : isActive ? "#2563EB" : "#e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.3s",
                        boxShadow: isSelected && isDone ? "0 0 0 3px #2563EB" : isDone ? "0 0 0 3px #dcfce7" : isActive ? "0 0 0 3px #dbeafe" : "none",
                      }}>
                        {isDone
                          ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : isActive
                            ? <div style={{ width: 6, height: 6, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                            : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#94a3b8", display: "block" }} />
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: isDone ? 700 : isActive ? 700 : 500, color: isSelected && isDone ? "#2563eb" : isDone ? "#16a34a" : isActive ? "#1d4ed8" : "#94a3b8", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                          {ph.label}
                        </div>
                        <div style={{ fontSize: 8, color: isDone ? "#2563EB" : isActive ? "#60a5fa" : "#cbd5e1", fontWeight: 600, lineHeight: 1 }}>
                          {isDone ? "✓ done" : isActive ? "running…" : ph.est}
                        </div>
                      </div>
                    </div>
                  </div>
                  {i < livePhases.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: isDone ? "#86efac" : "#e2e8f0", borderRadius: 99, minWidth: 8, transition: "background 0.3s" }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ height: 3, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${liveOverallPct}%`, height: "100%", background: "linear-gradient(90deg, #2563EB, #a855f7)", borderRadius: 99, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}


      {/* ── WATCH VIDEO — standalone full-width view ── */}
      {viewMode === "video" && file && (
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ background: "#000", position: "relative" }}>
            {/* Always show the video immediately using local file — transcoded URL replaces it when ready */}
            <video
              key={transcodeUrl ?? localVideoUrl ?? ""}
              src={transcodeUrl ?? localVideoUrl ?? undefined}
              controls
              style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", display: "block" }}
            />
            {/* Subtle badge while transcoding in background */}
            {transcoding && (
              <div style={{
                position: "absolute", top: 10, right: 10,
                background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
                border: "1px solid rgba(37,99,235,0.4)", borderRadius: 6,
                padding: "4px 10px", display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 8, height: 8, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Optimising format…</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.85rem", background: "#0f172a" }}>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name}
            </p>
            {stage === "ready" && (
              <button type="button" onClick={() => { setVideoValidation("valid"); setViewMode("analysis"); startProcessing(); }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Skip to Detection
              </button>
            )}
            <button type="button" onClick={resetAll}
              style={{ padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ── AI ANALYSIS — 2-column layout ── */}
      {/* ── Segmentation-on-bbox-click modal ── */}
      {segModal.open && segModal.frame && (
        <div
          onClick={closeSegModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.72)",
            backdropFilter: "blur(4px)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, width: "min(960px, 100%)",
              maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.85rem 1.1rem", borderBottom: "1px solid #e5e7eb",
              background: "linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%)",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7" }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e3a5f" }}>
                Lesion Delineation
              </p>
              <button
                type="button"
                onClick={closeSegModal}
                style={{
                  marginLeft: "auto", background: "transparent", border: "1px solid #e2e8f0",
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                  color: "#64748b", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Close ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.85rem" }}>
              {/* Original frame with bounding boxes */}
              <div ref={modalContainerRef} style={{ position: "relative", background: "#000", borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  ref={modalImgRef}
                  src={segModal.frame.frameUrl}
                  alt="Selected frame"
                  onLoad={computeModalOverlay}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
                {(segModal.frame.detections ?? []).length > 0 && (
                  <DetectionBoxes
                    detections={segModal.frame.detections}
                    activeId={segModal.bboxId}
                    onSelect={() => {}}
                    svgStyle={modalOverlayStyle}
                  />
                )}
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, zIndex: 2 }}>
                  AI Findings
                </div>
              </div>

              {/* Segmentation result + caliper ruler tool */}
              <div style={{ position: "relative", background: "#0f172a", borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Base frame */}
                {segModal.state === "done" && segModal.frame?.frameUrl && (
                  <img src={segModal.frame.frameUrl} alt="Frame"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                )}
                {segModal.state === "idle" && (
                  <div style={{ textAlign: "center", padding: "1rem" }}>
                    <p style={{ color: "#cbd5e1", fontSize: 12, margin: "0 0 0.75rem", fontWeight: 600 }}>
                      Outline lesion margins on this image?
                    </p>
                    <button type="button" onClick={runSegmentationOnFrame}
                      style={{ background: "linear-gradient(135deg, #a855f7, #1D4ED8)", color: "#fff", border: "none", borderRadius: 8, padding: "0.55rem 1.2rem", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(168,85,247,0.4)" }}>
                      Delineate Lesion
                    </button>
                  </div>
                )}
                {segModal.state === "running" && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.18)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.6rem" }} />
                    <p style={{ color: "#cbd5e1", fontSize: 11, margin: 0, fontWeight: 600 }}>Outlining lesion margins…</p>
                  </div>
                )}
                {segModal.state === "done" && segModal.overlayB64 && (
                  <>
                    <img src={segModal.overlayB64} alt="Lesion delineation"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                    <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(59,130,246,0.88)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4 }}>
                      Lesion Margins
                    </div>
                    {segModal.saved && (
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(37,99,235,0.92)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Saved to gallery
                      </div>
                    )}
                  </>
                )}
                {segModal.state === "error" && (
                  <div style={{ textAlign: "center", padding: "1rem" }}>
                    <p style={{ color: "#fca5a5", fontSize: 11, margin: "0 0 0.6rem", fontWeight: 600 }}>{segModal.error}</p>
                    <button type="button" onClick={runSegmentationOnFrame}
                      style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "0.4rem 0.9rem", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Retry
                    </button>
                  </div>
                )}

                {/* ── Caliper ruler overlay (only after segmentation is done) ── */}
                {segModal.state === "done" && (
                  <>
                    {/* Ruler toggle + clear buttons */}
                    <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 4 }}>
                      {rulerActive && rulerLines.length > 0 && (
                        <button type="button" onClick={() => { setRulerLines([]); setRulerDraft(null); }}
                          style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(239,68,68,0.75)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Clear
                        </button>
                      )}
                      <button type="button"
                        onClick={() => { setRulerActive(r => !r); setRulerDraft(null); }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 5, border: `1px solid ${rulerActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"}`, background: rulerActive ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.6)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {/* Ruler icon */}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l18 0M3 15l18 0M3 9v6M21 9v6"/>
                          <path d="M7 9v3M11 9v3M15 9v3M19 9v3"/>
                        </svg>
                        {rulerActive ? "Measuring…" : "Measure"}
                      </button>
                    </div>

                    {/* Interactive SVG ruler */}
                    {rulerActive && (
                      <svg
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 8, cursor: rulerCursor }}
                        viewBox={`0 0 ${RULER_W} ${RULER_H}`}
                        preserveAspectRatio="none"
                        onMouseDown={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - r.left) / r.width  * RULER_W;
                          const y = (e.clientY - r.top)  / r.height * RULER_H;
                          if (!isOnLiveMask(x, y)) return;
                          setRulerDraft({ x1: x, y1: y, x2: x, y2: y });
                          e.preventDefault();
                        }}
                        onMouseMove={e => {
                          const r = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - r.left) / r.width  * RULER_W;
                          const y = (e.clientY - r.top)  / r.height * RULER_H;
                          setRulerCursor(isOnLiveMask(x, y) ? "crosshair" : "not-allowed");
                          if (rulerDraft)
                            setRulerDraft(prev => prev ? { ...prev, x2: x, y2: y } : null);
                        }}
                        onMouseUp={e => {
                          if (!rulerDraft) return;
                          const r = e.currentTarget.getBoundingClientRect();
                          const ex = (e.clientX - r.left) / r.width  * RULER_W;
                          const ey = (e.clientY - r.top)  / r.height * RULER_H;
                          const dx = rulerDraft.x2 - rulerDraft.x1;
                          const dy = rulerDraft.y2 - rulerDraft.y1;
                          if (Math.sqrt(dx * dx + dy * dy) > 3 && isOnLiveMask(ex, ey))
                            setRulerLines(prev => [...prev, rulerDraft]);
                          setRulerDraft(null);
                        }}
                        onMouseLeave={() => setRulerDraft(null)}
                      >
                        {(() => { const offs = resolveRulerLabels(rulerLines); return rulerLines.map((l, i) => <RulerLineEl key={i} l={l} labelOff={offs[i]} />); })()}
                        {rulerDraft && <RulerLineEl l={rulerDraft} draft />}
                      </svg>
                    )}

                    {/* Hint when ruler is active and no lines yet */}
                    {rulerActive && rulerLines.length === 0 && !rulerDraft && (
                      <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 9, fontWeight: 600, padding: "4px 10px", borderRadius: 4, pointerEvents: "none", whiteSpace: "nowrap" }}>
                        Click and drag to measure
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Per-lesion legend */}
            {segModal.state === "done" && segModal.segments.length > 0 && (
              <div style={{ borderTop: "1px solid #e5e7eb", padding: "0.7rem 1rem" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.45rem" }}>
                  {segModal.segments.length} lesion{segModal.segments.length !== 1 ? "s" : ""} delineated
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {segModal.segments.map((s: any, i: number) => {
                    const color = s.color ?? "#a855f7";
                    return (
                      <span key={i} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        fontSize: 10, fontWeight: 700, color: "#1e3a5f",
                        background: "#fff", border: `1px solid ${color}55`,
                        borderRadius: 5, padding: "3px 8px",
                      }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: color, border: `1px solid ${color}` }} />
                        {s.label ?? "Lesion"} {i + 1}
                        {typeof s.area_pct === "number" && (
                          <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {s.area_pct}% area</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "analysis" && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: "1rem" }}>

      {/* ── Left ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.45rem 0.85rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", boxShadow: isRunning ? "0 0 8px #2563EB" : "none", transition: "box-shadow 0.3s" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f" }}>Real-Time Endoscopy Monitoring</span>
          </div>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>|</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 5, padding: "2px 8px" }}>
            AI-Assisted Lesion Detection
          </span>
          {stage === "processing" && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, border: "2px solid #e2e8f0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#2563EB" }}>{processedCount} / {totalFrames} frames</span>
            </div>
          )}
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? "#2563EB" : "#cbd5e1"}`, borderRadius: 12, padding: "3rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", cursor: "pointer", background: dragging ? "#f0fdf4" : "#f8fafc", transition: "all 0.2s", minHeight: 280 }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: dragging ? "#dcfce7" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dragging ? "#2563EB" : "#94a3b8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>Upload Endoscopy Video</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "0.25rem 0 0" }}>MP4, MOV, AVI · max 500 MB</p>
            </div>
            <span style={{ padding: "0.45rem 1.25rem", borderRadius: 7, background: "#fff", border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 600, color: "#374151" }}>Browse Files</span>
            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
        ) : (
          /* ── Analysis Viewer ── */
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>

            {/* Display area */}
            <div ref={containerRef} style={{ position: "relative", background: "#000", minHeight: 280, maxHeight: "52vh", display: "flex", alignItems: "center", justifyContent: "center" }}>

              {currentFrame?.frameUrl ? (
                /* ── AI analysis frame ── */
                <>
                  <img
                    ref={liveImgRef}
                    key={currentFrame.frameIndex}
                    src={currentFrame.frameUrl}
                    alt={`Frame ${currentFrame.frameIndex}`}
                    onLoad={computeOverlay}
                    style={{ width: "100%", maxHeight: "52vh", objectFit: "contain", display: "block", animation: "frameFade 0.15s ease-in-out" }}
                  />
                  {liveDetections.length > 0 && (
                    <DetectionBoxes
                      detections={liveDetections}
                      activeId={segModal.open ? segModal.bboxId : null}
                      onSelect={handleBoxClick}
                      svgStyle={overlayStyle}
                    />
                  )}
                </>
              ) : null}

              {/* Preparing overlay (silent split in background) */}
              {isSplitting && (
                <div style={{ position: "absolute", top: "0.6rem", left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.82)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: "0.5rem", zIndex: 10 }}>
                  <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#93c5fd" }}>Preparing video…</span>
                </div>
              )}

              {/* Uploading overlay */}
              {stage === "uploading" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {videoParts.length > 1 ? `Preparing part ${currentPartIdx + 1} of ${videoParts.length}…` : "Preparing examination…"}
                  </p>
                  <div style={{ width: 200, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 99 }}>
                    <div style={{ width: `${uploadPct}%`, height: "100%", background: "#2563EB", borderRadius: 99, transition: "width 0.4s" }} />
                  </div>
                  <p style={{ color: "#94a3b8", fontSize: 10, margin: 0 }}>{uploadPct}%</p>
                </div>
              )}

              {/* Risk badge */}
              {currentFrame && overallStyle && (
                <div style={{ position: "absolute", top: "0.5rem", left: "0.5rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: `1px solid ${overallStyle.dot}66`, borderRadius: 6, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: overallStyle.dot, boxShadow: `0 0 6px ${overallStyle.dot}` }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: overallStyle.dot }}>{overallStyle.label}</span>
                </div>
              )}

              {/* Segment badge */}
              {videoParts.length > 1 && (
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "rgba(15,23,42,0.82)", backdropFilter: "blur(6px)", border: "1px solid rgba(96,165,250,0.35)", color: "#93c5fd", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 4, fontFamily: "monospace", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                  SEG {currentPartIdx + 1} / {videoParts.length}
                  <span style={{ color: "#475569", marginLeft: 2 }}>
                    ({Math.round(videoParts[currentPartIdx]?.startSecs ?? 0)}s – {Math.round(videoParts[currentPartIdx]?.endSecs ?? 0)}s)
                  </span>
                </div>
              )}

              {/* Timestamp badge */}
              {currentFrame && (
                <div style={{ position: "absolute", top: videoParts.length > 1 ? "2rem" : "0.5rem", right: "0.5rem", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, fontFamily: "monospace" }}>
                  {fmtMs(currentFrame.timestampMs)} · F{currentFrame.frameIndex + 1}
                </div>
              )}

              {/* Detection count badge */}
              {currentFrame && liveDetections.length > 0 && (
                <div style={{ position: "absolute", bottom: "0.5rem", left: "0.5rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
                  {liveDetections.length} lesion{liveDetections.length !== 1 ? "s" : ""} detected
                </div>
              )}

              {/* Live pulse */}
              {isRunning && (
                <div style={{ position: "absolute", bottom: "0.5rem", right: "0.5rem", background: "rgba(37,99,235,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "livePulse 1s ease-in-out infinite", display: "inline-block" }} />
                  LIVE · AI Active
                </div>
              )}

              {/* Progress bar */}
              {stage === "processing" && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ width: `${progressPct}%`, height: "100%", background: "#2563EB", transition: "width 0.3s" }} />
                </div>
              )}

              {/* ── Video content validation overlay (ready stage) ── */}
              {stage === "ready" && videoValidation === "checking" && (
                <div style={{ position: "absolute", top: "0.6rem", left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "center", gap: "0.5rem", zIndex: 10 }}>
                  <span style={{ width: 11, height: 11, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fbbf24", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#fbbf24" }}>Verifying video content…</span>
                </div>
              )}
              {stage === "ready" && videoValidation === "valid" && (
                <div style={{ position: "absolute", top: "0.6rem", left: "0.6rem", background: "rgba(37,99,235,0.9)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, zIndex: 10 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Endoscopy Verified
                </div>
              )}
            </div>

            {/* ── Video info strip (fps + interval) ── */}
            {totalFrames > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0",
                padding: "0.38rem 0.85rem",
                background: "#060c18", borderTop: "1px solid #1a2540",
                overflowX: "auto", flexShrink: 0,
              }}>
                {/* Extraction FPS */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", paddingRight: "0.85rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                    <line x1="7" y1="2" x2="7" y2="22"/>
                    <line x1="17" y1="2" x2="17" y2="22"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                  </svg>
                  <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "monospace" }}>EXTRACTION</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB", fontFamily: "monospace" }}>{EXTRACTION_FPS} fps</span>
                  <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>
                    (1 frame / {FRAME_INTERVAL_S}s of video)
                  </span>
                </div>

                <span style={{ width: 1, height: 16, background: "#1e293b", flexShrink: 0 }} />

                {/* Model inference time — live measured */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", paddingLeft: "0.85rem", paddingRight: "0.85rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "monospace" }}>MODEL</span>
                  {modelProcessMs !== null ? (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#2563EB", fontFamily: "monospace" }}>
                        {modelProcessMs < 1000 ? `${modelProcessMs} ms` : `${(modelProcessMs / 1000).toFixed(1)} s`}
                      </span>
                      <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>/ frame (avg 5)</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>— awaiting first frame</span>
                  )}
                </div>

                <span style={{ width: 1, height: 16, background: "#1e293b", flexShrink: 0 }} />

                {/* Total frames */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", paddingLeft: "0.85rem", paddingRight: "0.85rem" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                    <line x1="4" y1="22" x2="4" y2="15"/>
                  </svg>
                  <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "monospace" }}>TOTAL</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", fontFamily: "monospace" }}>{totalFrames}</span>
                  <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>frames</span>
                </div>

                {/* Live progress — only while processing */}
                {stage === "processing" && (
                  <>
                    <span style={{ width: 1, height: 16, background: "#1e293b", flexShrink: 0 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", paddingLeft: "0.85rem" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", animation: "livePulse 1s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "monospace" }}>NOW</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24", fontFamily: "monospace" }}>
                        {currentFrame ? `F${currentFrame.frameIndex + 1} · ${fmtMs(currentFrame.timestampMs)}` : "—"}
                      </span>
                      <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace" }}>
                        ({processedCount}/{totalFrames})
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Controls bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.85rem", background: "#0f172a", flexWrap: "wrap" }}>
              <p style={{ fontSize: 10, color: "#64748b", margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file?.name}{totalFrames > 0 && ` · ${totalFrames} frames`}
              </p>

              {stage === "idle" && !visitId && (
                <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>No visit linked</span>
              )}
              {stage === "idle" && visitId && (
                <button type="button" onClick={() => uploadVideo()} disabled={isSplitting}
                  style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: isSplitting ? "#1e3a5f" : "linear-gradient(135deg,#2563EB,#16a34a)", color: isSplitting ? "#60a5fa" : "#fff", fontSize: 11, fontWeight: 700, cursor: isSplitting ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: isSplitting ? "none" : "0 2px 10px rgba(37,99,235,0.4)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {isSplitting && <span style={{ width: 9, height: 9, border: "2px solid rgba(96,165,250,0.3)", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />}
                  {isSplitting ? "Preparing…" : "Start Analysis"}
                </button>
              )}
              {stage === "ready" && (
                videoValidation === "checking"
                  ? <span style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>Verifying content…</span>
                  : <button type="button" onClick={startProcessing}
                      style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)" }}>
                      ▶ Start Live Analysis
                    </button>
              )}
              {stage === "processing" && (
                <button type="button" onClick={stopProcessing}
                  style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ■ Stop
                </button>
              )}
              {currentFrame && (
                <button type="button" onClick={captureFrame}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #2563EB", background: "rgba(37,99,235,0.12)", color: "#16a34a", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Save Frame
                </button>
              )}

              {/* Segment navigation */}
              {videoParts.length > 1 && (stage === "done" || stage === "ready") && (
                <>
                  {currentPartIdx > 0 && (
                    <button type="button" onClick={goToPrevPart}
                      style={{ padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #334155", background: "rgba(30,41,59,0.8)", color: "#94a3b8", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      Previous segment
                    </button>
                  )}
                  {currentPartIdx < videoParts.length - 1 && (
                    <button type="button" onClick={goToNextPart}
                      style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem", boxShadow: "0 2px 8px rgba(37,99,235,0.4)" }}>
                      Analyse next segment
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  )}
                </>
              )}

              <button type="button" onClick={resetAll}
                style={{ padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Reset
              </button>
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 11, padding: "0.45rem 0.85rem", background: "#1c0909", margin: 0 }}>{error}</p>}
          </div>
        )}

        {/* Visit Summary */}
        {stage === "done" && allResults.length > 0 && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "0.85rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#1e3a5f", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Visit Summary</p>
              {visitId && (
                <button type="button" onClick={() => setShowLiveReport(true)}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 1rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.4)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                  Generate Report
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.5rem" }}>
              {([
                ["Frames",        String(processedCount),                        "#2563EB"],
                ["With Findings", String(framesWithDetection),                   "#f59e0b"],
                ["High Risk",     String(highRiskFrames),                        "#ef4444"],
                ["Clean",         String(processedCount - framesWithDetection),  "#2563EB"],
              ] as [string, string, string][]).map(([l, v, c]) => (
                <div key={l} style={{ background: "#fff", borderRadius: 8, padding: "0.5rem", textAlign: "center", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: c, margin: 0 }}>{v}</p>
                  <p style={{ fontSize: 9, color: "#6b7280", margin: "0.1rem 0 0", fontWeight: 600, textTransform: "uppercase" }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>


        {/* Status */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.6rem" }}>Session Status</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
            {([
              ["Status",   stage === "processing" ? "▶ Live" : stage === "done" ? "✓ Done" : stage === "ready" ? "Ready" : "Idle",
               stage === "processing" ? "#2563EB" : stage === "done" ? "#2563EB" : "#9ca3af"],
              ["Frames",   totalFrames > 0 ? `${processedCount}/${totalFrames}` : "—", "#2563EB"],
              ["Findings", String(framesWithDetection), "#f59e0b"],
              ["Progress", totalFrames > 0 ? `${progressPct}%` : "—", "#1D4ED8"],
            ] as [string, string, string][]).map(([l, v, c]) => (
              <div key={l} style={{ background: "#f8fafc", borderRadius: 7, padding: "0.45rem 0.6rem" }}>
                <p style={{ fontSize: 9, color: "#9ca3af", margin: 0, fontWeight: 600, textTransform: "uppercase" }}>{l}</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: c, margin: "0.1rem 0 0" }}>{v}</p>
              </div>
            ))}
          </div>
          {totalFrames > 0 && (
            <div style={{ marginTop: "0.6rem", height: 3, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg,#2563EB,#1D4ED8)", borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          )}
        </div>

        {/* Real-Time Findings */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 0.5rem" }}>Real-Time Findings</p>
          {liveDetections.length === 0 ? (
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, textAlign: "center", padding: "0.75rem 0" }}>
              {isRunning ? "Scanning..." : "No active session"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {liveDetections.map((d, i) => {
                const s = severityStyle(d.severity as Severity);
                return (
                  <div key={i} style={{ borderRadius: 8, padding: "0.5rem 0.65rem", border: `1px solid ${s.border}`, background: s.bg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#1f2937", margin: 0 }}>{d.label}</p>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: "#fff", padding: "2px 6px", borderRadius: 4, border: `1px solid ${s.border}` }}>{s.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                      <div style={{ flex: 1, height: 3, background: "#fff", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${d.confidence}%`, height: "100%", background: s.color, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{d.confidence}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clinical Alerts */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.85rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Clinical Alerts</p>
            {alerts.length > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 10 }}>{alerts.length}</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, textAlign: "center", padding: "0.5rem 0" }}>No alerts</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.4rem 0.6rem", fontSize: 10, color: "#dc2626", fontWeight: 600 }}>{a}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
      )}

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const searchParams  = useSearchParams();
  const urlVisitId    = searchParams.get("visitId");
  const isGuest       = searchParams.get("guest") === "true";
  const [guestCount,  setGuestCount] = useState<number>(0);

  const [visitId,    setVisitId]  = useState<string | null>(null);
  const [fromSaved,  setFromSaved] = useState(false); // true when restored from localStorage
  const [mode,    setMode]    = useState<"image" | "live">("image");
  const [visit,   setVisit]   = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGuest) return;
    setGuestCount(getGuestCount());
    const sync = () => setGuestCount(getGuestCount());
    window.addEventListener("guest-detection", sync);
    return () => window.removeEventListener("guest-detection", sync);
  }, [isGuest]);

  // Resolve effective visitId: URL param takes priority, else restore from localStorage
  useEffect(() => {
    if (isGuest) { setVisitId(null); setLoading(false); return; }
    if (urlVisitId) {
      localStorage.setItem("lastVisitId", urlVisitId);
      setVisitId(urlVisitId);
      setFromSaved(false);
    } else {
      const saved = localStorage.getItem("lastVisitId");
      if (saved) { setVisitId(saved); setFromSaved(true); }
      else        { setVisitId(null); setLoading(false); }
    }
  }, [urlVisitId, isGuest]);

  // Fetch visit + patient whenever visitId resolves
  useEffect(() => {
    if (!visitId) { setVisit(null); setPatient(null); return; }
    setLoading(true);
    fetch(`/api/visits/${visitId}`)
      .then(r => r.json())
      .then(data => {
        if (data.visit) { setVisit(data.visit); setPatient(data.visit.patient); }
        else            { setVisit(null); setPatient(null); }
      })
      .catch(() => { setVisit(null); setPatient(null); })
      .finally(() => setLoading(false));
  }, [visitId]);

  const clearSession = () => {
    localStorage.removeItem("lastVisitId");
    setVisitId(null); setVisit(null); setPatient(null); setFromSaved(false);
  };

  return (
    <div className="analysis-page-wrap">
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes frameFade  { from { opacity: 0.7; } to { opacity: 1; } }
        @keyframes livePulse  { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        @keyframes blink      { 0%, 80%, 100% { opacity: 0.15; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em", margin: 0, fontFamily: "var(--font-display)" }}>
            {mode === "image" ? "AI-Assisted Endoscopy Analysis" : "Real-Time Endoscopy Monitoring"}
          </h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
            {mode === "image"
              ? "Computer-aided detection with saliency mapping and optional mucosal analysis."
              : "Real-Time AI-assisted lesion detection with bounding box visualization."}
          </p>
        </div>
        {!isGuest && (
          <div className="mode-toggle">
            {([{ id: "image", l: "Image Analysis" }, { id: "live", l: "Real-Time Endoscopy Monitoring" }] as { id: "image" | "live"; l: string }[]).map(m => (
              <button key={m.id} type="button" className={`mode-toggle-btn${mode === m.id ? " active" : ""}`} onClick={() => setMode(m.id)}>{m.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Patient context banner */}
      {isGuest ? (
        <GuestBanner count={guestCount} />
      ) : loading ? (
        <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: 11, height: 11, border: "2px solid #cbd5e1", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
          Loading patient record...
        </div>
      ) : patient ? (
        <div style={{ position: "relative" }}>
          <PatientStrip patient={patient} visit={visit} />
          {/* "Saved session" indicator + change button */}
          {fromSaved && (
            <div style={{
              position: "absolute", top: "50%", right: "0.75rem", transform: "translateY(-50%)",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#2563EB", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5, padding: "2px 7px" }}>
                Visit restored
              </span>
              <button
                type="button"
                onClick={clearSession}
                style={{
                  fontSize: 10, fontWeight: 700, color: "#6b7280",
                  background: "rgba(255,255,255,0.85)", border: "1px solid #e2e8f0",
                  borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Change Patient
              </button>
            </div>
          )}
        </div>
      ) : visitId ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, margin: 0, flex: 1 }}>Visit not found.</p>
          <button type="button" onClick={clearSession} style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "transparent", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Clear &amp; Link New Visit
          </button>
        </div>
      ) : (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "0.6rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{ fontSize: 11, color: "#c2410c", fontWeight: 600, margin: 0 }}>No patient linked — open from a patient visit to save analysis results.</p>
        </div>
      )}

      {mode === "image"
        ? <ImageAnalysisMode visitId={visitId} patient={patient} visit={visit} isGuest={isGuest} />
        : <LiveMode visitId={visitId} patient={patient} visit={visit} />
      }
    </div>
  );
}


