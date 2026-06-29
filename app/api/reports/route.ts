// // // import { NextRequest, NextResponse } from "next/server";
// // // import { prisma } from "@/lib/prisma";

// // // export async function GET() {
// // //   try {
// // //     const reports = await prisma.report.findMany({
// // //       include: {
// // //         patient: true,
// // //         doctor: true,
// // //         visit: true,
// // //         analysis: {
// // //           include: {
// // //             detectedLesions: true
// // //           }
// // //         }
// // //       },
// // //       orderBy: {
// // //         createdAt: "desc"
// // //       }
// // //     });
// // //     return NextResponse.json(reports);
// // //   } catch (error: any) {
// // //     return NextResponse.json({ error: error.message }, { status: 500 });
// // //   }
// // // }

// // // export async function POST(req: NextRequest) {
// // //   try {
// // //     const body = await req.json();
// // //     const { 
// // //       patientId, visitId, analysisId, doctorId, 
// // //       title, clinicalNotes, conclusion, recommendation, status 
// // //     } = body;

// // //     const existing = await prisma.report.findUnique({ where: { analysisId } });
// // //     if (existing) {
// // //       return NextResponse.json({ error: "A report already exists for this analysis" }, { status: 400 });
// // //     }

// // //     const report = await prisma.report.create({
// // //       data: {
// // //         patientId,
// // //         visitId,
// // //         analysisId,
// // //         doctorId,
// // //         title: title || "New Endoscopy Report",
// // //         clinicalNotes: clinicalNotes || "",
// // //         conclusion: conclusion || "",
// // //         recommendation: recommendation || "",
// // //         status: status || "draft",
// // //       },
// // //       include: {
// // //         patient: true,
// // //         analysis: true
// // //       }
// // //     });

// // //     return NextResponse.json({ report }, { status: 201 });
// // //   } catch (error: any) {
// // //     console.error("POST REPORT ERROR:", error);
// // //     return NextResponse.json({ error: error.message }, { status: 500 });
// // //   }
// // // }

// // import { NextRequest, NextResponse } from "next/server";
// // import { prisma } from "@/lib/prisma";

// // export async function GET(req: NextRequest) {
// //   try {
// //     const { searchParams } = new URL(req.url);
// //     const doctorId = searchParams.get("doctorId");

// //     const reports = await prisma.report.findMany({
// //       where: {
// //         ...(doctorId ? { doctorId } : {}),
// //       },
// //       include: {
// //         patient: true,
// //         doctor: true,
// //         visit: {
// //           include: { media: true },
// //         },
// //         analysis: {
// //           include: {
// //             detectedLesions: true,
// //             media: true,
// //           },
// //         },
// //       },
// //       orderBy: { createdAt: "desc" },
// //     });

// //     return NextResponse.json(reports);
// //   } catch (error: any) {
// //     return NextResponse.json({ error: error.message }, { status: 500 });
// //   }
// // }

// // export async function POST(req: NextRequest) {
// //   try {
// //     const body = await req.json();
// //     const {
// //       patientId, visitId, analysisId, doctorId,
// //       title, clinicalNotes, conclusion, recommendation, status,
// //     } = body;

// //     if (!analysisId) {
// //       return NextResponse.json({ error: "analysisId is required" }, { status: 400 });
// //     }

// //     // لو الرابور موجود — رجعو مباشرة
// //     const existing = await prisma.report.findUnique({ where: { analysisId } });
// //     if (existing) {
// //       return NextResponse.json({ report: existing }, { status: 200 });
// //     }

// //     const report = await prisma.report.create({
// //       data: {
// //         patientId,
// //         visitId,
// //         analysisId,
// //         doctorId,
// //         title:          title          || "Endoscopy Report",
// //         clinicalNotes:  clinicalNotes  || "",
// //         conclusion:     conclusion     || "",
// //         recommendation: recommendation || "",
// //         status:         status         || "draft",
// //       },
// //       include: { patient: true, analysis: true },
// //     });

// //     return NextResponse.json({ report }, { status: 201 });
// //   } catch (error: any) {
// //     console.error("POST REPORT ERROR:", error);
// //     return NextResponse.json({ error: error.message }, { status: 500 });
// //   }
// // }

// // app/api/reports/route.ts — الكود الكامل المصحح
// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const doctorId = searchParams.get("doctorId");

//     const reports = await prisma.report.findMany({
//       where: {
//         ...(doctorId ? { doctorId } : {}),
//       },
//       include: {
//         patient: true,
//         doctor:  true,
//         visit: {
//           include: {
//             // ✅ نرجع كل حقول الميديا بما فيها annotatedUrl, gradcamUrl, overlayUrl
//             media: {
//               select: {
//                 id:           true,
//                 storageUrl:   true,
//                 annotatedUrl: true,
//                 gradcamUrl:   true,
//                 overlayUrl:   true,
//                 mediaType:    true,
//                 filename:     true,
//               },
//             },
//           },
//         },
//         analysis: {
//           include: {
//             detectedLesions: true,
//             // ✅ الميديا المرتبطة بالـ analysis مباشرة
//             media: {
//               select: {
//                 id:           true,
//                 storageUrl:   true,
//                 annotatedUrl: true,
//                 gradcamUrl:   true,
//                 overlayUrl:   true,
//                 mediaType:    true,
//                 filename:     true,
//               },
//             },
//           },
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     return NextResponse.json(reports);
//   } catch (error: any) {
//     console.error("GET REPORTS ERROR:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const {
//       patientId, visitId, analysisId, doctorId,
//       title, clinicalNotes, conclusion, recommendation, status,
//     } = body;

//     if (!analysisId) {
//       return NextResponse.json({ error: "analysisId is required" }, { status: 400 });
//     }

//     // لو الرابور موجود — رجعو مباشرة
//     const existing = await prisma.report.findUnique({ where: { analysisId } });
//     if (existing) {
//       return NextResponse.json({ report: existing }, { status: 200 });
//     }

//     const report = await prisma.report.create({
//       data: {
//         patientId,
//         visitId,
//         analysisId,
//         doctorId,
//         title:          title          || "Endoscopy Report",
//         clinicalNotes:  clinicalNotes  || "",
//         conclusion:     conclusion     || "",
//         recommendation: recommendation || "",
//         status:         status         || "draft",
//       },
//       include: { patient: true, analysis: true },
//     });

//     return NextResponse.json({ report }, { status: 201 });
//   } catch (error: any) {
//     console.error("POST REPORT ERROR:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }


// app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");

    // ── Lightweight list query — no heavy media arrays ────────────────────
    // Full media is loaded lazily by the UI from GET /api/reports/[id].
    const reports = await prisma.report.findMany({
      where: { ...(doctorId ? { doctorId } : {}) },
      select: {
        id: true, title: true, status: true,
        clinicalNotes: true, conclusion: true, recommendation: true,
        pdfUrl: true, generatedAt: true,
        gradcamInterpretation: true, mediaIds: true,
        patient: {
          select: {
            id: true, firstName: true, lastName: true,
            dateOfBirth: true, gender: true, condition: true,
          },
        },
        doctor: {
          select: { id: true, firstName: true, lastName: true, specialty: true },
        },
        visit: {
          select: { id: true, visitDate: true, visitType: true, notes: true },
        },
        analysis: {
          select: {
            id: true, analysisType: true, modelVersion: true,
            overallRisk: true, overallConfidence: true,
            status: true, analyzedAt: true,
            detectedLesions: {
              select: {
                id: true, lesionType: true, classification: true,
                confidence: true, severity: true, description: true, location: true,
              },
            },
            // media intentionally omitted — loaded lazily in detail view
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error("GET REPORTS ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId, visitId, analysisId, doctorId,
      title, clinicalNotes, conclusion, recommendation,
      status, gradcamInterpretation, mediaIds,
      selectedFrameIds,   // string[] — VideoFrame IDs chosen by the doctor
    } = body;

    if (!analysisId) {
      return NextResponse.json({ error: "analysisId is required" }, { status: 400 });
    }

    const report = await prisma.report.create({
      data: {
        patientId,
        visitId,
        analysisId,
        doctorId,
        title:                 title                 || "Endoscopy Report",
        clinicalNotes:         clinicalNotes         || "",
        conclusion:            conclusion            || "",
        recommendation:        recommendation        || "",
        status:                status                || "draft",
        gradcamInterpretation: gradcamInterpretation || "",
        mediaIds:              mediaIds              || "[]",
      },
      include: { patient: true, analysis: true },
    });

    // Save selected key frames
    if (Array.isArray(selectedFrameIds) && selectedFrameIds.length > 0) {
      await prisma.reportSelectedFrame.createMany({
        data: selectedFrameIds.map((frameId: string, i: number) => ({
          reportId:          report.id,
          frameId,
          displayOrder:      i,
          includeAnnotation: true,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error: any) {
    console.error("POST REPORT ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}