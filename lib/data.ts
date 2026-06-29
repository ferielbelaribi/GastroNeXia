// lib/data.ts

import type { Case, DistItem, NavItem } from "@/Types";

// ─── Re-exported app types ─────────────────────────────────────────────────────
export type { Case, DistItem, NavItem };

// ─── Analysis types ────────────────────────────────────────────────────────────
export type PageMode = "upload" | "live" | "segment";
export type AnalysisState = "idle" | "uploading" | "analyzing" | "done";
export type Severity     = "normal" | "moderate" | "high";
export type XaiMethod    = "Grad-CAM" | "LIME" | "SHAP";

export type Detection = {
  id:         number;
  label:      string;
  confidence: number;
  severity:   Severity;
  location:   string;
  x:          number;
  y:          number;
  w:          number;
  h:          number;
  gradcamBase64?: string;
  cropBase64?:    string;
};

export interface AnalysisResult {
  model: string;
  duration: string;
  frameCount: number;
  detections: Detection[];
  overallRisk: Severity;
  recommendation: string;
}

// ─── Dashboard data ────────────────────────────────────────────────────────────
export const cases: Case[] = [
  { id: "GV-0891", type: "Polyp",        region: "Sigmoid Colon", conf: 97, risk: "High",     date: "Today 09:14", color: "#DC2626" },
  { id: "GV-0890", type: "Normal",       region: "Duodenum",      conf: 99, risk: "Low",      date: "Today 08:52", color: "#059669" },
  { id: "GV-0889", type: "Ulcer",        region: "Gastric Body",  conf: 88, risk: "Moderate", date: "Yesterday",   color: "#D97706" },
  { id: "GV-0888", type: "Polyp",        region: "Cecum",         conf: 94, risk: "High",     date: "Yesterday",   color: "#DC2626" },
  { id: "GV-0887", type: "Normal",       region: "Rectum",        conf: 98, risk: "Low",      date: "Mar 28",      color: "#059669" },
  { id: "GV-0886", type: "Inflammation", region: "Ileum",         conf: 85, risk: "Moderate", date: "Mar 27",      color: "#D97706" },
];

export const weekData:   number[] = [58, 72, 49, 88, 66, 79, 91];
export const weekLabels: string[] = ["M", "T", "W", "T", "F", "S", "S"];
export const trendData:  number[] = [62, 58, 74, 69, 83, 78, 91, 87, 95, 91];

export const distData: DistItem[] = [
  { label: "Polyp",  count: 142, pct: 42, color: "#DC2626" },
  { label: "Ulcer",  count: 67,  pct: 20, color: "#D97706" },
  { label: "Normal", count: 129, pct: 38, color: "#059669" },
];

export const navItems: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",  ico: "dash"     },
  { id: "live",       label: "Polyp AI Diagnostics", ico: "live"     },
  { id: "gallery",    label: "Gallery",    ico: "gallery"  },
  { id: "reports",    label: "Reports",    ico: "reports"  },
  { id: "patient",    label: "Patient",    ico: "patients" },
  { id: "annotation", label: "Data Collection Collab", ico: "annotate" },
];

// ─── Mock analysis results ─────────────────────────────────────────────────────
export const MOCK_RESULT: AnalysisResult = {
  model:       "ViT Hybrid",
  duration:    "2.4s",
  frameCount:  1,
  overallRisk: "moderate",
  recommendation:
    "Gastric ulcer detected. Recommend H. pylori testing and PPI therapy. Schedule follow-up endoscopy in 6–8 weeks.",
  detections: [
    { id: 1, label: "Gastric Ulcer",        confidence: 94, severity: "moderate", location: "Antrum", x: 28, y: 32, w: 22, h: 18 },
    { id: 2, label: "Mucosal Inflammation", confidence: 78, severity: "moderate", location: "Body",   x: 55, y: 18, w: 15, h: 12 },
    { id: 3, label: "Normal Mucosa",        confidence: 99, severity: "normal",   location: "Fundus", x: 10, y: 60, w: 18, h: 14 },
  ],
};

export const MOCK_LIVE_DETECTIONS: Detection[] = [
  { id: 1, label: "Suspicious Region", confidence: 87, severity: "high",   location: "Sigmoid Colon",    x: 35, y: 25, w: 20, h: 16 },
  { id: 2, label: "Normal Mucosa",     confidence: 97, severity: "normal", location: "Descending Colon", x: 62, y: 50, w: 14, h: 12 },
];

// ─── Severity style helper (shared across pages) ───────────────────────────────
export function severityStyle(s: Severity) {
  if (s === "high")
    return { color: "#ef4444", bg: "#fee2e2", border: "#fca5a5", label: "High Risk", dot: "#ef4444" };
  if (s === "moderate")
    return { color: "#f97316", bg: "#fff7ed", border: "#fdba74", label: "Moderate",  dot: "#f97316" };
  return   { color: "#22c55e", bg: "#f0fdf4", border: "#86efac", label: "Normal",    dot: "#22c55e" };
}

// ─── Reports types ─────────────────────────────────────────────────────────────
export type ReportStatus = "draft" | "validated" | "sent";
export type ReportType   = "endoscopy" | "colonoscopy" | "pathology" | "followup" | "capsule";
export type SortKey      = "date" | "patient" | "status" | "type";
export type FilterStatus = "All" | ReportStatus;

export interface Finding {
  label: string;
  detail: string;
  severity: Severity;
}

export interface Report {
  id: number;
  title: string;
  patient: string;
  patientId: number;
  patientAge: number;
  patientGender: "Male" | "Female";
  doctor: string;
  date: string;
  type: ReportType;
  status: ReportStatus;
  pages: number;
  aiModel: string;
  xaiMethod: string;
  overallRisk: Severity;
  summary: string;
  recommendation: string;
  findings: Finding[];
  tags: string[];
}

// ─── Reports mock data ─────────────────────────────────────────────────────────
export const mockReports: Report[] = [
  {
    id: 1001, title: "Upper GI Endoscopy – March 2025",
    patient: "Ahmed Benali", patientId: 1042, patientAge: 46, patientGender: "Male",
    doctor: "Dr. K. Boumediene", date: "2025-03-28", type: "endoscopy",
    status: "validated", pages: 4, aiModel: "ViT Hybrid", xaiMethod: "Grad-CAM",
    overallRisk: "moderate",
    summary: "Active gastric ulcer detected in the antrum measuring 1.2 cm with surrounding mucosal inflammation. H. pylori infection confirmed via rapid urease test.",
    recommendation: "Initiate triple therapy: Omeprazole 20mg + Amoxicillin 1g + Clarithromycin 500mg for 14 days. Schedule follow-up endoscopy in 6–8 weeks to confirm healing.",
    findings: [
      { label: "Gastric Ulcer",        detail: "1.2 cm active ulcer in gastric antrum",          severity: "moderate" },
      { label: "Mucosal Inflammation", detail: "Erythema and edema surrounding ulcer bed",        severity: "moderate" },
      { label: "H. pylori",            detail: "Rapid urease test positive",                      severity: "moderate" },
      { label: "Fundus",               detail: "Normal mucosa, no lesions detected",              severity: "normal"   },
    ],
    tags: ["Gastric Ulcer", "H. pylori", "Triple Therapy"],
  },
  {
    id: 1002, title: "Colonoscopy – Polypectomy Report",
    patient: "Fatima Khaled", patientId: 1043, patientAge: 34, patientGender: "Female",
    doctor: "Dr. K. Boumediene", date: "2025-04-01", type: "colonoscopy",
    status: "sent", pages: 5, aiModel: "ViT Hybrid", xaiMethod: "SHAP",
    overallRisk: "high",
    summary: "Two adenomatous polyps identified and removed during colonoscopy. Polyp A (5mm, sigmoid colon) and Polyp B (7mm, descending colon). No signs of malignancy on macroscopic examination.",
    recommendation: "Histopathology follow-up in 7–10 days. Repeat colonoscopy in 3 years as per surveillance guidelines. Patient to be counseled on dietary fiber and colorectal cancer risk.",
    findings: [
      { label: "Polyp A – Sigmoid",    detail: "5mm sessile polyp, removed via cold snare",      severity: "high"   },
      { label: "Polyp B – Descending", detail: "7mm pedunculated polyp, removed via hot biopsy", severity: "high"   },
      { label: "Rectal Mucosa",        detail: "Normal, no inflammation or lesions",              severity: "normal" },
    ],
    tags: ["Polypectomy", "Adenoma", "Surveillance"],
  },
  {
    id: 1003, title: "Upper Endoscopy – GERD Follow-up",
    patient: "Omar Mansouri", patientId: 1044, patientAge: 60, patientGender: "Male",
    doctor: "Dr. S. Merazga", date: "2025-02-15", type: "endoscopy",
    status: "sent", pages: 3, aiModel: "CNN ResNet-50", xaiMethod: "LIME",
    overallRisk: "moderate",
    summary: "Esophagitis Grade B identified with linear erosions in the lower esophagus. No Barrett's changes or malignant transformation observed. Hiatal hernia of 2cm confirmed.",
    recommendation: "Continue PPI therapy (Omeprazole 40mg once daily). Lifestyle modifications: elevate bed head, avoid late meals, reduce caffeine. Repeat endoscopy in 12 months.",
    findings: [
      { label: "Esophagitis Grade B",         detail: "Linear erosions <5mm, non-confluent",           severity: "moderate" },
      { label: "Hiatal Hernia",               detail: "2cm sliding hiatal hernia confirmed",            severity: "moderate" },
      { label: "Gastroesophageal Junction",   detail: "Z-line intact, no Barrett's changes",           severity: "normal"   },
    ],
    tags: ["GERD", "Esophagitis", "PPI Therapy"],
  },
  {
    id: 1004, title: "Ileocolonoscopy – Crohn's Assessment",
    patient: "Leila Bouzid", patientId: 1045, patientAge: 39, patientGender: "Female",
    doctor: "Dr. K. Boumediene", date: "2025-03-10", type: "colonoscopy",
    status: "validated", pages: 4, aiModel: "ViT Hybrid", xaiMethod: "Grad-CAM",
    overallRisk: "moderate",
    summary: "Mild active inflammation noted in the terminal ileum consistent with Crohn's disease activity. Scattered aphthous ulcers observed. No strictures or fistulas identified.",
    recommendation: "Continue biologic therapy (Adalimumab). Consider steroid taper for acute flare. Repeat ileocolonoscopy in 6 months to assess treatment response.",
    findings: [
      { label: "Terminal Ileum",   detail: "Mild active inflammation, aphthous ulcers", severity: "moderate" },
      { label: "Ileocecal Valve",  detail: "Mildly thickened, no obstruction",          severity: "moderate" },
      { label: "Colon",            detail: "Normal mucosa throughout",                  severity: "normal"   },
    ],
    tags: ["Crohn's Disease", "Biologic Therapy", "Ileitis"],
  },
  {
    id: 1005, title: "Post-op Colonoscopy – Oncology",
    patient: "Youcef Hamidi", patientId: 1046, patientAge: 72, patientGender: "Male",
    doctor: "Dr. S. Merazga", date: "2025-01-20", type: "colonoscopy",
    status: "sent", pages: 3, aiModel: "EfficientNet", xaiMethod: "Grad-CAM",
    overallRisk: "normal",
    summary: "Post-surgical surveillance colonoscopy performed. Anastomosis site appears well-healed with no signs of local recurrence. Colonic mucosa normal throughout.",
    recommendation: "Remission confirmed. Continue annual surveillance colonoscopy. Transfer to oncology outpatient clinic for systemic follow-up. No further GI intervention required.",
    findings: [
      { label: "Anastomosis Site", detail: "Well-healed, no recurrence detected",       severity: "normal" },
      { label: "Remaining Colon",  detail: "Normal mucosa, no polyps or masses",        severity: "normal" },
    ],
    tags: ["Post-op", "Remission", "Surveillance"],
  },
  {
    id: 1006, title: "Routine Endoscopy – IBS Consultation",
    patient: "Samira Ait", patientId: 1047, patientAge: 30, patientGender: "Female",
    doctor: "Dr. K. Boumediene", date: "2025-03-22", type: "endoscopy",
    status: "draft", pages: 2, aiModel: "CNN ResNet-50", xaiMethod: "LIME",
    overallRisk: "normal",
    summary: "Normal upper GI endoscopy. No structural abnormality identified. Findings consistent with functional gastrointestinal disorder (IBS-D).",
    recommendation: "No further endoscopic intervention required. Recommend low-FODMAP diet, stress management, and regular follow-up with gastroenterologist every 6 months.",
    findings: [
      { label: "Esophagus", detail: "Normal mucosa, no inflammation", severity: "normal" },
      { label: "Stomach",   detail: "Normal gastric folds, no pathology", severity: "normal" },
      { label: "Duodenum",  detail: "Normal villi, no lesions",         severity: "normal" },
    ],
    tags: ["IBS", "Functional GI", "Normal Findings"],
  },
  {
    id: 1007, title: "Liver Assessment – Cirrhosis Monitoring",
    patient: "Karim Ziani", patientId: 1048, patientAge: 54, patientGender: "Male",
    doctor: "Dr. K. Boumediene", date: "2025-03-05", type: "endoscopy",
    status: "validated", pages: 5, aiModel: "ViT Hybrid", xaiMethod: "Grad-CAM++",
    overallRisk: "high",
    summary: "Upper endoscopy for variceal surveillance in known Child-Pugh class B cirrhosis. Grade II esophageal varices identified. No active bleeding. Portal hypertensive gastropathy present.",
    recommendation: "Non-selective beta-blocker therapy (Propranolol 40mg). Consider prophylactic variceal banding. Monthly liver function monitoring. Urgent reassessment if hematemesis occurs.",
    findings: [
      { label: "Esophageal Varices",              detail: "Grade II varices, no stigmata of bleeding", severity: "high"     },
      { label: "Portal Hypertensive Gastropathy", detail: "Mosaic pattern, mild",                      severity: "moderate" },
      { label: "Cardia",                          detail: "No gastric varices identified",             severity: "normal"   },
    ],
    tags: ["Cirrhosis", "Varices", "Beta-blocker"],
  },
  {
    id: 1008, title: "Capsule Endoscopy – Celiac Assessment",
    patient: "Nadia Ferhat", patientId: 1049, patientAge: 36, patientGender: "Female",
    doctor: "Dr. S. Merazga", date: "2025-02-28", type: "capsule",
    status: "sent", pages: 6, aiModel: "ViT Hybrid", xaiMethod: "SHAP",
    overallRisk: "normal",
    summary: "Capsule endoscopy for small bowel assessment in known celiac disease on gluten-free diet. Villous atrophy significantly improved compared to prior study. Mucosa appears healing.",
    recommendation: "Continue strict gluten-free diet. Annual capsule endoscopy or gastroscopy with duodenal biopsy. Dietary review with nutritionist recommended.",
    findings: [
      { label: "Duodenum", detail: "Partial villous recovery, Marsh Grade I", severity: "normal" },
      { label: "Jejunum",  detail: "Healing mucosa, no active inflammation",  severity: "normal" },
      { label: "Ileum",    detail: "Normal appearance throughout",            severity: "normal" },
    ],
    tags: ["Celiac Disease", "Capsule Endoscopy", "Gluten-free"],
  },
];

// ─── Reports helpers ───────────────────────────────────────────────────────────
export const avatarGradients: [string, string][] = [
  ["#dbeafe","#4f8ef7"], ["#dcfce7","#22c55e"], ["#ffedd5","#f97316"],
  ["#f3e8ff","#a855f7"], ["#fee2e2","#ef4444"], ["#ccfbf1","#14b8a6"],
  ["#fef9c3","#eab308"], ["#fce7f3","#ec4899"],
];

export function patientInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function statusStyle(s: ReportStatus) {
  if (s === "validated") return { color: "#22c55e", bg: "#f0fdf4", border: "#86efac", label: "Validated", icon: "✓" };
  if (s === "sent")      return { color: "#4f8ef7", bg: "#eff6ff", border: "#93c5fd", label: "Sent",      icon: "→" };
  return                        { color: "#f97316", bg: "#fff7ed", border: "#fdba74", label: "Draft",     icon: "✎" };
}

export function typeLabel(t: ReportType) {
  const map: Record<ReportType, { label: string; icon: string; color: string }> = {
    endoscopy:   { label: "Endoscopy",   icon: "🔬", color: "#4f8ef7" },
    colonoscopy: { label: "Colonoscopy", icon: "🔍", color: "#a855f7" },
    pathology:   { label: "Pathology",   icon: "🧫", color: "#ef4444" },
    followup:    { label: "Follow-up",   icon: "📋", color: "#22c55e" },
    capsule:     { label: "Capsule",     icon: "💊", color: "#f97316" },
  };
  return map[t];
}

export function relativeDate(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Patients types ────────────────────────────────────────────────────────────
export type PatientGender  = "Male" | "Female";
export type PatientStatus  = "Active" | "Archived";
export type AnalysisType   = "analysis" | "report" | "visit";

export interface PatientAnalysis {
  id: number;
  date: string;
  type: AnalysisType;
  label: string;
  result: string;
  severity: Severity;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  age: number;
  gender: PatientGender;
  phone: string;
  email: string;
  condition: string;
  lastVisit: string;
  status: PatientStatus;
  notes: string;
  analyses: PatientAnalysis[];
}

// // ─── Patients mock data ────────────────────────────────────────────────────────
// export const mockPatients: Patient[] = [
//   {
//     id: , firstName: "Ahmed", lastName: "Benali", dob: "1978-04-12", age: 46,
//     gender: "Male", phone: "+213 555 001 234", email: "a.benali@email.com",
//     condition: "Gastric Ulcer", lastVisit: "2025-03-28", status: "Active",
//     notes: "Follow-up required in 3 months.",
//     analyses: [
//       { id: 1, date: "2025-03-28", type: "analysis", label: "Upper GI Endoscopy",  result: "Gastric ulcer detected – 1.2cm", severity: "moderate" },
//       { id: 2, date: "2025-03-28", type: "report",   label: "Pathology Report",    result: "H. pylori positive",             severity: "moderate" },
//       { id: 3, date: "2024-11-10", type: "visit",    label: "Routine Check",       result: "Stable condition",               severity: "normal"   },
//     ],
//   },
//   {
//     id: 2, firstName: "Fatima", lastName: "Khaled", dob: "1990-09-05", age: 34,
//     gender: "Female", phone: "+213 555 002 567", email: "f.khaled@email.com",
//     condition: "Colorectal Polyp", lastVisit: "2025-04-01", status: "Active",
//     notes: "Polypectomy performed. Monitor every 6 months.",
//     analyses: [
//       { id: 4, date: "2025-04-01", type: "analysis", label: "Colonoscopy",    result: "2 polyps removed (5mm, 7mm)",      severity: "high"     },
//       { id: 5, date: "2025-04-01", type: "report",   label: "Histopathology", result: "Adenomatous polyps – benign",      severity: "moderate" },
//     ],
//   },
//   {
//     id: 3, firstName: "Omar", lastName: "Mansouri", dob: "1965-02-20", age: 60,
//     gender: "Male", phone: "+213 555 003 890", email: "o.mansouri@email.com",
//     condition: "GERD", lastVisit: "2025-02-15", status: "Active",
//     notes: "On PPI therapy. Dietary adjustments recommended.",
//     analyses: [
//       { id: 6, date: "2025-02-15", type: "analysis", label: "Upper Endoscopy",   result: "Esophagitis Grade B",    severity: "moderate" },
//       { id: 7, date: "2024-08-10", type: "visit",    label: "Routine Follow-up", result: "Symptoms improved",      severity: "normal"   },
//     ],
//   },
//   {
//     id: 4, firstName: "Leila", lastName: "Bouzid", dob: "1985-07-30", age: 39,
//     gender: "Female", phone: "+213 555 004 123", email: "l.bouzid@email.com",
//     condition: "Crohn's Disease", lastVisit: "2025-03-10", status: "Active",
//     notes: "Biologic therapy ongoing.",
//     analyses: [
//       { id: 8, date: "2025-03-10", type: "analysis", label: "Ileocolonoscopy", result: "Mild inflammation in terminal ileum", severity: "moderate" },
//     ],
//   },
//   {
//     id: 5, firstName: "Youcef", lastName: "Hamidi", dob: "1952-11-08", age: 72,
//     gender: "Male", phone: "+213 555 005 456", email: "y.hamidi@email.com",
//     condition: "Colorectal Cancer", lastVisit: "2025-01-20", status: "Archived",
//     notes: "Post-surgery follow-up completed. Transferred to oncology.",
//     analyses: [
//       { id: 9,  date: "2025-01-20", type: "analysis", label: "Post-op Colonoscopy", result: "No recurrence detected", severity: "normal" },
//       { id: 10, date: "2025-01-20", type: "report",   label: "Oncology Report",     result: "Remission confirmed",   severity: "normal" },
//     ],
//   },
//   {
//     id: 6, firstName: "Samira", lastName: "Ait", dob: "1995-03-14", age: 30,
//     gender: "Female", phone: "+213 555 006 789", email: "s.ait@email.com",
//     condition: "IBS", lastVisit: "2025-03-22", status: "Active",
//     notes: "Stress management and dietary fiber increase advised.",
//     analyses: [
//       { id: 11, date: "2025-03-22", type: "visit", label: "Consultation", result: "IBS-D diagnosis confirmed", severity: "normal" },
//     ],
//   },
// ];

export const patientAvatarColors: [string, string][] = [
  ["#eff6ff", "#4f8ef7"], ["#f0fdf4", "#22c55e"], ["#fff7ed", "#f97316"],
  ["#fdf4ff", "#a855f7"], ["#fff1f2", "#f43f5e"], ["#f0fdfa", "#14b8a6"],
];

export const emptyPatientForm = {
  firstName: "", lastName: "", dob: "", gender: "Male" as PatientGender,
  phone: "", email: "", condition: "", notes: "",
};

export function patientInitialsFromObj(p: Patient) {
  return `${p.firstName[0]}${p.lastName[0]}`;
}

export function analysisTypeColor(t: AnalysisType): string {
  if (t === "analysis") return "#4f8ef7";
  if (t === "report")   return "#a855f7";
  return "#f97316";
}

// ─── Settings types ────────────────────────────────────────────────────────────
export type SettingsTabId = "ai-model" | "appearance" | "language" | "integrations" | "audit" | "storage";

export interface AuditEntry {
  id: number;
  user: string;
  action: string;
  target: string;
  date: string;
  time: string;
  ip: string;
  type: "analysis" | "auth" | "patient" | "settings" | "report";
}

// ─── Settings mock data ────────────────────────────────────────────────────────
export const auditLog: AuditEntry[] = [
  { id: 1, user: "Dr. K. Boumediene", action: "Ran AI analysis",        target: "Patient #1042 – Ahmed Benali",          date: "2025-04-03", time: "09:14", ip: "192.168.1.12", type: "analysis" },
  { id: 2, user: "Dr. K. Boumediene", action: "Logged in",              target: "Chrome – Windows 11",                   date: "2025-04-03", time: "09:10", ip: "192.168.1.12", type: "auth"     },
  { id: 3, user: "Admin",             action: "Added new patient",      target: "Fatima Khaled",                         date: "2025-04-02", time: "16:45", ip: "10.0.0.5",     type: "patient"  },
  { id: 4, user: "Dr. K. Boumediene", action: "Generated report",       target: "Colonoscopy – Omar Mansouri",           date: "2025-04-02", time: "14:30", ip: "192.168.1.12", type: "report"   },
  { id: 5, user: "Admin",             action: "Changed AI model",       target: "CNN → ViT Hybrid",                      date: "2025-04-01", time: "11:00", ip: "10.0.0.5",     type: "settings" },
  { id: 6, user: "Dr. S. Merazga",    action: "Validated AI prediction",target: "Patient #1038 – Leila Bouzid",          date: "2025-04-01", time: "10:22", ip: "192.168.1.19", type: "analysis" },
  { id: 7, user: "Dr. K. Boumediene", action: "Updated patient record", target: "Youcef Hamidi",                         date: "2025-03-31", time: "17:05", ip: "192.168.1.12", type: "patient"  },
  { id: 8, user: "Admin",             action: "Exported data",          target: "Full account archive",                  date: "2025-03-30", time: "08:50", ip: "10.0.0.5",     type: "settings" },
];

export const auditTypeStyle: Record<AuditEntry["type"], { color: string; bg: string; label: string }> = {
  analysis: { color: "#4f8ef7", bg: "#eff6ff", label: "Analysis" },
  auth:     { color: "#6b7280", bg: "#f9fafb", label: "Auth"     },
  patient:  { color: "#f97316", bg: "#fff7ed", label: "Patient"  },
  settings: { color: "#a855f7", bg: "#faf5ff", label: "Settings" },
  report:   { color: "#22c55e", bg: "#f0fdf4", label: "Report"   },
};

export const storageItems = [
  { label: "Endoscopy Images",     size: "8.2 GB", icon: "🔬" },
  { label: "AI Analysis Results",  size: "3.7 GB", icon: "🧠" },
  { label: "Medical Reports",      size: "2.4 GB", icon: "📄" },
];

export const storageUsedGB  = 14.3;
export const storageTotalGB = 50;