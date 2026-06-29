-- AlterTable
ALTER TABLE "VisitMedia" ADD COLUMN     "annotatedUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gradcamUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "overlayUrl" TEXT NOT NULL DEFAULT '';
