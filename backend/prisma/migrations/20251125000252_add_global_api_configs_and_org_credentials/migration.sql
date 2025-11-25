-- CreateTable
CREATE TABLE "organization_api_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "apiConfigurationId" TEXT NOT NULL,
    "authKeyEncrypted" TEXT,
    "authValueEncrypted" TEXT,
    "customHeaders" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastChecked" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "organization_api_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_api_credentials_apiConfigurationId_fkey" FOREIGN KEY ("apiConfigurationId") REFERENCES "api_configurations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "authKeyEncrypted" TEXT,
    "authValueEncrypted" TEXT,
    "customHeaders" TEXT,
    "operationType" TEXT NOT NULL DEFAULT 'read',
    "feeds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastChecked" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_configurations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_configurations" ("authKeyEncrypted", "authType", "authValueEncrypted", "createdAt", "customHeaders", "feeds", "id", "lastChecked", "lastError", "name", "operationType", "organizationId", "status", "updatedAt", "url", "usage") SELECT "authKeyEncrypted", "authType", "authValueEncrypted", "createdAt", "customHeaders", "feeds", "id", "lastChecked", "lastError", "name", "operationType", "organizationId", "status", "updatedAt", "url", "usage" FROM "api_configurations";
DROP TABLE "api_configurations";
ALTER TABLE "new_api_configurations" RENAME TO "api_configurations";
CREATE INDEX "api_configurations_organizationId_usage_idx" ON "api_configurations"("organizationId", "usage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "organization_api_credentials_organizationId_idx" ON "organization_api_credentials"("organizationId");

-- CreateIndex
CREATE INDEX "organization_api_credentials_apiConfigurationId_idx" ON "organization_api_credentials"("apiConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_api_credentials_organizationId_apiConfigurationId_key" ON "organization_api_credentials"("organizationId", "apiConfigurationId");
