"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Segment {
  id: number;
  label: string;
  confidence: number;
  area_pct: number;
  severity: string;
  bbox: { x: number; y: number; w: number; h: number };
}
interface AutoImage {
  id: string;
  file: File;
  filename: string;
  originalBase64: string;
  maskBase64: string;
  overlayBase64: string;   // image + green contour
  segments: Segment[];
  status: "idle" | "processing" | "done" | "error";
  error?: string;
  savedToGallery:  boolean;
  savingToGallery: boolean;
}
interface Annotation {
  id: string;
  label: string;
  points: [number, number][];
  color: string;
  tool?: "polygon" | "rect" | "point" | "line";
}
interface ManualImage {
  id: string;
  file: File;
  filename: string;
  base64: string;
  annotations: Annotation[];
  maskBase64: string | null;
  saved: boolean;
}

type DrawTool = "polygon" | "rect" | "point" | "line" | "pan";

const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#a855f7","#ec4899","#14b8a6"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function buildFallbackMask(segments: Segment[], width: number, height: number): string {
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  for (const s of segments) {
    const x = (s.bbox.x / 100) * width;
    const y = (s.bbox.y / 100) * height;
    const w = (s.bbox.w / 100) * width;
    const h = (s.bbox.h / 100) * height;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return c.toDataURL("image/png");
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AnnotationPage() {
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "manual") setMode("manual");
  }, []);

  // ── Auto mode state ──
  const [autoQueue,   setAutoQueue]   = useState<AutoImage[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoDrop = useRef<HTMLDivElement>(null);
  const [itemRatings,    setItemRatings]    = useState<Record<string, { stars: number; note: string }>>({});
  const [confirmedRatings, setConfirmedRatings] = useState<Record<string, boolean>>({});
  const [showNotePopup, setShowNotePopup] = useState<string | null>(null);

  // ── Manual mode state ──
  const [manualQueue,  setManualQueue]  = useState<ManualImage[]>([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [annotations,  setAnnotations]  = useState<Annotation[]>([]);
  const [currentPts,   setCurrentPts]   = useState<[number, number][]>([]);
  const [currentLabel, setCurrentLabel] = useState("Lesion");
  const [colorIdx,     setColorIdx]     = useState(0);
  const [showMask,     setShowMask]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [savedMsg,     setSavedMsg]     = useState("");
  const [mousePos,     setMousePos]     = useState<[number, number] | null>(null);
  const [baseCSS,      setBaseCSS]      = useState<{ w: number; h: number }>({ w: 700, h: 400 });
  const [zoom,         setZoom]         = useState(1);
  const [activeTool,   setActiveTool]   = useState<DrawTool>("polygon");
  const [rectAnchor,   setRectAnchor]   = useState<[number, number] | null>(null);
  const [isPanning,    setIsPanning]    = useState(false);
  const [panStart,     setPanStart]     = useState<{ x: number; y: number; sl: number; st: number } | null>(null);

  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const imgRef          = useRef<HTMLImageElement | null>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const scrollRef       = useRef<HTMLDivElement>(null);

  // Derived
  const currentItem  = manualQueue[currentIdx] ?? null;
  const manualBase64 = currentItem?.base64 ?? null;
  const maskPreview  = currentItem?.maskBase64 ?? null;
  const canvasCSS    = { width: `${Math.round(baseCSS.w * zoom)}px`, height: `${Math.round(baseCSS.h * zoom)}px` };

  // Clear in-progress drawing when tool changes
  useEffect(() => {
    setCurrentPts([]);
    setRectAnchor(null);
    setMousePos(null);
  }, [activeTool]);

  // ─── Auto: process images ───────────────────────────────────────────────────
  const runAutoAnnotation = async () => {
    const pending = autoQueue.filter(i => i.status === "idle");
    if (!pending.length) return;
    setAutoRunning(true);

    for (const item of pending) {
      setAutoQueue(q => q.map(i => i.id === item.id ? { ...i, status: "processing" } : i));
      try {
        const blob = await fetch(item.originalBase64).then(r => r.blob());
        const file = new File([blob], item.filename, { type: blob.type });
        const fd   = new FormData();
        fd.append("file", file);
        fd.append("save", "false");

        const res  = await fetch("/api/annotation/auto", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");

        let mask: string = data.maskBase64 ?? "";
        if (!mask) {
          const img = new Image();
          await new Promise(r => { img.onload = r; img.src = item.originalBase64; });
          mask = buildFallbackMask(data.segments ?? [], img.naturalWidth, img.naturalHeight);
        }

        setAutoQueue(q => q.map(i => i.id === item.id
          ? { ...i, status: "done", segments: data.segments ?? [], maskBase64: mask, overlayBase64: data.overlayBase64 ?? "" }
          : i));
      } catch (e: any) {
        setAutoQueue(q => q.map(i => i.id === item.id
          ? { ...i, status: "error", error: e.message }
          : i));
      }
    }
    setAutoRunning(false);
  };

  const addAutoFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    const items: AutoImage[] = await Promise.all(arr.map(async f => ({
      id:              crypto.randomUUID(),
      file:            f,
      filename:        f.name,
      originalBase64:  await fileToBase64(f),
      maskBase64:      "",
      overlayBase64:   "",
      segments:        [],
      status:          "idle" as const,
      savedToGallery:  false,
      savingToGallery: false,
    })));
    setAutoQueue(q => [...q, ...items]);
  };

  // ─── Auto: save one result to gallery ─────────────────────────────────────
  const saveToGallery = async (id: string) => {
    const item = autoQueue.find(i => i.id === id);
    if (!item || item.status !== "done" || !item.maskBase64) return;
    setAutoQueue(q => q.map(i => i.id === id ? { ...i, savingToGallery: true } : i));
    const rating = itemRatings[id] ?? { stars: 0, note: "" };
    try {
      const res = await fetch("/api/annotation/save-esophagitis", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          filename:      item.filename,
          imageBase64:   item.originalBase64,
          maskBase64:    item.maskBase64,
          doctorRating:  { stars: rating.stars || null, note: rating.note.trim() || null },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setAutoQueue(q => q.map(i => i.id === id ? { ...i, savedToGallery: true, savingToGallery: false } : i));
    } catch {
      setAutoQueue(q => q.map(i => i.id === id ? { ...i, savingToGallery: false } : i));
    }
  };

  // ─── Manual: load image to canvas ─────────────────────────────────────────
  const loadToCanvas = useCallback((base64: string) => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const maxH  = 500;
      const maxW  = containerRef.current?.clientWidth ?? 700;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setBaseCSS({
        w: Math.round(img.naturalWidth  * scale),
        h: Math.round(img.naturalHeight * scale),
      });
      setZoom(1);
    };
    img.src = base64;
  }, []);

  // ─── Manual: add files to queue ───────────────────────────────────────────
  const addManualFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    const items: ManualImage[] = await Promise.all(arr.map(async f => ({
      id:          crypto.randomUUID(),
      file:        f,
      filename:    f.name,
      base64:      await fileToBase64(f),
      annotations: [],
      maskBase64:  null,
      saved:       false,
    })));
    const wasEmpty = manualQueue.length === 0;
    setManualQueue(q => [...q, ...items]);
    if (wasEmpty && items.length > 0) {
      setCurrentIdx(0);
      setAnnotations([]);
      setCurrentPts([]);
      setShowMask(false);
      loadToCanvas(items[0].base64);
    }
  };

  // ─── Manual: navigate between images ─────────────────────────────────────
  const navigateTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= manualQueue.length || idx === currentIdx) return;
    setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations } : item));
    setCurrentIdx(idx);
    setAnnotations(manualQueue[idx].annotations);
    setCurrentPts([]);
    setRectAnchor(null);
    setShowMask(false);
    setZoom(1);
    loadToCanvas(manualQueue[idx].base64);
  }, [currentIdx, annotations, manualQueue, loadToCanvas]);

  // ─── Manual: canvas drawing ────────────────────────────────────────────────
  const isNearFirstPoint = useCallback((mx: number, my: number): boolean => {
    if (currentPts.length < 3) return false;
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const threshold = 12 / canvas.width * 100;
    const dx = mx - currentPts[0][0];
    const dy = my - currentPts[0][1];
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }, [currentPts]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !manualBase64) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    // Draw committed annotations
    for (const ann of annotations) {
      const tool = ann.tool ?? "polygon";
      const cx0  = (ann.points[0]?.[0] ?? 50) / 100 * canvas.width;
      const cy0  = (ann.points[0]?.[1] ?? 50) / 100 * canvas.height;

      if (tool === "point") {
        ctx.beginPath();
        ctx.arc(cx0, cy0, 12, 0, Math.PI * 2);
        ctx.fillStyle = ann.color + "44";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx0, cy0, 5, 0, Math.PI * 2);
        ctx.fillStyle = ann.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx0, cy0, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // label
        const lw = ctx.measureText(ann.label).width + 14;
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = ann.color + "cc";
        ctx.beginPath();
        ctx.roundRect(cx0 - lw / 2, cy0 - 26, lw, 18, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(ann.label, cx0, cy0 - 12);
        continue;
      }

      if (tool === "line" && ann.points.length >= 2) {
        const cx1 = (ann.points[1][0] / 100) * canvas.width;
        const cy1 = (ann.points[1][1] / 100) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx1, cy1);
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.stroke();
        for (const [px, py] of ann.points) {
          ctx.beginPath();
          ctx.arc((px / 100) * canvas.width, (py / 100) * canvas.height, 4, 0, Math.PI * 2);
          ctx.fillStyle = ann.color;
          ctx.fill();
        }
        const midX = (cx0 + cx1) / 2;
        const midY = (cy0 + cy1) / 2;
        const lw = ctx.measureText(ann.label).width + 14;
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = ann.color + "cc";
        ctx.beginPath();
        ctx.roundRect(midX - lw / 2, midY - 9, lw, 18, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(ann.label, midX, midY + 4);
        continue;
      }

      // polygon / rect
      if (ann.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo((ann.points[0][0] / 100) * canvas.width, (ann.points[0][1] / 100) * canvas.height);
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo((ann.points[i][0] / 100) * canvas.width, (ann.points[i][1] / 100) * canvas.height);
      }
      ctx.closePath();
      ctx.fillStyle   = ann.color + "55";
      ctx.strokeStyle = ann.color;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([]);
      ctx.fill();
      ctx.stroke();
      for (const [px, py] of ann.points) {
        ctx.beginPath();
        ctx.arc((px / 100) * canvas.width, (py / 100) * canvas.height, 3, 0, Math.PI * 2);
        ctx.fillStyle = ann.color;
        ctx.fill();
      }
      const mcx = ann.points.reduce((s, p) => s + p[0], 0) / ann.points.length;
      const mcy = ann.points.reduce((s, p) => s + p[1], 0) / ann.points.length;
      ctx.font = "bold 11px sans-serif";
      const lw = ctx.measureText(ann.label).width + 14;
      ctx.fillStyle = ann.color + "cc";
      ctx.beginPath();
      ctx.roundRect((mcx / 100) * canvas.width - lw / 2, (mcy / 100) * canvas.height - 9, lw, 18, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(ann.label, (mcx / 100) * canvas.width, (mcy / 100) * canvas.height + 4);
    }

    const color = COLORS[colorIdx];

    // Draw in-progress polygon / line
    if (currentPts.length > 0 && activeTool !== "rect" && activeTool !== "pan") {
      if (activeTool === "line") {
        // Show first point + preview line
        ctx.beginPath();
        ctx.arc((currentPts[0][0] / 100) * canvas.width, (currentPts[0][1] / 100) * canvas.height, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        if (mousePos) {
          ctx.beginPath();
          ctx.moveTo((currentPts[0][0] / 100) * canvas.width, (currentPts[0][1] / 100) * canvas.height);
          ctx.lineTo((mousePos[0] / 100) * canvas.width, (mousePos[1] / 100) * canvas.height);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        // Polygon in-progress
        const nearFirst = mousePos ? isNearFirstPoint(mousePos[0], mousePos[1]) : false;
        ctx.beginPath();
        ctx.moveTo((currentPts[0][0] / 100) * canvas.width, (currentPts[0][1] / 100) * canvas.height);
        for (let i = 1; i < currentPts.length; i++) {
          ctx.lineTo((currentPts[i][0] / 100) * canvas.width, (currentPts[i][1] / 100) * canvas.height);
        }
        if (mousePos && !nearFirst) {
          ctx.lineTo((mousePos[0] / 100) * canvas.width, (mousePos[1] / 100) * canvas.height);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();

        for (let i = 0; i < currentPts.length; i++) {
          const [px, py] = currentPts[i];
          ctx.beginPath();
          ctx.arc((px / 100) * canvas.width, (py / 100) * canvas.height, i === 0 ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }

        if (currentPts.length >= 3) {
          ctx.beginPath();
          ctx.arc(
            (currentPts[0][0] / 100) * canvas.width,
            (currentPts[0][1] / 100) * canvas.height,
            nearFirst ? 10 : 7, 0, Math.PI * 2
          );
          ctx.strokeStyle = nearFirst ? "#fff" : color;
          ctx.lineWidth   = nearFirst ? 2.5 : 1.5;
          ctx.stroke();
        }
      }
    }

    // Draw rect preview
    if (activeTool === "rect" && rectAnchor && mousePos) {
      const x1 = (rectAnchor[0] / 100) * canvas.width;
      const y1 = (rectAnchor[1] / 100) * canvas.height;
      const x2 = (mousePos[0] / 100) * canvas.width;
      const y2 = (mousePos[1] / 100) * canvas.height;
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      ctx.fillStyle = color + "33";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }

    // Crosshair + coords (not in pan mode)
    if (mousePos && !showMask && activeTool !== "pan") {
      const mx = (mousePos[0] / 100) * canvas.width;
      const my = (mousePos[1] / 100) * canvas.height;

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(canvas.width, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, canvas.height); ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth   = 1.5;
      const cs = canvas.width * 0.008;
      ctx.beginPath(); ctx.moveTo(mx - cs, my); ctx.lineTo(mx + cs, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my - cs); ctx.lineTo(mx, my + cs); ctx.stroke();
      ctx.restore();

      const imgX  = Math.round((mousePos[0] / 100) * canvas.width);
      const imgY  = Math.round((mousePos[1] / 100) * canvas.height);
      const label = `x: ${imgX}, y: ${imgY}`;
      const fs    = Math.max(10, Math.min(13, canvas.width * 0.013));
      ctx.font = `${fs}px monospace`;
      const tw  = ctx.measureText(label).width;
      const pad = 5;
      const tx  = mx + 14 + tw + pad * 2 > canvas.width ? mx - tw - pad * 2 - 10 : mx + 14;
      const ty  = my + fs + 10 > canvas.height ? my - 8 : my + fs + 4;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(tx - pad, ty - fs, tw + pad * 2, fs + pad);
      ctx.fillStyle    = "#ffffff";
      ctx.textAlign    = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label, tx, ty);
    }
  }, [annotations, currentPts, colorIdx, manualBase64, mousePos, showMask, isNearFirstPoint, activeTool, rectAnchor]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showMask) return;
    if (isPanning && panStart && scrollRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      scrollRef.current.scrollLeft = panStart.sl - dx;
      scrollRef.current.scrollTop  = panStart.st - dy;
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setMousePos([x, y]);
  };

  const handleCanvasMouseLeave = () => {
    setMousePos(null);
    if (isPanning) { setIsPanning(false); setPanStart(null); }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showMask) return;
    if (activeTool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, sl: scrollRef.current?.scrollLeft ?? 0, st: scrollRef.current?.scrollTop ?? 0 });
      return;
    }
    if (activeTool === "rect") {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      setRectAnchor([x, y]);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) { setIsPanning(false); setPanStart(null); return; }
    if (activeTool === "rect" && rectAnchor) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      const [ax, ay] = rectAnchor;
      if (Math.abs(x - ax) > 1 && Math.abs(y - ay) > 1) {
        const ann: Annotation = {
          id:     crypto.randomUUID(),
          label:  currentLabel,
          points: [[ax, ay], [x, ay], [x, y], [ax, y]],
          color:  COLORS[colorIdx],
          tool:   "rect",
        };
        const next = [...annotations, ann];
        setAnnotations(next);
        setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: next } : item));
        setColorIdx(i => (i + 1) % COLORS.length);
      }
      setRectAnchor(null);
    }
  };

  const closePolygon = useCallback(() => {
    if (currentPts.length < 3) return;
    const ann: Annotation = {
      id:     crypto.randomUUID(),
      label:  currentLabel,
      points: currentPts,
      color:  COLORS[colorIdx],
      tool:   "polygon",
    };
    const next = [...annotations, ann];
    setAnnotations(next);
    setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: next } : item));
    setCurrentPts([]);
    setMousePos(null);
    setColorIdx(i => (i + 1) % COLORS.length);
  }, [currentPts, currentLabel, colorIdx, annotations, currentIdx]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (showMask || activeTool === "pan" || activeTool === "rect") return;
    if (e.detail >= 2) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;

    if (activeTool === "point") {
      const ann: Annotation = {
        id: crypto.randomUUID(), label: currentLabel,
        points: [[x, y]], color: COLORS[colorIdx], tool: "point",
      };
      const next = [...annotations, ann];
      setAnnotations(next);
      setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: next } : item));
      setColorIdx(i => (i + 1) % COLORS.length);
      return;
    }

    if (activeTool === "line") {
      if (currentPts.length === 0) {
        setCurrentPts([[x, y]]);
      } else {
        const ann: Annotation = {
          id: crypto.randomUUID(), label: currentLabel,
          points: [currentPts[0], [x, y]], color: COLORS[colorIdx], tool: "line",
        };
        const next = [...annotations, ann];
        setAnnotations(next);
        setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: next } : item));
        setCurrentPts([]);
        setColorIdx(i => (i + 1) % COLORS.length);
      }
      return;
    }

    // polygon
    if (isNearFirstPoint(x, y)) { closePolygon(); return; }
    setCurrentPts(p => [...p, [x, y]]);
  };

  const handleCanvasDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (activeTool === "polygon") closePolygon();
  };

  // ─── Generate mask + auto-save ────────────────────────────────────────────
  const generateMask = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentItem) return;

    const mc  = document.createElement("canvas");
    mc.width  = canvas.width;
    mc.height = canvas.height;
    const ctx = mc.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, mc.width, mc.height);

    for (const ann of annotations) {
      const tool = ann.tool ?? "polygon";
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";

      if (tool === "point" && ann.points.length >= 1) {
        const r = Math.max(8, mc.width * 0.015);
        ctx.beginPath();
        ctx.arc((ann.points[0][0] / 100) * mc.width, (ann.points[0][1] / 100) * mc.height, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (tool === "line" && ann.points.length >= 2) {
        ctx.lineWidth = Math.max(3, mc.width * 0.005);
        ctx.beginPath();
        ctx.moveTo((ann.points[0][0] / 100) * mc.width, (ann.points[0][1] / 100) * mc.height);
        ctx.lineTo((ann.points[1][0] / 100) * mc.width, (ann.points[1][1] / 100) * mc.height);
        ctx.stroke();
      } else if (ann.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo((ann.points[0][0] / 100) * mc.width, (ann.points[0][1] / 100) * mc.height);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo((ann.points[i][0] / 100) * mc.width, (ann.points[i][1] / 100) * mc.height);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    const maskBase64 = mc.toDataURL("image/png");
    const finalAnns  = [...annotations];

    setManualQueue(q => q.map((item, i) =>
      i === currentIdx ? { ...item, maskBase64, annotations: finalAnns } : item
    ));

    setSaving(true);
    try {
      const res = await fetch("/api/annotation/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          filename:       currentItem.filename,
          originalBase64: currentItem.base64,
          maskBase64,
          annotations:    finalAnns,
        }),
      });
      if (res.ok) {
        setManualQueue(q => q.map((item, i) =>
          i === currentIdx ? { ...item, saved: true } : item
        ));
        setSavedMsg("Saved ✓");
        setTimeout(() => setSavedMsg(""), 2500);
      }
    } catch {}
    setSaving(false);
  }, [currentItem, annotations, currentIdx]);

  // ─── Export single combined JSON ──────────────────────────────────────────
  const exportCombinedJSON = () => {
    const combined = {
      created_at: new Date().toISOString(),
      images: manualQueue
        .filter(item => item.annotations.length > 0)
        .map(item => ({
          filename: item.filename,
          annotations: item.annotations.map((a, i) => ({
            id:           i + 1,
            label:        a.label,
            tool:         a.tool ?? "polygon",
            color:        a.color,
            segmentation: [a.points.flatMap(([x, y]) => [x, y])],
          })),
        })),
    };
    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `annotations_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  // ─── Shared drag-drop ─────────────────────────────────────────────────────
  const onAutoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addAutoFiles(e.dataTransfer.files);
  };

  const doneCount   = manualQueue.filter(i => i.saved).length;
  const annotCount  = manualQueue.filter(i => i.annotations.length > 0).length;

  // ─── Tool definitions ─────────────────────────────────────────────────────
  const TOOLS: { id: DrawTool; label: string; icon: React.ReactNode; hint: string }[] = [
    {
      id: "polygon", label: "Polygon", hint: "Click to add points, double-click to close",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
        </svg>
      ),
    },
    {
      id: "rect", label: "Rectangle", hint: "Drag to draw a bounding box",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="1"/>
        </svg>
      ),
    },
    {
      id: "point", label: "Point", hint: "Click to mark a single point",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      ),
    },
    {
      id: "line", label: "Line", hint: "Click start, click end",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: "pan", label: "Pan", hint: "Drag to scroll around the canvas",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v2M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8"/><path d="M6 14v2a6 6 0 006 6h0a6 6 0 006-6v-5a2 2 0 00-2-2 2 2 0 00-2 2"/>
        </svg>
      ),
    },
  ];

  const zoomPct = Math.round(zoom * 100);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(120deg, #1e3a5f 0%, #2563EB 55%, #60a5fa 100%)",
        padding: "2rem 2.5rem 1.75rem",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -30, left: "30%", width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.4rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </div>
              <h1 style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Dataset Annotation
              </h1>
            </div>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", margin: 0 }}>
              Annotate your images automatically or draw contours manually
            </p>
          </div>
          <Link href="/annotation/results" prefetch={false} style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.5rem 1rem", borderRadius: 8,
            background: "rgba(255,255,255,0.15)", color: "#fff",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            View Results
          </Link>
        </div>
      </div>

      <div style={{ padding: "1.75rem 2.5rem", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Mode selector ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.75rem" }}>
          {([
            {
              id: "auto",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
                </svg>
              ),
              title:      "Lesion · Esophagitis",
              sub:        "AI-powered mask generation",
              desc:       "Upload esophagitis images and the system automatically generates segmentation masks. Both images and masks are saved with matching filenames.",
              badge:      "Auto",
              badgeBg:    "#2563EB",
              gradient:   "linear-gradient(135deg, #1e3a5f, #2563EB)",
              activeBg:   "linear-gradient(135deg, #eff6ff, #fff)",
              border:     "#2563EB",
              shadow:     "rgba(37,99,235,0.12)",
              titleColor: "#1e3a5f",
              subColor:   "#2563EB",
            },
            {
              id: "manual",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              ),
              title:      "Other Lesion Type",
              sub:        "Manual contour annotation",
              desc:       "Draw contours on multiple images in one session. Annotations auto-save and you export a combined file at the end.",
              badge:      "Manual",
              badgeBg:    "#0ea5e9",
              gradient:   "linear-gradient(135deg, #0369a1, #0ea5e9)",
              activeBg:   "linear-gradient(135deg, #f0f9ff, #fff)",
              border:     "#0ea5e9",
              shadow:     "rgba(14,165,233,0.12)",
              titleColor: "#0369a1",
              subColor:   "#0ea5e9",
            },
          ] as const).map(opt => {
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                style={{
                  textAlign: "left", padding: "1.25rem 1.5rem",
                  borderRadius: 14, border: `2px solid ${active ? opt.border : "#e5e7eb"}`,
                  background: active ? opt.activeBg : "#fff",
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: active ? `0 4px 20px ${opt.shadow}` : "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "all 0.18s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: active ? opt.gradient : "#f1f5f9",
                    color: active ? "#fff" : "#64748b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s",
                  }}>
                    {opt.icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", background: opt.badgeBg, color: "#fff", padding: "2px 8px", borderRadius: 20 }}>
                    {opt.badge}
                  </span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 800, color: opt.titleColor, margin: "0.75rem 0 0.2rem" }}>{opt.title}</p>
                <p style={{ fontSize: 11, fontWeight: 600, color: opt.subColor, margin: "0 0 0.45rem" }}>{opt.sub}</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.55 }}>{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* ── Quick access to saved results ── */}
        <Link href="/annotation/results"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.75rem 1.1rem", borderRadius: 12,
            border: "1px solid #e0f2fe", background: "#f0f9ff",
            textDecoration: "none", marginBottom: "1.75rem",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#e0f2fe"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#7dd3fc"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#f0f9ff"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#e0f2fe"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4H2a2 2 0 00-2 2v12a2 2 0 002 2h20a2 2 0 002-2V8a2 2 0 00-2-2H12L10 4z"/>
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1e40af" }}>View Saved Annotation Results</p>
              <p style={{ margin: 0, fontSize: 11, color: "#60a5fa" }}>Browse previously saved images &amp; masks</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* ══════════════════════════════════════════════════════════════════════
            MODE 1 — AUTO ANNOTATION (SAM2)
        ══════════════════════════════════════════════════════════════════════ */}
        {mode === "auto" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #1e3a5f, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e3a5f" }}>Esophagitis Auto-Annotation</p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: 11, color: "#6b7280" }}>Upload one or more images — masks are generated automatically</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>Ready</span>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 200 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>OUTPUT</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#374151" }}>annotation_output/esophagitis/</p>
                <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>Save each result manually after review</p>
              </div>
            </div>

            <div
              ref={autoDrop}
              onDragOver={e => e.preventDefault()}
              onDrop={onAutoDrop}
              onClick={() => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = "image/*"; i.onchange = () => i.files && addAutoFiles(i.files); i.click(); }}
              style={{ border: "2px dashed #bfdbfe", borderRadius: 14, padding: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.65rem", background: "#f0f7ff", cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2563EB"; (e.currentTarget as HTMLDivElement).style.background = "#dbeafe"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#bfdbfe"; (e.currentTarget as HTMLDivElement).style.background = "#f0f7ff"; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #1e3a5f, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e3a5f" }}>Drop esophagitis images here</p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>or click to browse · JPG, PNG, BMP supported</p>
            </div>

            {autoQueue.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}>
                    {autoQueue.length} image{autoQueue.length !== 1 ? "s" : ""} queued
                    {autoQueue.filter(i => i.status === "done").length > 0 && (
                      <span style={{ color: "#22c55e", marginLeft: 8 }}>
                        · {autoQueue.filter(i => i.status === "done").length} done
                      </span>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: "0.65rem" }}>
                    <button type="button" onClick={() => setAutoQueue([])} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#6b7280", fontFamily: "inherit" }}>
                      Clear All
                    </button>
                    <button type="button" onClick={runAutoAnnotation} disabled={autoRunning || !autoQueue.some(i => i.status === "idle")}
                      style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "none", background: autoRunning ? "#e5e7eb" : "linear-gradient(135deg, #1e3a5f, #2563EB)", color: autoRunning ? "#94a3b8" : "#fff", fontSize: 12, fontWeight: 700, cursor: autoRunning ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem", boxShadow: autoRunning ? "none" : "0 2px 10px rgba(37,99,235,0.35)" }}>
                      {autoRunning ? (
                        <><span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#6b7280", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Generating Masks…</>
                      ) : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Generate Masks</>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {autoQueue.map(item => (
                    <div key={item.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <div style={{ display: "flex", gap: 0 }}>
                        {/* Panel 1 — Original */}
                        <div style={{ flex: 1, position: "relative", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                          <img src={item.originalBase64} alt="original" style={{ width: "100%", height: "100%", minHeight: 220, maxHeight: 280, objectFit: "contain", display: "block" }} />
                          <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 5, letterSpacing: "0.05em" }}>ORIGINAL</div>
                        </div>
                        <div style={{ width: 2, background: "#1e293b", flexShrink: 0 }} />
                        {/* Panel 2 — Binary mask */}
                        <div style={{ flex: 1, position: "relative", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                          {item.status === "done" && item.maskBase64 ? (
                            <>
                              <img src={item.maskBase64} alt="mask" style={{ width: "100%", height: "100%", minHeight: 220, maxHeight: 280, objectFit: "contain", display: "block" }} />
                              <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(30,64,175,0.75)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 5, letterSpacing: "0.05em" }}>SEGMENTATION MASK</div>
                            </>
                          ) : item.status === "processing" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", padding: "0 1.5rem" }}>
                              {[
                                { label: "Image received",      done: true  },
                                { label: "Looking for lesions", done: false },
                                { label: "Building the mask",   done: false },
                              ].map((step, si) => (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                                  {step.done ? (
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                  ) : si === 1 ? (
                                    <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.1)", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: step.done ? 500 : si === 1 ? 700 : 400, color: step.done ? "#4ade80" : si === 1 ? "#e2e8f0" : "#475569" }}>
                                    {step.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : item.status === "error" ? (
                            <div style={{ textAlign: "center", padding: "1rem" }}>
                              <p style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, margin: 0 }}>Analysis failed</p>
                              <p style={{ color: "#94a3b8", fontSize: 10, margin: "0.25rem 0 0" }}>{item.error}</p>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Mask will appear here</span>
                            </div>
                          )}
                        </div>
                        {/* Panel 3 — Contour overlay */}
                        <div style={{ width: 2, background: "#1e293b", flexShrink: 0 }} />
                        <div style={{ flex: 1, position: "relative", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
                          {item.status === "done" && item.overlayBase64 ? (
                            <>
                              <img src={item.overlayBase64} alt="contour" style={{ width: "100%", height: "100%", minHeight: 220, maxHeight: 280, objectFit: "contain", display: "block" }} />
                              <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(4,120,87,0.75)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 5, letterSpacing: "0.05em" }}>LESION CONTOUR</div>
                            </>
                          ) : item.status === "processing" ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", padding: "0 1.5rem" }}>
                              {[
                                { label: "Mask ready",           done: true  },
                                { label: "Drawing boundaries",   done: false },
                                { label: "Adding lesion labels", done: false },
                              ].map((step, si) => (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                                  {step.done ? (
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                  ) : si === 1 ? (
                                    <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.1)", borderTopColor: "#4ade80", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
                                  ) : (
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.12)", flexShrink: 0 }} />
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: step.done ? 500 : si === 1 ? 700 : 400, color: step.done ? "#4ade80" : si === 1 ? "#e2e8f0" : "#475569" }}>
                                    {step.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : item.status === "error" ? (
                            <div style={{ textAlign: "center", padding: "1rem" }}>
                              <p style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, margin: 0 }}>Failed</p>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12s1.5-3 4-3 4 3 4 3-1.5 3-4 3-4-3-4-3z"/></svg>
                              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Contour will appear here</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: "0.6rem 0.85rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: item.status === "done" ? "#22c55e" : item.status === "processing" ? "#f59e0b" : item.status === "error" ? "#ef4444" : "#e5e7eb" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename}</span>
                        {item.status === "done" && (
                          <>
                            <span style={{ fontSize: 10, color: "#6b7280" }}>{item.segments.length} lesion{item.segments.length !== 1 ? "s" : ""} detected</span>
                            <button type="button" onClick={() => { const a = document.createElement("a"); a.href = item.maskBase64; a.download = item.filename.replace(/\.[^.]+$/, "_mask.png"); a.click(); }} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#2563EB", fontFamily: "inherit" }}>↓ Mask</button>
                            {item.overlayBase64 && <button type="button" onClick={() => { const a = document.createElement("a"); a.href = item.overlayBase64; a.download = item.filename.replace(/\.[^.]+$/, "_contour.jpg"); a.click(); }} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#15803d", fontFamily: "inherit" }}>↓ Contour</button>}
                            {/* Save to gallery */}
                            {item.savedToGallery ? (
                              <span style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #bbf7d0", background: "#f0fdf4", fontSize: 10, fontWeight: 700, color: "#15803d", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Saved
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={item.savingToGallery}
                                onClick={() => saveToGallery(item.id)}
                                style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #a7f3d0", background: item.savingToGallery ? "#f0fdf4" : "linear-gradient(135deg,#059669,#10b981)", fontSize: 10, fontWeight: 700, cursor: item.savingToGallery ? "not-allowed" : "pointer", color: item.savingToGallery ? "#6b7280" : "#fff", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                              >
                                {item.savingToGallery
                                  ? <><span style={{ width: 8, height: 8, border: "1.5px solid #ccc", borderTopColor: "#6b7280", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Saving…</>
                                  : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save to Gallery</>
                                }
                              </button>
                            )}
                          </>
                        )}
                        {item.status !== "processing" && (
                          <button type="button" onClick={() => setAutoQueue(q => q.filter(i => i.id !== item.id))} style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", color: "#94a3b8", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
                        )}
                      </div>

                      {/* ── Doctor Rating ── */}
                      {item.status === "done" && (() => {
                        const r = itemRatings[item.id] ?? { stars: 0, note: "" };
                        const confirmed = confirmedRatings[item.id] ?? false;

                        if (confirmed) {
                          // ── Compact summary view ────────────────────────────
                          return (
                            <div style={{ padding: "0.5rem 0.85rem", borderTop: "1px solid #f1f5f9", background: "#fafbff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>Assessment</span>
                              {/* Stars display */}
                              <div style={{ display: "flex", gap: 1 }}>
                                {[1,2,3,4,5].map(s => (
                                  <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= (r.stars || 0) ? "#f59e0b" : "none"} stroke={s <= (r.stars || 0) ? "#f59e0b" : "#d1d5db"} strokeWidth="1.8">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                  </svg>
                                ))}
                              </div>
                              {r.stars > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b" }}>
                                  {["","Poor","Fair","Good","Very Good","Excellent"][r.stars]}
                                </span>
                              )}
                              {/* Comment button */}
                              {r.note.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setShowNotePopup(item.id)}
                                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, border: "1px solid #bfdbfe", background: "#eff6ff", fontSize: 10, fontWeight: 700, color: "#2563EB", cursor: "pointer", fontFamily: "inherit" }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                  Comment
                                </button>
                              )}
                              {/* Edit button */}
                              <button
                                type="button"
                                onClick={() => setConfirmedRatings(prev => ({ ...prev, [item.id]: false }))}
                                style={{ marginLeft: r.note.trim() ? 0 : "auto", display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f8fafc", fontSize: 10, fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit
                              </button>
                            </div>
                          );
                        }

                        // ── Expanded edit view ──────────────────────────────
                        return (
                          <div style={{ padding: "0.75rem 0.85rem 0.85rem", borderTop: "1px solid #f1f5f9", background: "#fafbff" }}>
                            <p style={{ margin: "0 0 0.5rem", fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                              Doctor's Assessment
                            </p>
                            {/* Stars */}
                            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: "0.55rem" }}>
                              {[1,2,3,4,5].map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setItemRatings(prev => ({ ...prev, [item.id]: { ...r, stars: s } }))}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1 }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill={s <= r.stars ? "#f59e0b" : "none"} stroke={s <= r.stars ? "#f59e0b" : "#d1d5db"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                  </svg>
                                </button>
                              ))}
                              {r.stars > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginLeft: 4 }}>
                                  {["","Poor","Fair","Good","Very Good","Excellent"][r.stars]}
                                </span>
                              )}
                            </div>
                            {/* Notes */}
                            <textarea
                              value={r.note}
                              onChange={e => setItemRatings(prev => ({ ...prev, [item.id]: { ...r, note: e.target.value } }))}
                              placeholder="Add clinical notes or feedback on this result…"
                              rows={2}
                              style={{
                                width: "100%", boxSizing: "border-box",
                                padding: "0.5rem 0.7rem", borderRadius: 8,
                                border: "1px solid #e5e7eb", fontSize: 11,
                                fontFamily: "inherit", color: "#374151",
                                resize: "vertical", outline: "none",
                                background: "#fff", lineHeight: 1.55,
                                marginBottom: "0.5rem",
                              }}
                            />
                            {/* Confirm button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (r.stars === 0 && !r.note.trim()) return;
                                setConfirmedRatings(prev => ({ ...prev, [item.id]: true }));
                              }}
                              disabled={r.stars === 0 && !r.note.trim()}
                              style={{
                                padding: "4px 14px", borderRadius: 7,
                                border: "none",
                                background: (r.stars > 0 || r.note.trim()) ? "linear-gradient(135deg,#2563EB,#1d4ed8)" : "#e5e7eb",
                                color: (r.stars > 0 || r.note.trim()) ? "#fff" : "#94a3b8",
                                fontSize: 11, fontWeight: 700, cursor: (r.stars > 0 || r.note.trim()) ? "pointer" : "not-allowed",
                                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Confirm Assessment
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>

                {autoQueue.some(i => i.status === "done") && (
                  <button type="button"
                    onClick={() => autoQueue.filter(i => i.status === "done").forEach(item => { const a = document.createElement("a"); a.href = item.maskBase64; a.download = item.filename.replace(/\.[^.]+$/, "_mask.png"); a.click(); })}
                    style={{ padding: "0.7rem 1.5rem", borderRadius: 10, border: "1px solid #bfdbfe", background: "linear-gradient(135deg, #eff6ff, #dbeafe)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#1e3a5f", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Export All Masks ({autoQueue.filter(i => i.status === "done").length})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MODE 2 — MANUAL ANNOTATION
        ══════════════════════════════════════════════════════════════════════ */}
        {mode === "manual" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {manualQueue.length === 0 ? (
              /* ── Upload zone ── */
              <div
                onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.onchange = () => i.files && addManualFiles(i.files); i.click(); }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addManualFiles(e.dataTransfer.files); }}
                style={{ border: "2px dashed #bae6fd", borderRadius: 14, padding: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", background: "#f0f9ff", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#0ea5e9"; (e.currentTarget as HTMLDivElement).style.background = "#e0f2fe"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#bae6fd"; (e.currentTarget as HTMLDivElement).style.background = "#f0f9ff"; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0369a1, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0369a1" }}>Upload images to annotate</p>
                <p style={{ margin: 0, fontSize: 12, color: "#0ea5e9" }}>Drag & drop or click to browse · multiple files supported</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 272px", gap: "1.25rem", alignItems: "start" }}>

                {/* ── Canvas card ── */}
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

                  {/* Toolbar */}
                  <div style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>VIEW</span>
                    <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: "2px" }}>
                      {[
                        { id: "draw", label: "Draw", icon: "M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" },
                        { id: "view", label: "Mask", icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z" },
                      ].map(t => (
                        <button key={t.id} type="button"
                          onClick={() => setShowMask(t.id === "view")}
                          disabled={t.id === "view" && !maskPreview}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: (t.id === "view" && !maskPreview) ? "not-allowed" : "pointer", fontFamily: "inherit", background: (showMask ? t.id === "view" : t.id === "draw") ? "#fff" : "transparent", color: (t.id === "view" && !maskPreview) ? "#cbd5e1" : (showMask ? t.id === "view" : t.id === "draw") ? "#1e3a5f" : "#6b7280", boxShadow: (showMask ? t.id === "view" : t.id === "draw") ? "0 1px 4px rgba(0,0,0,0.1)" : "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ height: 16, width: 1, background: "#e5e7eb" }} />
                    <button type="button" onClick={() => setCurrentPts(p => p.slice(0, -1))} disabled={currentPts.length === 0}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 700, cursor: currentPts.length ? "pointer" : "not-allowed", color: currentPts.length ? "#374151" : "#cbd5e1", fontFamily: "inherit" }}>
                      ↩ Undo
                    </button>
                    <button type="button" onClick={() => { setCurrentPts([]); setRectAnchor(null); }} disabled={currentPts.length === 0 && !rectAnchor}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 11, fontWeight: 700, cursor: (currentPts.length || rectAnchor) ? "pointer" : "not-allowed", color: (currentPts.length || rectAnchor) ? "#dc2626" : "#fca5a5", fontFamily: "inherit" }}>
                      ✕ Cancel
                    </button>
                    <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
                      {activeTool === "polygon" && (currentPts.length >= 3
                        ? `${currentPts.length} pts · Click first point to close`
                        : currentPts.length > 0
                        ? `${currentPts.length} pts · Keep clicking`
                        : "Click to start polygon")}
                      {activeTool === "rect" && (rectAnchor ? "Release to complete rect" : "Drag to draw rect")}
                      {activeTool === "point" && "Click to place a point"}
                      {activeTool === "line" && (currentPts.length === 1 ? "Click to set end point" : "Click to set start point")}
                      {activeTool === "pan" && "Drag to pan · Use zoom buttons to zoom"}
                    </div>
                  </div>

                  {/* Zoom toolbar */}
                  <div style={{ padding: "0.45rem 1rem", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", marginRight: 2 }}>ZOOM</span>
                    {/* Zoom out */}
                    <button type="button" onClick={() => setZoom(z => Math.max(parseFloat((z / 1.25).toFixed(2)), 0.2))}
                      title="Zoom out"
                      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    {/* Zoom percent */}
                    <div style={{ minWidth: 44, textAlign: "center", fontSize: 11, fontWeight: 700, color: zoom !== 1 ? "#0ea5e9" : "#374151", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 6px", cursor: "default" }}>
                      {zoomPct}%
                    </div>
                    {/* Zoom in */}
                    <button type="button" onClick={() => setZoom(z => Math.min(parseFloat((z * 1.25).toFixed(2)), 5))}
                      title="Zoom in"
                      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    {/* Fit */}
                    <button type="button" onClick={() => setZoom(1)}
                      title="Fit to view"
                      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #e5e7eb", background: zoom === 1 ? "#f0f9ff" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: zoom === 1 ? "#0ea5e9" : "#374151", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                    {/* 2x */}
                    <button type="button" onClick={() => setZoom(2)}
                      title="200%"
                      style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: zoom === 2 ? "#f0f9ff" : "#fff", cursor: "pointer", fontSize: 10, fontWeight: 700, color: zoom === 2 ? "#0ea5e9" : "#374151", fontFamily: "inherit" }}>
                      2×
                    </button>
                    <div style={{ height: 16, width: 1, background: "#e5e7eb", margin: "0 2px" }} />
                    {/* Pan toggle */}
                    <button type="button"
                      onClick={() => setActiveTool(t => t === "pan" ? "polygon" : "pan")}
                      title="Pan mode"
                      style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${activeTool === "pan" ? "#0ea5e9" : "#e5e7eb"}`, background: activeTool === "pan" ? "#f0f9ff" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: activeTool === "pan" ? "#0ea5e9" : "#374151", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 11V6a2 2 0 00-2-2 2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2 2 2 0 00-2 2v2M10 10.5V6a2 2 0 00-2-2 2 2 0 00-2 2v8"/><path d="M6 14v2a6 6 0 006 6h0a6 6 0 006-6v-5a2 2 0 00-2-2 2 2 0 00-2 2"/>
                      </svg>
                    </button>
                  </div>

                  {/* Filmstrip */}
                  <div style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc", padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto" }}>
                    {manualQueue.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(idx)}
                        style={{
                          flexShrink: 0, position: "relative", width: 54, height: 40,
                          borderRadius: 6, overflow: "hidden", cursor: "pointer",
                          border: `2px solid ${idx === currentIdx ? "#0ea5e9" : item.saved ? "#22c55e" : item.annotations.length > 0 ? "#38bdf8" : "#e5e7eb"}`,
                          padding: 0, background: "none",
                          boxShadow: idx === currentIdx ? "0 0 0 2px rgba(14,165,233,0.25)" : "none",
                          transition: "all 0.15s",
                        }}
                        title={item.filename}
                      >
                        <img src={item.base64} alt={item.filename} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {item.saved && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#fff", fontSize: 14, fontWeight: 900, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>✓</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 1, right: 2, fontSize: 8, fontWeight: 800, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
                          {idx + 1}
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.onchange = () => i.files && addManualFiles(i.files); i.click(); }}
                      style={{ flexShrink: 0, width: 54, height: 40, borderRadius: 6, border: "2px dashed #d1d5db", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 18, fontWeight: 300 }}
                      title="Add more images"
                    >+</button>
                    <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                      <button type="button" onClick={() => navigateTo(currentIdx - 1)} disabled={currentIdx === 0}
                        style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: currentIdx > 0 ? "pointer" : "not-allowed", color: currentIdx > 0 ? "#374151" : "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>‹</button>
                      <button type="button" onClick={() => navigateTo(currentIdx + 1)} disabled={currentIdx >= manualQueue.length - 1}
                        style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: currentIdx < manualQueue.length - 1 ? "pointer" : "not-allowed", color: currentIdx < manualQueue.length - 1 ? "#374151" : "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "inherit" }}>›</button>
                    </div>
                  </div>

                  {/* Canvas — scrollable when zoomed */}
                  <div
                    ref={el => { (containerRef as any).current = el; (scrollRef as any).current = el; }}
                    style={{
                      position: "relative", background: "#0f172a", lineHeight: 0,
                      display: "flex", justifyContent: "center", alignItems: "flex-start",
                      overflow: zoom > 1 ? "auto" : "hidden",
                      maxHeight: 520,
                      cursor: activeTool === "pan" ? (isPanning ? "grabbing" : "grab") : "none",
                    }}
                  >
                    {showMask && maskPreview ? (
                      <img src={maskPreview} alt="mask preview" style={{ width: canvasCSS.width, height: canvasCSS.height, objectFit: "contain", display: "block", flexShrink: 0 }} />
                    ) : (
                      <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        onDoubleClick={handleCanvasDblClick}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseLeave={handleCanvasMouseLeave}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseUp={handleCanvasMouseUp}
                        style={{ width: canvasCSS.width, height: canvasCSS.height, display: "block", flexShrink: 0 }}
                      />
                    )}
                  </div>
                </div>

                {/* ── Side panel ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

                  {/* Tool selector */}
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>DRAWING TOOL</p>
                    </div>
                    {TOOLS.filter(t => t.id !== "pan").map(tool => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => setActiveTool(tool.id)}
                        title={tool.hint}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "0.65rem",
                          padding: "0.6rem 1rem", border: "none", background: activeTool === tool.id ? "#f0f9ff" : "#fff",
                          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          borderLeft: `3px solid ${activeTool === tool.id ? "#0ea5e9" : "transparent"}`,
                          borderBottom: "1px solid #f8fafc",
                          transition: "all 0.12s",
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          background: activeTool === tool.id ? "linear-gradient(135deg, #0369a1, #0ea5e9)" : "#f1f5f9",
                          color: activeTool === tool.id ? "#fff" : "#64748b",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.12s",
                        }}>
                          {tool.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: activeTool === tool.id ? "#0369a1" : "#374151" }}>{tool.label}</p>
                          <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>{tool.hint}</p>
                        </div>
                        {activeTool === tool.id && (
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Image info */}
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "0.85rem 1rem" }}>
                    <p style={{ margin: "0 0 0.3rem", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>
                      IMAGE {currentIdx + 1} / {manualQueue.length}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {currentItem?.filename ?? "—"}
                    </p>
                    {currentItem?.saved && (
                      <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>Saved to server</span>
                      </div>
                    )}
                  </div>

                  {/* Label + color */}
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1rem" }}>
                    <p style={{ margin: "0 0 0.6rem", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>CURRENT LABEL</p>
                    <input
                      value={currentLabel}
                      onChange={e => setCurrentLabel(e.target.value)}
                      placeholder="e.g. Lesion, Polyp…"
                      style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", color: "#0369a1", fontWeight: 600, boxSizing: "border-box" }}
                    />
                    <p style={{ margin: "0.75rem 0 0.4rem", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>COLOR</p>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {COLORS.map((c, i) => (
                        <div key={c} onClick={() => setColorIdx(i)} style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: "pointer", border: colorIdx === i ? "2px solid #0369a1" : "2px solid transparent", transition: "all 0.12s" }} />
                      ))}
                    </div>
                  </div>

                  {/* Annotations list */}
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem" }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em" }}>ANNOTATIONS ({annotations.length})</p>
                      {annotations.length > 0 && (
                        <button type="button"
                          onClick={() => {
                            setAnnotations([]);
                            setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: [], maskBase64: null, saved: false } : item));
                          }}
                          style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                          Clear all
                        </button>
                      )}
                    </div>
                    {annotations.length === 0 ? (
                      <p style={{ fontSize: 11, color: "#cbd5e1", textAlign: "center", padding: "0.75rem 0", margin: 0 }}>No annotations yet</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {annotations.map(ann => (
                          <div key={ann.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", borderRadius: 7, background: "#f8fafc" }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: ann.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", flex: 1 }}>{ann.label}</span>
                            <span style={{ fontSize: 9, color: "#94a3b8", background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>{ann.tool ?? "polygon"}</span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>{ann.points.length}pt{ann.points.length !== 1 ? "s" : ""}</span>
                            <button type="button"
                              onClick={() => {
                                const next = annotations.filter(x => x.id !== ann.id);
                                setAnnotations(next);
                                setManualQueue(q => q.map((item, i) => i === currentIdx ? { ...item, annotations: next } : item));
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: 0, fontFamily: "inherit" }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button type="button" onClick={generateMask}
                      disabled={annotations.length === 0 || saving}
                      style={{ padding: "0.65rem", borderRadius: 10, border: "none", background: (annotations.length && !saving) ? "linear-gradient(135deg, #0369a1, #0ea5e9)" : "#e5e7eb", color: (annotations.length && !saving) ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 700, cursor: (annotations.length && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: (annotations.length && !saving) ? "0 2px 10px rgba(14,165,233,0.35)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      {saving ? (
                        <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#94a3b8", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Saving…</>
                      ) : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Generate Mask &amp; Save</>
                      )}
                    </button>

                    {savedMsg && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.45rem 0.75rem" }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#15803d" }}>{savedMsg}</p>
                      </div>
                    )}

                    {maskPreview && (
                      <button type="button"
                        onClick={() => { const a = document.createElement("a"); a.href = maskPreview; a.download = (currentItem?.filename ?? "image").replace(/\.[^.]+$/, "_mask.png"); a.click(); }}
                        style={{ padding: "0.55rem", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                        ↓ Download Mask PNG
                      </button>
                    )}

                    <div style={{ height: 1, background: "#f1f5f9", margin: "0.1rem 0" }} />

                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", justifyContent: "space-between" }}>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0369a1" }}>{manualQueue.length}</p>
                        <p style={{ margin: 0, fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>TOTAL</p>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0ea5e9" }}>{annotCount}</p>
                        <p style={{ margin: 0, fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>ANNOTATED</p>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#22c55e" }}>{doneCount}</p>
                        <p style={{ margin: 0, fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>SAVED</p>
                      </div>
                    </div>

                    <button type="button" onClick={exportCombinedJSON}
                      disabled={annotCount === 0}
                      style={{ padding: "0.65rem", borderRadius: 10, border: "none", background: annotCount ? "linear-gradient(135deg, #0369a1, #0ea5e9)" : "#e5e7eb", color: annotCount ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: annotCount ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: annotCount ? "0 2px 10px rgba(14,165,233,0.3)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      Export Combined JSON
                    </button>

                    <Link href="/annotation/results"
                      style={{ padding: "0.55rem", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 12, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                      View Saved Results
                    </Link>

                    <button type="button"
                      onClick={() => { setManualQueue([]); setCurrentIdx(0); setAnnotations([]); setCurrentPts([]); setShowMask(false); imgRef.current = null; }}
                      style={{ padding: "0.45rem", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Clear Session
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Note popup ── */}
      {showNotePopup && (() => {
        const r = itemRatings[showNotePopup];
        if (!r) return null;
        return (
          <div
            onClick={() => setShowNotePopup(null)}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, padding: "1.5rem", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "0.85rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#1e293b" }}>Doctor's Assessment</p>
                <button type="button" onClick={() => setShowNotePopup(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              {r.stars > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s <= r.stars ? "#f59e0b" : "none"} stroke={s <= r.stars ? "#f59e0b" : "#d1d5db"} strokeWidth="1.8">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginLeft: 4 }}>
                    {["","Poor","Fair","Good","Very Good","Excellent"][r.stars]}
                  </span>
                </div>
              )}
              {r.note.trim() && (
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65, background: "#f8fafc", borderRadius: 10, padding: "0.75rem 1rem", border: "1px solid #e5e7eb" }}>
                  {r.note}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
