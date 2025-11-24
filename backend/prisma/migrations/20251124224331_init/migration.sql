-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "apiKeyEncrypted" TEXT,
    "apiEndpoint" TEXT,
    "defaultModel" TEXT NOT NULL,
    "availableModels" TEXT NOT NULL,
    "pricingInput" REAL NOT NULL DEFAULT 0,
    "pricingOutput" REAL NOT NULL DEFAULT 0,
    "pricingCached" REAL,
    "maxTokensPerRequest" INTEGER NOT NULL DEFAULT 8192,
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "retryAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "status" TEXT NOT NULL DEFAULT 'untested',
    "lastHealthCheck" DATETIME,
    "errorRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organization_ai_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "accessLevel" TEXT NOT NULL DEFAULT 'full-access',
    "primaryProviderId" TEXT,
    "fallbackProviderIds" TEXT,
    "routingRules" TEXT,
    "dailyLimitUsd" REAL NOT NULL DEFAULT 10.00,
    "monthlyLimitUsd" REAL NOT NULL DEFAULT 100.00,
    "alertThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "maxContextRecords" INTEGER NOT NULL DEFAULT 50,
    "includeHistoricalData" BOOLEAN NOT NULL DEFAULT false,
    "enableSemanticCache" BOOLEAN NOT NULL DEFAULT true,
    "cacheExpirationHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "organization_ai_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" REAL NOT NULL,
    "latencyMs" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "queryHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "pfa_records" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pfa_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsDeleted" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_userId_organizationId_key" ON "user_organizations"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_ai_configs_organizationId_key" ON "organization_ai_configs"("organizationId");

-- CreateIndex
CREATE INDEX "ai_usage_logs_organizationId_createdAt_idx" ON "ai_usage_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_queryHash_idx" ON "ai_usage_logs"("queryHash");

-- CreateIndex
CREATE INDEX "api_configurations_organizationId_usage_idx" ON "api_configurations"("organizationId", "usage");

-- CreateIndex
CREATE INDEX "pfa_records_organizationId_idx" ON "pfa_records"("organizationId");

-- CreateIndex
CREATE INDEX "pfa_records_updatedAt_idx" ON "pfa_records"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pfa_records_organizationId_pfaId_key" ON "pfa_records"("organizationId", "pfaId");

-- CreateIndex
CREATE INDEX "sync_logs_organizationId_createdAt_idx" ON "sync_logs"("organizationId", "createdAt");
