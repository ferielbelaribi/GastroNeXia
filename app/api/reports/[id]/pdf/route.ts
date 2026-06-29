// app/api/reports/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function riskColor(r: string) {
  if (r === "high")     return { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", label: "HIGH RISK" };
  if (r === "moderate") return { bg: "#fff7ed", border: "#fdba74", text: "#c2410c", label: "MODERATE" };
  return                       { bg: "#f0fdf4", border: "#86efac", text: "#15803d", label: "NORMAL" };
}
function severityBadge(s: string) {
  if (s === "high")     return `<span style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">High Risk</span>`;
  if (s === "moderate") return `<span style="background:#fff7ed;color:#c2410c;border:1px solid #fdba74;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">Moderate</span>`;
  return `<span style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">Normal</span>`;
}

// Build inline SVG bounding-box overlay for a frame
function buildFrameSvg(frameDetections: any[]): string {
  if (!frameDetections?.length) return "";
  const COLORS = ["#ef4444","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#f97316","#ec4899","#10b981"];
  const boxes = frameDetections.map((d: any, i: number) => {
    let bb: any = {};
    try { bb = JSON.parse(d.boundingBox ?? "{}"); } catch {}
    const x = bb.x ?? 10, y = bb.y ?? 10, w = bb.w ?? 20, h = bb.h ?? 20;
    const color = COLORS[i % COLORS.length];
    const ly = Math.max(0, y - 7);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="1" rx="1"/>
<rect x="${x}" y="${ly}" width="${w}" height="7" fill="${color}" opacity="0.9" rx="0.8"/>
<text x="${x + w/2}" y="${ly + 5}" text-anchor="middle" font-size="4" fill="white" font-weight="bold" font-family="sans-serif">${d.label} ${Math.round(d.confidence ?? 0)}%</text>`;
  }).join("\n");
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${boxes}</svg>`;
}

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        patient: true, doctor: true,
        visit: { include: { media: true } },
        analysis: { include: { detectedLesions: true, media: true } },
        selectedFrames: {
          orderBy: { displayOrder: "asc" },
          include: {
            frame: {
              include: {
                frameDetections: {
                  select: { id: true, label: true, confidence: true, severity: true, boundingBox: true },
                },
              },
            },
          },
        },
      },
    });

    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const risk  = riskColor(report.analysis.overallRisk);
    const dob   = report.patient.dateOfBirth;
    const age   = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (1000*60*60*24*365.25)) : null;

    const storedIds: string[] = (() => { try { return JSON.parse((report as any).mediaIds ?? "[]"); } catch { return []; } })();

    // Aggregate lesions from all analyses for the included media items
    const allVisitAnalyses = await prisma.analysisResult.findMany({
      where: {
        visitId: report.visitId,
        analysisType: "detection",
        ...(storedIds.length > 0 ? { mediaId: { in: storedIds } } : {}),
      },
      include: { detectedLesions: true },
    });
    const lesions: (typeof allVisitAnalyses[0]["detectedLesions"][0] & { imageLabel: string })[] =
      allVisitAnalyses.length > 0
        ? allVisitAnalyses.flatMap((a, idx) => {
            const imgNum = storedIds.length > 0
              ? storedIds.indexOf(a.mediaId ?? "") + 1
              : idx + 1;
            const label = imgNum > 0 ? `Image ${imgNum}` : `Image ${idx + 1}`;
            return a.detectedLesions.map(l => ({ ...l, imageLabel: label }));
          })
        : report.analysis.detectedLesions.map(l => ({ ...l, imageLabel: "Image 1" }));

    const raw = report.visit.media?.length ? report.visit.media
      : (report.analysis as any).media ? [(report.analysis as any).media] : [];
    const scoped = storedIds.length > 0 ? raw.filter((m: any) => storedIds.includes(m.id)) : raw;
    const mediaList = scoped.filter((m: any) => !!(m.storageUrl || m.annotatedUrl || m.gradcamUrl || m.overlayUrl));
    const sessionImages = mediaList.map((m: any) => {
      const panels: { src: string; label: string; color: string }[] = [];
      if (m.storageUrl)   panels.push({ src: m.storageUrl,   label: "Original",        color: "#6b7280" });
      if (m.annotatedUrl) panels.push({ src: m.annotatedUrl, label: "Detection",        color: "#22c55e" });
      if (m.gradcamUrl)   panels.push({ src: m.gradcamUrl,   label: "Activation Map",   color: "#f59e0b" });
      if (m.overlayUrl)   panels.push({ src: m.overlayUrl,   label: "Mucosal Analysis", color: "#a855f7" });
      return panels;
    }).filter((p: any[]) => p.length > 0);

    const keyFrames = ((report as any).selectedFrames ?? []).filter((sf: any) => sf.frame?.frameUrl);

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<title>${report.title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;font-size:13px;color:#1f2937;background:#fff}
.page{max-width:800px;margin:0 auto;padding:40px 48px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #e5e7eb;margin-bottom:24px}
.logo-area h1{font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:-0.5px}
.logo-area p{font-size:11px;color:#6b7280;margin-top:2px}
.risk-badge{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:800;letter-spacing:0.05em;background:${risk.bg};color:${risk.text};border:1.5px solid ${risk.border}}
.patient-block{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:20px}
.info-row{display:flex;flex-direction:column;gap:2px}
.info-label{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em}
.info-value{font-size:13px;font-weight:600;color:#1f2937}
.section{margin-bottom:20px}
.section-title{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #f3f4f6}
.section-text{font-size:12.5px;line-height:1.6;color:#374151}
.images-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.images-grid.single{grid-template-columns:1fr}
.session-image-block{margin-bottom:16px}
.session-image-label{font-size:10px;font-weight:700;color:#374151;margin-bottom:6px}
.img-card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
.img-label{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;padding:5px 10px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.img-card img{width:100%;display:block;max-height:320px;object-fit:contain;background:#000}
.gradcam-interp{background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:20px}
.gradcam-interp-title{font-size:10px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px}
.gradcam-interp-text{font-size:12px;line-height:1.7;color:#374151;white-space:pre-wrap}
.findings-table{width:100%;border-collapse:collapse;font-size:12px}
.findings-table th{background:#f9fafb;border:1px solid #e5e7eb;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
.findings-table td{border:1px solid #e5e7eb;padding:8px 10px;vertical-align:middle}
.conf-bar-wrap{display:flex;align-items:center;gap:6px}
.conf-bar-bg{flex:1;height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden}
.recommendation-box{background:${risk.bg};border:1.5px solid ${risk.border};border-radius:10px;padding:14px 16px;margin-bottom:20px}
.recommendation-text{font-size:12.5px;line-height:1.6;color:${risk.text};font-weight:500}
.ai-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ai-cell{background:#f9fafb;border:1px solid #f3f4f6;border-radius:7px;padding:8px 10px}
.ai-cell-label{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em}
.ai-cell-value{font-size:12px;font-weight:600;color:#374151;margin-top:3px}
.kf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.kf-item{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;position:relative;background:#0f172a}
.kf-item img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.kf-ts{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.65);color:#fff;font-size:8px;font-weight:700;padding:1px 6px;border-radius:3px;font-family:monospace}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
.footer-left{font-size:10px;color:#9ca3af;line-height:1.5}
.footer-right{font-size:10px;color:#9ca3af;text-align:right}
.signature-line{width:140px;height:1px;background:#d1d5db;margin-bottom:4px}
.no-findings{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;font-size:12px;font-weight:600;color:#15803d;display:flex;align-items:center;gap:8px}
@media print{
  @page{size:A4;margin:18mm 15mm}
  body{background:white!important}
  .page{max-width:100%;padding:0}
  .section,.patient-block,.recommendation-box,.images-grid,.findings-table,.ai-grid,.footer,.kf-grid{break-inside:avoid;page-break-inside:avoid}
}
</style></head>
<body><div class="page">

<div class="header">
  <div class="logo-area">
    <h1>GastroNeXia</h1>
    <p>AI-Assisted Endoscopy Report · ${report.analysis.analysisType === "detection" ? "Computer-Aided Detection" : "Lesion Segmentation"}</p>
  </div>
  <span class="risk-badge">${risk.label}</span>
</div>

<div style="margin-bottom:20px">
  <h2 style="font-size:17px;font-weight:800;color:#1e3a5f;margin-bottom:4px">${report.title}</h2>
  <p style="font-size:11px;color:#6b7280">Report ID: ${report.id.slice(0,8).toUpperCase()} · Generated: ${formatDate(report.generatedAt)}</p>
</div>

<div class="patient-block">
  <div class="info-row"><span class="info-label">Patient</span><span class="info-value">${report.patient.firstName} ${report.patient.lastName}</span></div>
  <div class="info-row"><span class="info-label">Visit Date</span><span class="info-value">${formatDate(report.visit.visitDate)}</span></div>
  <div class="info-row"><span class="info-label">Age / Gender</span><span class="info-value">${age !== null ? `${age} years` : "—"} · ${report.patient.gender}</span></div>
  <div class="info-row"><span class="info-label">Physician</span><span class="info-value">Dr. ${report.doctor.firstName} ${report.doctor.lastName}</span></div>
  ${report.patient.condition ? `<div class="info-row"><span class="info-label">Condition</span><span class="info-value">${report.patient.condition}</span></div>` : ""}
  <div class="info-row"><span class="info-label">Specialty</span><span class="info-value">${report.doctor.specialty || "Gastroenterology"}</span></div>
</div>

${sessionImages.length > 0 ? `
<div class="section">
  <div class="section-title">Endoscopic Imaging (${sessionImages.length} image${sessionImages.length > 1 ? "s" : ""})</div>
  ${sessionImages.map((panels: any[], i: number) => `
  <div class="session-image-block">
    ${sessionImages.length > 1 ? `<div class="session-image-label">Image ${i+1} / ${sessionImages.length}</div>` : ""}
    <div class="images-grid${panels.length === 1 ? " single" : ""}">
      ${panels.map((p: any) => `<div class="img-card"><div class="img-label" style="color:${p.color}">${p.label}</div><img src="${p.src}" alt="${p.label}"/></div>`).join("")}
    </div>
  </div>`).join("")}
</div>` : ""}

${(report as any).gradcamInterpretation ? `
<div class="gradcam-interp">
  <div class="gradcam-interp-title">Grad-CAM Heatmap Interpretation — AI Saliency Analysis</div>
  <div class="gradcam-interp-text">${(report as any).gradcamInterpretation}</div>
</div>` : ""}

${report.clinicalNotes ? `<div class="section"><div class="section-title">Clinical Observations</div><div class="section-text">${report.clinicalNotes}</div></div>` : ""}
${report.conclusion    ? `<div class="section"><div class="section-title">Conclusion</div><div class="section-text">${report.conclusion}</div></div>` : ""}

<div class="section">
  <div class="section-title">Detected Findings (${lesions.length})</div>
  ${lesions.length === 0 ? `
  <div class="no-findings">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    No pathological findings detected. Normal endoscopic appearance.
  </div>` : `
  <table class="findings-table">
    <thead><tr><th>Finding</th><th>Image</th><th>Location</th><th>Severity</th><th>AI Confidence</th></tr></thead>
    <tbody>
      ${lesions.map(l => `
      <tr>
        <td style="font-weight:600">${l.lesionType}</td>
        <td style="color:#6b7280;font-weight:600">${(l as any).imageLabel ?? "—"}</td>
        <td style="color:#6b7280">${l.location || "—"}</td>
        <td>${severityBadge(l.severity)}</td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar-bg"><div style="width:${Math.round(l.confidence)}%;height:100%;background:${l.severity==="high"?"#ef4444":l.severity==="moderate"?"#f97316":"#22c55e"};border-radius:2px"></div></div>
            <span style="font-weight:700;font-size:11px;color:${l.severity==="high"?"#ef4444":l.severity==="moderate"?"#f97316":"#22c55e"};min-width:32px">${Math.round(l.confidence)}%</span>
          </div>
        </td>
      </tr>`).join("")}
    </tbody>
  </table>`}
</div>

${keyFrames.length > 0 ? `
<div class="section">
  <div class="section-title">Documented Findings — Reference Frames (${keyFrames.length})</div>
  <div class="kf-grid">
    ${keyFrames.map((sf: any, i: number) => {
      const f   = sf.frame;
      const ts  = f.timestampSeconds ?? 0;
      const mm  = String(Math.floor(ts / 60)).padStart(2,"0");
      const ss  = String(Math.floor(ts % 60)).padStart(2,"0");
      const svg = sf.includeAnnotation ? buildFrameSvg(f.frameDetections ?? []) : "";
      return `<div class="kf-item">
        <div style="position:relative">
          <img src="${f.frameUrl}" alt="Frame ${i+1}"/>
          ${svg}
          <div class="kf-ts">${mm}:${ss}</div>
        </div>
      </div>`;
    }).join("")}
  </div>
</div>` : ""}

${report.recommendation ? `
<div class="section">
  <div class="section-title">Clinical Recommendation</div>
  <div class="recommendation-box"><div class="recommendation-text">${report.recommendation}</div></div>
</div>` : ""}


<div class="footer">
  <div class="footer-left">
    <strong>GastroNeXia</strong> — AI-Assisted Endoscopy Platform<br/>
    This report is generated with the assistance of artificial intelligence and must be reviewed and validated by a qualified physician.<br/>
    Report generated: ${new Date().toLocaleString("en-GB")}
  </div>
  <div class="footer-right">
    <div class="signature-line"></div>
    Dr. ${report.doctor.firstName} ${report.doctor.lastName}<br/>
    ${report.doctor.specialty || "Gastroenterologist"}
  </div>
</div>

</div>
<script>
  window.addEventListener('load',function(){
    const p=new URLSearchParams(window.location.search);
    if(p.get('print')==='1') setTimeout(()=>window.print(),300);
  });
</script>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to generate PDF" }, { status: 500 });
  }
}
