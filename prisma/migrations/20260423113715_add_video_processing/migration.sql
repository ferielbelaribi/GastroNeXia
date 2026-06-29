-- AlterTable
ALTER TABLE "VideoFrame" ADD COLUMN     "analysisResult" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "detectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overallRisk" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "processingStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "FrameDetection" (
    "id" TEXT NOT NULL,
    "frameId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "boundingBox" TEXT NOT NULL DEFAULT '',
    "gradcamBase64" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrameDetection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FrameDetection" ADD CONSTRAINT "FrameDetection_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "VideoFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
