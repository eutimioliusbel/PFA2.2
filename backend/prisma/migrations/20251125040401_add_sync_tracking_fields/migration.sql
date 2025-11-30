-- AlterTable
ALTER TABLE "api_configurations" ADD COLUMN "firstSyncAt" TIMESTAMP(3);
ALTER TABLE "api_configurations" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "api_configurations" ADD COLUMN "lastSyncRecordCount" INTEGER;
ALTER TABLE "api_configurations" ADD COLUMN "totalSyncRecordCount" INTEGER;
