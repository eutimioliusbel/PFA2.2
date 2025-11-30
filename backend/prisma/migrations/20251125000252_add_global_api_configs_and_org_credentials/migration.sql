-- CreateTable
CREATE TABLE "organization_api_credentials" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiConfigurationId" TEXT NOT NULL,
    "authKeyEncrypted" TEXT,
    "authValueEncrypted" TEXT,
    "customHeaders" TEXT,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastChecked" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_api_credentials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_api_credentials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_api_credentials_apiConfigurationId_fkey" FOREIGN KEY ("apiConfigurationId") REFERENCES "api_configurations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (make organizationId nullable in api_configurations)
ALTER TABLE "api_configurations" ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "organization_api_credentials_organizationId_idx" ON "organization_api_credentials"("organizationId");

-- CreateIndex
CREATE INDEX "organization_api_credentials_apiConfigurationId_idx" ON "organization_api_credentials"("apiConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_api_credentials_organizationId_apiConfigurationId_key" ON "organization_api_credentials"("organizationId", "apiConfigurationId");
