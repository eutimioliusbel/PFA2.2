-- AlterTable (add change tracking fields to pfa_records)
ALTER TABLE "pfa_records" ADD COLUMN "syncState" TEXT NOT NULL DEFAULT 'pristine';
ALTER TABLE "pfa_records" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "pfa_records" ADD COLUMN "pemsVersion" TEXT;
ALTER TABLE "pfa_records" ADD COLUMN "localVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "pfa_records" ADD COLUMN "modifiedFields" TEXT;
ALTER TABLE "pfa_records" ADD COLUMN "modifiedBy" TEXT;
ALTER TABLE "pfa_records" ADD COLUMN "modifiedAt" TIMESTAMP(3);
ALTER TABLE "pfa_records" ADD COLUMN "syncErrorMessage" TEXT;
ALTER TABLE "pfa_records" ADD COLUMN "syncRetryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "pfa_records_organizationId_syncState_idx" ON "pfa_records"("organizationId", "syncState");

-- CreateIndex
CREATE INDEX "pfa_records_organizationId_modifiedAt_idx" ON "pfa_records"("organizationId", "modifiedAt");
