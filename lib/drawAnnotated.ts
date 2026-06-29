// lib/drawAnnotated.ts
// يرسم البوكسات على الصورة في المتصفح ويرجعها كـ base64

interface BBox {
  x: number; // percentage 0-100
  y: number;
  w: number;
  h: number;
}

interface DetectionForDraw {
  label: string;
  confidence: number;
  severity: string;
  bbox: BBox;
}

function severityColor(_severity: string): string {
  return "#22c55e"; // green for all severities
}

// Warm, transparent palette for each segment (fill = semi-transparent, stroke = near-solid)
const SEG_OVERLAY_PALETTE: Array<{
  fill:   [number, number, number, number];  // RGBA fill (semi-transparent)
  stroke: [number, number, number];          // RGB stroke (near-solid)
}> = [
  { fill: [255, 120,   0,  90], stroke: [255, 150,   0] },  // orange  — primary polyp
  { fill: [255, 205,   0,  90], stroke: [255, 210,   0] },  // amber   — second region
  { fill: [255,  55,  90,  90], stroke: [255,  70, 100] },  // coral   — third region
  { fill: [190,  70, 255,  90], stroke: [180,  60, 255] },  // violet  — fourth region
];

// RGB values of the backend vivid palette (SEGMENT_PALETTE in segmentor.py, converted BGR→RGB)
// Used to detect which segment each pixel belongs to.
const BACKEND_RGB: Array<[number, number, number]> = [
  [170, 255,   0],  // chartreuse (#aaff00)  — G dominant
  [  0, 170, 255],  // sky blue   (#00aaff)  — B dominant
  [255, 204,   0],  // gold       (#ffcc00)  — R > G > B
  [255,   0, 204],  // magenta    (#ff00cc)  — R > B > G
];

/**
 * Identifies which backend segment a vivid pixel belongs to.
 * Returns 1-4 (1-indexed) or 0 for background.
 * Background pixels have very low brightness (total < 80).
 */
function detectSegment(r: number, g: number, b: number): number {
  if (r + g + b < 80) return 0; // background

  let best = 0;
  let bestDist = Infinity;
  for (let s = 0; s < BACKEND_RGB.length; s++) {
    const [cr, cg, cb] = BACKEND_RGB[s];
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = s + 1; }
  }
  return best;
}

/**
 * Re-renders a raw vivid segmentation mask (black background + vivid regions)
 * as a transparent RGBA image with:
 *  - Semi-transparent warm fill inside each segment
 *  - Thick (CONTOUR_R px) near-solid contour at segment boundaries (inside + outside)
 *  - Different warm colors per segment
 */
export async function renderSegmentationOverlay(rawMaskUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(rawMaskUrl); return; }

      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, width, height);

      // Step 1 — build segment membership map (0 = background)
      const segMap = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        segMap[i] = detectSegment(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      }

      // Step 2 — render to RGBA output (all transparent initially)
      const out = new Uint8ClampedArray(width * height * 4); // filled with 0
      const R  = 3; // contour radius in pixels
      const R2 = R * R;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const seg = segMap[idx];

          let nearBoundary = false; // seg pixel: near edge?
          let nearSeg      = 0;     // bg pixel:  nearest segment

          search: for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
              if (dx * dx + dy * dy > R2) continue;
              const ny = y + dy, nx = x + dx;
              if (ny < 0 || ny >= height || nx < 0 || nx >= width) {
                if (seg > 0) { nearBoundary = true; break search; }
                continue;
              }
              const ns = segMap[ny * width + nx];
              if (seg > 0 && ns !== seg) { nearBoundary = true; break search; }
              if (seg === 0 && ns > 0 && nearSeg === 0) nearSeg = ns;
            }
          }

          if (seg > 0) {
            const pal = SEG_OVERLAY_PALETTE[seg - 1];
            if (nearBoundary) {
              // Contour pixel (at or near mask edge, painted inside the mask)
              out[idx * 4]     = pal.stroke[0];
              out[idx * 4 + 1] = pal.stroke[1];
              out[idx * 4 + 2] = pal.stroke[2];
              out[idx * 4 + 3] = 230;
            } else {
              // Interior fill
              out[idx * 4]     = pal.fill[0];
              out[idx * 4 + 1] = pal.fill[1];
              out[idx * 4 + 2] = pal.fill[2];
              out[idx * 4 + 3] = pal.fill[3];
            }
          } else if (nearSeg > 0) {
            // Outer contour pixel (background side of mask edge)
            const pal = SEG_OVERLAY_PALETTE[nearSeg - 1];
            out[idx * 4]     = pal.stroke[0];
            out[idx * 4 + 1] = pal.stroke[1];
            out[idx * 4 + 2] = pal.stroke[2];
            out[idx * 4 + 3] = 215;
          }
          // else: fully transparent background
        }
      }

      ctx.putImageData(new ImageData(out, width, height), 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(rawMaskUrl);
    img.src = rawMaskUrl;
  });
}

// Makes near-black pixels transparent, preserving the mask's original colors.
export async function makeBlackTransparent(overlayDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(overlayDataUrl); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 30) d[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(overlayDataUrl);
    img.src = overlayDataUrl;
  });
}

// Replaces every non-background pixel in a segmentation mask with the target color.
// Works with both RGBA masks (transparent background) and RGB masks (black background).
export async function colorizeSegMask(
  overlayDataUrl: string,
  color: string = "#3b82f6"
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(overlayDataUrl); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) { d[i + 3] = 0; continue; }

        const maxC = Math.max(d[i], d[i + 1], d[i + 2]);
        const minC = Math.min(d[i], d[i + 1], d[i + 2]);
        const saturation = maxC - minC; // high = vivid color, low = gray/black

        // Only pixels with vivid color (polyp region) — ignores dark/gray background
        if (saturation > 60 && maxC > 80) {
          d[i]     = r;
          d[i + 1] = g;
          d[i + 2] = b;
          d[i + 3] = 180;
        } else {
          d[i]     = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(overlayDataUrl);
    img.src = overlayDataUrl;
  });
}

// Composites a transparent RGBA segmentation overlay on top of a base image
export async function compositeWithOverlay(baseUrl: string, overlayUrl: string, overlayOpacity = 1.0): Promise<string> {
  return new Promise((resolve) => {
    const base = new Image();
    base.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = base.naturalWidth;
      canvas.height = base.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(baseUrl); return; }

      ctx.drawImage(base, 0, 0);

      const overlay = new Image();
      overlay.onload = () => {
        ctx.globalAlpha = overlayOpacity;
        ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      overlay.onerror = () => resolve(baseUrl);
      overlay.src = overlayUrl;
    };
    base.onerror = () => resolve(baseUrl);
    base.src = baseUrl;
  });
}

export async function drawAnnotatedImage(
  imageFile: File,
  detections: DetectionForDraw[]
): Promise<string | null> {
  return new Promise((resolve) => {
    if (detections.length === 0) { resolve(null); return; }

    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }

      // ارسم الصورة الأصلية
      ctx.drawImage(img, 0, 0);

      for (const d of detections) {
        const color = severityColor(d.severity);
        const x = (d.bbox.x / 100) * canvas.width;
        const y = (d.bbox.y / 100) * canvas.height;
        const w = (d.bbox.w / 100) * canvas.width;
        const h = (d.bbox.h / 100) * canvas.height;

        // L-corner measurement markers
        const cLen = Math.max(8, Math.min(w, h) * 0.14);
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(3, canvas.width * 0.005);
        ctx.setLineDash([]);
        for (const [px, py, dx, dy] of [
          [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
        ] as [number, number, number, number][]) {
          ctx.beginPath(); ctx.moveTo(px, py + dy * cLen); ctx.lineTo(px, py); ctx.lineTo(px + dx * cLen, py); ctx.stroke();
        }

        // Dashed main rect
        ctx.lineWidth = Math.max(2, canvas.width * 0.003);
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // 2-line label
        const fontSize   = Math.max(12, canvas.width * 0.018);
        const dimFontSize = Math.max(10, canvas.width * 0.014);
        const labelText  = `${d.label}  ·  ${Math.round(d.confidence)}%`;
        const dimText    = `W ${d.bbox.w.toFixed(1)}%   ·   H ${d.bbox.h.toFixed(1)}%`;
        ctx.font = `bold ${fontSize}px Arial`;
        const lw = ctx.measureText(labelText).width;
        ctx.font = `600 ${dimFontSize}px Arial`;
        const dw = ctx.measureText(dimText).width;
        const bgW  = Math.max(lw, dw) + 16;
        const lineH = fontSize + 8;
        const dimLineH = dimFontSize + 6;
        const bgH  = lineH + dimLineH;
        const bgY  = y < bgH + 4 ? y + h : y - bgH;

        ctx.fillStyle = color;
        ctx.fillRect(x, bgY, bgW, bgH);

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(labelText, x + 8, bgY + lineH - 5);

        ctx.font = `600 ${dimFontSize}px Arial`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(dimText, x + 8, bgY + bgH - 4);
      }

      URL.revokeObjectURL(url);
      // نرجع base64 بدون prefix
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ""));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}