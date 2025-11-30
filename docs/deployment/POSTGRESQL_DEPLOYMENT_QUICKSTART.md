# PostgreSQL Deployment Quick Start

Get PFA Vanguard's PostgreSQL database running in development or production in minutes.

## Table of Contents
1. [Development Setup (5 Minutes)](#development-setup-5-minutes)
2. [Production Setup (30 Minutes)](#production-setup-30-minutes)
3. [Migration from SQLite](#migration-from-sqlite)
4. [Verification & Testing](#verification--testing)

---

## Development Setup (5 Minutes)

### Prerequisites

- Docker and Docker Compose installed
- Git repository cloned
- 2GB free disk space

### Steps

**1. Configure Environment (1 minute)**

```bash
cd /path/to/PFA2.2

# Copy environment template
cp .env.example .env

# Generate secure passwords
openssl rand -base64 32  # Use for POSTGRES_PASSWORD
openssl rand -base64 64  # Use for JWT_SECRET

# Edit .env file
nano .env
```

**Required settings in `.env`:**
```bash
# Database
POSTGRES_DB=pfa_vanguard_dev
POSTGRES_USER=pfa_admin
POSTGRES_PASSWORD=<paste generated password>

# Application
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public&sslmode=prefer
JWT_SECRET=<paste generated JWT secret>
```

**2. Generate SSL Certificates (1 minute)**

```bash
cd database/ssl
chmod +x generate-ssl-certs.sh
./generate-ssl-certs.sh
cd ../..
```

**3. Start PostgreSQL (1 minute)**

```bash
# Start database
docker-compose up -d postgres

# Wait for health check (10-15 seconds)
docker-compose ps postgres
# Should show: State: Up (healthy)
```

**4. Initialize Database (2 minutes)**

```bash
cd backend

# Install dependencies (if not already done)
npm install

# Run Prisma migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

**5. Verify Setup**

```bash
# Test database connection
psql "postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev" -c "SELECT version();"

# Check tables exist
psql "postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev" -c "\dt"

# Verify seed data
psql "postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev" -c "SELECT COUNT(*) FROM users;"
# Should return: 1 (admin user)
```

**6. Start Application**

```bash
# In backend directory
npm run dev

# In new terminal, start frontend
cd ..
npm run dev
```

**Login:**
- URL: http://localhost:3000
- Username: `admin`
- Password: `admin123`

---

## Production Setup (30 Minutes)

### Option A: AWS RDS PostgreSQL (Recommended)

**Prerequisites:**
- AWS account with billing enabled
- AWS CLI configured (`aws configure`)
- Terraform installed (optional, for IaC)

**Manual Setup via AWS Console:**

**1. Create RDS Instance (10 minutes)**

```bash
# Navigate to: AWS Console → RDS → Create Database

# Configuration:
Engine: PostgreSQL 15.3
Template: Production
DB Instance: db.t3.medium
Storage: 100 GB gp3 (auto-scaling enabled)
Multi-AZ: Yes
VPC: Select your VPC
Subnet group: Private subnets only
Public access: NO
Security group: Create new (allow 5432 from application SG)
Database name: pfa_vanguard_prod
Master username: pfa_admin
Master password: <Auto-generate and save to Secrets Manager>
Encryption: Enabled (use default KMS key)
Backup retention: 30 days
Enhanced monitoring: Enabled
Performance Insights: Enabled

# Click "Create Database"
# Wait 5-10 minutes for provisioning
```

**2. Store Credentials in Secrets Manager (5 minutes)**

```bash
# Get auto-generated password from RDS console
# Store in Secrets Manager
aws secretsmanager create-secret \
  --name pfa-vanguard/production/database/master_password \
  --description "PostgreSQL master password" \
  --secret-string "AUTO_GENERATED_PASSWORD_FROM_RDS"

# Store other secrets
aws secretsmanager create-secret \
  --name pfa-vanguard/production/auth/jwt_secret \
  --secret-string "$(openssl rand -base64 64)"

aws secretsmanager create-secret \
  --name pfa-vanguard/production/integrations/gemini_api_key \
  --secret-string "YOUR_GEMINI_API_KEY"
```

**3. Configure Security Group (2 minutes)**

```bash
# Get RDS security group ID
RDS_SG=$(aws rds describe-db-instances \
  --db-instance-identifier pfa-production \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Allow PostgreSQL access from application security group
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group YOUR_APPLICATION_SECURITY_GROUP_ID
```

**4. Get Connection Details (1 minute)**

```bash
# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier pfa-production \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Example output: pfa-production.xxxxx.us-east-1.rds.amazonaws.com
```

**5. Update Application Configuration (5 minutes)**

```bash
# Update backend/.env.production
RDS_HOSTNAME=pfa-production.xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=pfa_vanguard_prod
RDS_USERNAME=pfa_admin

# Connection string (password retrieved from Secrets Manager at runtime)
DATABASE_URL=postgresql://${RDS_USERNAME}:${PASSWORD}@${RDS_HOSTNAME}:${RDS_PORT}/${RDS_DB_NAME}?schema=public&sslmode=require
```

**6. Run Migrations (2 minutes)**

```bash
cd backend

# Set DATABASE_URL from Secrets Manager
export DATABASE_URL="postgresql://pfa_admin:PASSWORD@pfa-production.xxxxx.rds.amazonaws.com:5432/pfa_vanguard_prod?sslmode=require"

# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

**7. Verify Production Setup (5 minutes)**

```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check tables
psql "$DATABASE_URL" -c "\dt"

# Verify SSL
psql "$DATABASE_URL" -c "SHOW ssl;"
# Should return: on

# Check Multi-AZ setup
aws rds describe-db-instances \
  --db-instance-identifier pfa-production \
  --query 'DBInstances[0].MultiAZ'
# Should return: true
```

---

### Option B: Supabase (Fastest Setup)

**1. Create Supabase Project (2 minutes)**

```bash
# 1. Go to: https://supabase.com/dashboard
# 2. Click "New Project"
# 3. Configure:
#    - Name: pfa-vanguard-production
#    - Database Password: <Auto-generate>
#    - Region: Choose closest to users
#    - Pricing: Pro ($25/month)
# 4. Click "Create Project"
# 5. Wait 2 minutes for provisioning
```

**2. Get Connection String (1 minute)**

```bash
# Navigate to: Project Settings → Database → Connection String → URI
# Copy the connection string
# Example: postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**3. Update Application (2 minutes)**

```bash
# Update backend/.env.production
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?schema=public&sslmode=require

# Run migrations
cd backend
npx prisma migrate deploy
npx prisma db seed
```

**4. Verify Setup**

```bash
# Test via Supabase SQL Editor (in dashboard)
SELECT version();

# Or via psql
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## Migration from SQLite

### Export SQLite Data

**1. Backup Current SQLite Database**

```bash
cd backend
cp prisma/dev.db prisma/dev.db.backup
```

**2. Export Data to CSV (Optional)**

```bash
# If you need to preserve existing data
sqlite3 prisma/dev.db <<EOF
.headers on
.mode csv
.output users.csv
SELECT * FROM users;
.output pfa_records.csv
SELECT * FROM pfa_records;
.quit
EOF
```

### Update Schema for PostgreSQL

**Prisma schema changes (most are compatible):**

```prisma
// backend/prisma/schema.prisma

datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}

// Rest of schema usually compatible
// Only change: Some default values might need adjustment
```

**Known Incompatibilities:**

| SQLite Feature | PostgreSQL Equivalent | Action Required |
|----------------|----------------------|-----------------|
| `@default(autoincrement())` | `@default(autoincrement())` | No change needed |
| `DateTime @default(now())` | `DateTime @default(now())` | No change needed |
| Boolean `0/1` | Boolean `true/false` | Prisma handles automatically |
| No ENUM support | Native ENUM type | Update schema to use `enum` |

**3. Generate Migration**

```bash
cd backend

# Update DATABASE_URL to point to PostgreSQL
export DATABASE_URL="postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev"

# Create migration
npx prisma migrate dev --name migrate_to_postgresql

# Apply migration
npx prisma migrate deploy
```

**4. Import Data (if preserving existing data)**

```bash
# Import users
psql "$DATABASE_URL" <<EOF
\copy users(id,username,email,password_hash,role,created_at) FROM 'users.csv' CSV HEADER;
EOF

# Import PFA records
psql "$DATABASE_URL" <<EOF
\copy pfa_records(id,organization_id,category,class,...) FROM 'pfa_records.csv' CSV HEADER;
EOF

# Reset sequences
psql "$DATABASE_URL" -c "SELECT reset_all_sequences();"
```

**5. Verify Migration**

```bash
# Check record counts match
echo "SQLite count:"
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM users;"

echo "PostgreSQL count:"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"

# Should match
```

**6. Update Backend Code (if needed)**

```typescript
// Most Prisma queries work identically
// Only potential changes:

// SQLite (case-insensitive)
where: { email: { equals: "USER@EXAMPLE.COM" } }

// PostgreSQL (case-sensitive by default)
where: { email: { equals: "user@example.com", mode: "insensitive" } }
```

**7. Test Application**

```bash
# Start backend
cd backend
npm run dev

# Start frontend
cd ..
npm run dev

# Test all features:
- Login
- Create/Read/Update/Delete PFA records
- Filters
- Timeline drag-and-drop
- AI Assistant
- PEMS sync
```

---

## Verification & Testing

### Database Health Checks

**1. Connection Test**

```bash
psql "$DATABASE_URL" -c "SELECT 1;" || echo "Connection failed!"
```

**2. SSL Verification**

```bash
psql "$DATABASE_URL" -c "SHOW ssl;"
# Expected: on

psql "$DATABASE_URL" -c "SELECT ssl_is_used();"
# Expected: t (true)
```

**3. Database Size**

```bash
psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

**4. Active Connections**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';"
```

**5. Cache Hit Ratio (should be > 90%)**

```bash
psql "$DATABASE_URL" -c "
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 AS cache_hit_ratio
FROM pg_statio_user_tables;
"
```

### Application Integration Tests

**1. Test Authentication**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Should return JWT token
```

**2. Test Database Query**

```bash
# Get token from above
TOKEN="your_jwt_token"

curl http://localhost:3001/api/pfa \
  -H "Authorization: Bearer $TOKEN"

# Should return PFA records
```

**3. Test PEMS Sync**

```bash
curl -X POST http://localhost:3001/api/pems/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"RIO","syncType":"full"}'

# Check sync status
curl http://localhost:3001/api/pems/sync/SYNC_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Performance Benchmarks

**1. Simple Query Performance**

```bash
# Should complete in < 50ms
time psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pfa_records;"
```

**2. Complex Query Performance**

```bash
# Should complete in < 200ms
time psql "$DATABASE_URL" -c "
SELECT
  organization_id,
  category,
  COUNT(*) as count,
  SUM(monthly_rate) as total_cost
FROM pfa_records
WHERE is_discontinued = false
GROUP BY organization_id, category
ORDER BY total_cost DESC;
"
```

**3. Connection Pool Test**

```bash
# Simulate 10 concurrent connections
for i in {1..10}; do
  psql "$DATABASE_URL" -c "SELECT pg_sleep(1);" &
done
wait

# All should complete successfully
```

### Backup & Recovery Test

**1. Create Test Backup**

```bash
cd database/backup-scripts
./backup.sh

# Verify backup created
ls -lh ../backups/
```

**2. Test Restore**

```bash
# Restore to test database
export PGDATABASE=pfa_vanguard_test
./restore.sh --latest

# Verify data
psql -d pfa_vanguard_test -c "SELECT COUNT(*) FROM users;"
```

---

## Troubleshooting

### Common Issues

**Issue: Connection refused**

```bash
# Check database is running
docker-compose ps postgres  # Development
aws rds describe-db-instances --db-instance-identifier pfa-production  # Production

# Check network connectivity
telnet DB_HOST 5432

# Check firewall rules
aws ec2 describe-security-groups --group-ids sg-xxxxx
```

**Issue: Authentication failed**

```bash
# Check credentials
aws secretsmanager get-secret-value \
  --secret-id pfa-vanguard/production/database/master_password

# Test connection manually
psql "postgresql://USER:PASSWORD@HOST:5432/DATABASE" -c "SELECT 1;"
```

**Issue: SSL connection failed**

```bash
# Check SSL is enabled
psql "$DATABASE_URL" -c "SHOW ssl;"

# Update connection string to require SSL
DATABASE_URL="...?sslmode=require"

# Download RDS certificate (if using AWS)
curl -o rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
DATABASE_URL="...?sslmode=verify-full&sslrootcert=./rds-ca-2019-root.pem"
```

**Issue: Migration failed**

```bash
# Check migration status
npx prisma migrate status

# Reset database (DEVELOPMENT ONLY!)
npx prisma migrate reset

# Apply migrations manually
npx prisma migrate deploy
```

**Issue: Poor performance**

```bash
# Check slow queries
psql "$DATABASE_URL" -c "SELECT * FROM slow_queries;"

# Check cache hit ratio
psql "$DATABASE_URL" -c "
SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 FROM pg_statio_user_tables;
"

# If < 90%, consider:
# - Increase shared_buffers
# - Add indexes
# - Optimize queries
```

---

## Next Steps

### Development
- Set up automated backups (cron job)
- Configure monitoring (Prometheus + Grafana)
- Enable query logging for debugging

### Staging
- Deploy to staging environment
- Run integration tests
- Perform load testing

### Production
- Complete security checklist (see DATABASE_SECURITY.md)
- Configure automated backups to S3
- Set up monitoring and alerting
- Test disaster recovery procedures
- Schedule quarterly security audits

---

## Additional Resources

- [Database README](../database/README.md) - Complete database documentation
- [Security Guide](DATABASE_SECURITY.md) - Hardening and incident response
- [Monitoring Guide](DATABASE_MONITORING.md) - Observability setup
- [Production Options](PRODUCTION_DEPLOYMENT_OPTIONS.md) - Hosting comparison

---

**Last Updated:** 2024-11-25
**Estimated Setup Time:**
- Development: 5 minutes
- Production (AWS RDS): 30 minutes
- Production (Supabase): 5 minutes
