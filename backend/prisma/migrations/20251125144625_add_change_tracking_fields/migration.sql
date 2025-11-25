-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pfa_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pfaId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "areaSilo" TEXT,
    "category" TEXT,
    "forecastCategory" TEXT,
    "class" TEXT,
    "source" TEXT,
    "dor" TEXT,
    "isActualized" BOOLEAN NOT NULL DEFAULT false,
    "isDiscontinued" BOOLEAN NOT NULL DEFAULT false,
    "isFundsTransferable" BOOLEAN NOT NULL DEFAULT false,
    "monthlyRate" REAL,
    "purchasePrice" REAL,
    "manufacturer" TEXT,
    "model" TEXT,
    "originalStart" DATETIME,
    "originalEnd" DATETIME,
    "hasPlan" BOOLEAN NOT NULL DEFAULT false,
    "forecastStart" DATETIME,
    "forecastEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "hasActuals" BOOLEAN NOT NULL DEFAULT false,
    "contract" TEXT,
    "equipment" TEXT,
    "lastModified" DATETIME,
    "lastModifiedBy" TEXT,
    "syncState" TEXT NOT NULL DEFAULT 'pristine',
    "lastSyncedAt" DATETIME,
    "pemsVersion" TEXT,
    "localVersion" INTEGER NOT NULL DEFAULT 1,
    "modifiedFields" TEXT,
    "modifiedBy" TEXT,
    "modifiedAt" DATETIME,
    "syncErrorMessage" TEXT,
    "syncRetryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pfa_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pfa_records" ("actualEnd", "actualStart", "areaSilo", "category", "class", "contract", "createdAt", "dor", "equipment", "forecastCategory", "forecastEnd", "forecastStart", "hasActuals", "hasPlan", "id", "isActualized", "isDiscontinued", "isFundsTransferable", "lastModified", "lastModifiedBy", "manufacturer", "model", "monthlyRate", "organizationId", "originalEnd", "originalStart", "pfaId", "purchasePrice", "source", "updatedAt") SELECT "actualEnd", "actualStart", "areaSilo", "category", "class", "contract", "createdAt", "dor", "equipment", "forecastCategory", "forecastEnd", "forecastStart", "hasActuals", "hasPlan", "id", "isActualized", "isDiscontinued", "isFundsTransferable", "lastModified", "lastModifiedBy", "manufacturer", "model", "monthlyRate", "organizationId", "originalEnd", "originalStart", "pfaId", "purchasePrice", "source", "updatedAt" FROM "pfa_records";
DROP TABLE "pfa_records";
ALTER TABLE "new_pfa_records" RENAME TO "pfa_records";
CREATE INDEX "pfa_records_organizationId_idx" ON "pfa_records"("organizationId");
CREATE INDEX "pfa_records_updatedAt_idx" ON "pfa_records"("updatedAt");
CREATE INDEX "pfa_records_organizationId_syncState_idx" ON "pfa_records"("organizationId", "syncState");
CREATE INDEX "pfa_records_organizationId_modifiedAt_idx" ON "pfa_records"("organizationId", "modifiedAt");
CREATE UNIQUE INDEX "pfa_records_organizationId_pfaId_key" ON "pfa_records"("organizationId", "pfaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
