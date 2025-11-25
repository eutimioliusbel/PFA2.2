-- AlterTable
ALTER TABLE "api_configurations" ADD COLUMN "firstSyncAt" DATETIME;
ALTER TABLE "api_configurations" ADD COLUMN "lastSyncAt" DATETIME;
ALTER TABLE "api_configurations" ADD COLUMN "lastSyncRecordCount" INTEGER;
ALTER TABLE "api_configurations" ADD COLUMN "totalSyncRecordCount" INTEGER;
