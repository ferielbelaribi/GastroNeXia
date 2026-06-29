// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function PATCH(
//   req: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const body = await req.json();
//     const report = await prisma.report.update({
//       where: { id: params.id },
//       data: {
//         title: body.title,
//         clinicalNotes: body.clinicalNotes,
//         conclusion: body.conclusion,
//         recommendation: body.recommendation,
//         status: body.status,
//         pdfUrl: body.pdfUrl
//       },
//       include: {
//         patient: true,
//         doctor: true,
//         visit: true,
//         analysis: { include: { detectedLesions: true } }
//       }
//     });
//     return NextResponse.json({ report });
//   } catch (error: any) {
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        visit: { include: { media: true } },
        analysis: {
          include: {
            detectedLesions: true,
            media: true,
          },
        },
        selectedFrames: {
          orderBy: { displayOrder: "asc" },
          include: {
            frame: {
              include: {
                frameDetections: {
                  select: {
                    id: true, label: true, confidence: true,
                    severity: true, boundingBox: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const mediaIds: string[] = (() => { try { return JSON.parse((report as any).mediaIds ?? "[]"); } catch { return []; } })();
    const allVisitAnalyses = await prisma.analysisResult.findMany({
      where: {
        visitId: report.visitId,
        analysisType: "detection",
        ...(mediaIds.length > 0 ? { mediaId: { in: mediaIds } } : {}),
      },
      include: { detectedLesions: true },
    });
    const aggregatedLesions = allVisitAnalyses.length > 0
      ? allVisitAnalyses.flatMap((a, idx) => {
          const imgNum = mediaIds.length > 0
            ? mediaIds.indexOf(a.mediaId ?? "") + 1
            : idx + 1;
          const label = imgNum > 0 ? `Image ${imgNum}` : `Image ${idx + 1}`;
          return a.detectedLesions.map(l => ({ ...l, imageLabel: label }));
        })
      : report.analysis.detectedLesions.map(l => ({ ...l, imageLabel: "Image 1" }));

    return NextResponse.json({ report: { ...report, analysis: { ...report.analysis, detectedLesions: aggregatedLesions } } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { clinicalNotes, conclusion, recommendation, status, pdfUrl } = body;

    const report = await prisma.report.update({
      where: { id },
      data: {
        ...(clinicalNotes  !== undefined ? { clinicalNotes }  : {}),
        ...(conclusion     !== undefined ? { conclusion }     : {}),
        ...(recommendation !== undefined ? { recommendation } : {}),
        ...(status         !== undefined ? { status }         : {}),
        ...(pdfUrl         !== undefined ? { pdfUrl }         : {}),
      },
    });

    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}