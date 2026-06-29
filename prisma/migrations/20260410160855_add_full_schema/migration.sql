-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "visitType" TEXT NOT NULL DEFAULT 'Endoscopy',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitMedia" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "durationSecs" INTEGER NOT NULL DEFAULT 0,
    "totalFrames" INTEGER NOT NULL DEFAULT 0,
    "captureSource" TEXT NOT NULL DEFAULT 'upload',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoFrame" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "frameIndex" INTEGER NOT NULL,
    "timestampSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frameUrl" TEXT NOT NULL,
    "hasDetection" BOOLEAN NOT NULL DEFAULT false,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'ViT Hybrid',
    "overallConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFramesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "framesWithDetection" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawOutput" TEXT NOT NULL DEFAULT '',
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectedLesion" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "lesionType" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT '',
    "boundingBox" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'low',
    "description" TEXT NOT NULL DEFAULT '',
    "firstSeenFrame" INTEGER NOT NULL DEFAULT 0,
    "lastSeenFrame" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DetectedLesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectionFrame" (
    "id" TEXT NOT NULL,
    "lesionId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "annotatedUrl" TEXT NOT NULL DEFAULT '',
    "maskUrl" TEXT NOT NULL DEFAULT '',
    "frameConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DetectionFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clinicalNotes" TEXT NOT NULL DEFAULT '',
    "conclusion" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "pdfUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSelectedFrame" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "includeAnnotation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReportSelectedFrame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DetectionFrame_frameId_key" ON "DetectionFrame"("frameId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_analysisId_key" ON "Report"("analysisId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedia" ADD CONSTRAINT "VisitMedia_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrame" ADD CONSTRAINT "VideoFrame_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "VisitMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "VisitMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedLesion" ADD CONSTRAINT "DetectedLesion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionFrame" ADD CONSTRAINT "DetectionFrame_lesionId_fkey" FOREIGN KEY ("lesionId") REFERENCES "DetectedLesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionFrame" ADD CONSTRAINT "DetectionFrame_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "VideoFrame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSelectedFrame" ADD CONSTRAINT "ReportSelectedFrame_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSelectedFrame" ADD CONSTRAINT "ReportSelectedFrame_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "VideoFrame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
