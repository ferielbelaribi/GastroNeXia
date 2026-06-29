-- DropForeignKey
ALTER TABLE "AnalysisResult" DROP CONSTRAINT "AnalysisResult_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "AnalysisResult" DROP CONSTRAINT "AnalysisResult_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "AnalysisResult" DROP CONSTRAINT "AnalysisResult_visitId_fkey";

-- DropForeignKey
ALTER TABLE "DetectedLesion" DROP CONSTRAINT "DetectedLesion_analysisId_fkey";

-- DropForeignKey
ALTER TABLE "DetectionFrame" DROP CONSTRAINT "DetectionFrame_frameId_fkey";

-- DropForeignKey
ALTER TABLE "DetectionFrame" DROP CONSTRAINT "DetectionFrame_lesionId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_analysisId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_visitId_fkey";

-- DropForeignKey
ALTER TABLE "ReportSelectedFrame" DROP CONSTRAINT "ReportSelectedFrame_frameId_fkey";

-- DropForeignKey
ALTER TABLE "ReportSelectedFrame" DROP CONSTRAINT "ReportSelectedFrame_reportId_fkey";

-- DropForeignKey
ALTER TABLE "VideoFrame" DROP CONSTRAINT "VideoFrame_mediaId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_patientId_fkey";

-- DropForeignKey
ALTER TABLE "VisitMedia" DROP CONSTRAINT "VisitMedia_visitId_fkey";

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitMedia" ADD CONSTRAINT "VisitMedia_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoFrame" ADD CONSTRAINT "VideoFrame_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "VisitMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "VisitMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedLesion" ADD CONSTRAINT "DetectedLesion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionFrame" ADD CONSTRAINT "DetectionFrame_lesionId_fkey" FOREIGN KEY ("lesionId") REFERENCES "DetectedLesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectionFrame" ADD CONSTRAINT "DetectionFrame_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "VideoFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSelectedFrame" ADD CONSTRAINT "ReportSelectedFrame_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSelectedFrame" ADD CONSTRAINT "ReportSelectedFrame_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "VideoFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
