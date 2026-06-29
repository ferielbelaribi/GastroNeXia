-- DropForeignKey
ALTER TABLE "AnalysisResult" DROP CONSTRAINT "AnalysisResult_mediaId_fkey";

-- AlterTable
ALTER TABLE "AnalysisResult" ADD COLUMN     "analysisType" TEXT NOT NULL DEFAULT 'detection',
ADD COLUMN     "overallRisk" TEXT NOT NULL DEFAULT 'low',
ALTER COLUMN "mediaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DetectedLesion" ADD COLUMN     "areaPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "VisitMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
