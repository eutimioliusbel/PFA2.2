-- CreateTable
CREATE TABLE "field_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "fieldMappings" TEXT NOT NULL,
    "includeHeaders" BOOLEAN NOT NULL DEFAULT true,
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "field_configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "field_configurations_organizationId_idx" ON "field_configurations"("organizationId");
