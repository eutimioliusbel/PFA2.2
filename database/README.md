# PFA Vanguard Database Infrastructure

Secure, production-grade PostgreSQL deployment configuration for PFA Vanguard.

## Quick Start

### Development Setup (5 Minutes)

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set secure passwords

# 2. Generate SSL certificates
cd database/ssl
chmod +x generate-ssl-certs.sh
./generate-ssl-certs.sh

# 3. Start PostgreSQL
cd ../..
docker-compose up -d postgres

# 4. Verify database is running
docker-compose ps postgres
docker-compose logs postgres

# 5. Run migrations
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### Access Database

```bash
# Via psql
psql "postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev?sslmode=prefer"

# Via pgAdmin (optional)
docker-compose --profile admin up -d pgadmin
# Open: http://localhost:5050
```

## Directory Structure

```
database/
├── README.md                      # This file
├── init-scripts/                  # Database initialization
│   └── 01-init-security.sql      # Security setup, roles, audit logging
├── backup-scripts/                # Backup & restore automation
│   ├── README.md                 # Backup documentation
│   ├── backup.sh                 # Automated backup script
│   └── restore.sh                # Restore script
├── ssl/                           # SSL/TLS certificates
│   ├── README.md                 # SSL configuration guide
│   ├── generate-ssl-certs.sh     # Certificate generation
│   └── .gitignore                # Protect private keys
├── backups/                       # Backup storage (git-ignored)
└── logs/                          # PostgreSQL logs (git-ignored)
```

## Documentation

### Core Documentation
- [**DATABASE_SECURITY.md**](../docs/DATABASE_SECURITY.md) - Security hardening and incident response
- [**SECRETS_MANAGEMENT.md**](../docs/SECRETS_MANAGEMENT.md) - Managing credentials securely
- [**DATABASE_MONITORING.md**](../docs/DATABASE_MONITORING.md) - Monitoring and alerting setup
- [**PRODUCTION_DEPLOYMENT_OPTIONS.md**](../docs/PRODUCTION_DEPLOYMENT_OPTIONS.md) - Cloud hosting comparison

### Subsystem Documentation
- [**ssl/README.md**](ssl/README.md) - SSL/TLS configuration
- [**backup-scripts/README.md**](backup-scripts/README.md) - Backup and recovery

## Key Features

### Security
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.2+)
- Role-based access control (RBAC)
- Row-level security (RLS) for multi-tenant isolation
- Audit logging for sensitive data access
- Automated secret rotation

### High Availability
- Multi-AZ deployment support (production)
- Automatic failover (< 2 minutes)
- Read replicas for scalability
- Health checks and auto-restart

### Backup & Recovery
- Automated daily backups
- Point-in-time recovery (5-minute granularity)
- S3/Azure cloud backup uploads
- Automated retention policy (configurable)
- Restore verification

### Monitoring & Alerting
- Prometheus metrics exporter
- Grafana dashboards
- Real-time alerts (critical/high/warning)
- Query performance tracking
- Connection pool monitoring
- Disk space alerts

## Common Operations

### Manual Backup

```bash
cd database/backup-scripts
./backup.sh
```

### Restore from Backup

```bash
# List available backups
./restore.sh --list

# Restore latest
./restore.sh --latest

# Restore specific backup
./restore.sh /backups/pfa_backup_20241125_120000.sql.gz
```

### View Logs

```bash
# Docker logs
docker-compose logs -f postgres

# PostgreSQL logs
tail -f database/logs/postgresql.log
```

### Check Database Size

```bash
psql -c "SELECT pg_size_pretty(pg_database_size('pfa_vanguard_dev'));"
```

### Monitor Active Connections

```bash
psql -c "SELECT * FROM active_connections;"
```

### Audit Recent Changes

```sql
SELECT
    event_time,
    user_name,
    event_type,
    table_name,
    record_id
FROM audit_log
WHERE event_time > NOW() - INTERVAL '24 hours'
ORDER BY event_time DESC
LIMIT 20;
```

## Environment Variables

### Required

```bash
# Database credentials
POSTGRES_DB=pfa_vanguard_dev
POSTGRES_USER=pfa_admin
POSTGRES_PASSWORD=CHANGE_ME

# Connection string
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public&sslmode=prefer
```

### Optional (Backup)

```bash
# Backup retention
BACKUP_RETENTION_DAYS=7

# S3 upload
S3_ENABLED=true
AWS_BACKUP_BUCKET=pfa-vanguard-backups
AWS_BACKUP_PREFIX=backups/dev

# Azure upload
AZURE_ENABLED=true
AZURE_STORAGE_CONTAINER=database-backups

# Notifications
NOTIFY_ON_FAILURE=true
ALERT_EMAIL_TO=devops@company.com
```

## Production Migration

### Step 1: Choose Hosting Option

See [PRODUCTION_DEPLOYMENT_OPTIONS.md](../docs/PRODUCTION_DEPLOYMENT_OPTIONS.md) for comparison.

**Recommended:** AWS RDS PostgreSQL (managed, high availability)

### Step 2: Export Development Data

```bash
cd database/backup-scripts
./backup.sh
# Creates: database/backups/pfa_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Step 3: Provision Production Database

**AWS RDS Example:**
```bash
# Using AWS Console or Terraform
# See docs/PRODUCTION_DEPLOYMENT_OPTIONS.md for detailed setup
```

### Step 4: Import Data

```bash
# Download backup to local machine
# Export production connection string
export PGHOST=production-db.xxxxx.rds.amazonaws.com
export PGPORT=5432
export PGDATABASE=pfa_vanguard_prod
export PGUSER=pfa_admin
export POSTGRES_PASSWORD=secure_password_from_secrets_manager

# Restore backup
./restore.sh /path/to/backup.sql.gz
```

### Step 5: Update Application

```bash
# Update backend/.env
DATABASE_URL=postgresql://user:password@production-db:5432/pfa_vanguard_prod?sslmode=verify-full&sslrootcert=/path/to/ca-cert.pem

# Run migrations
cd backend
npx prisma migrate deploy

# Restart application
docker-compose restart backend
```

### Step 6: Verify Production

```bash
# Check connection
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM pfa_records;"

# Verify SSL
psql "$DATABASE_URL" -c "SHOW ssl;"

# Check replication (if Multi-AZ)
psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_replication;"
```

## Security Checklist

Before deploying to production, complete the security checklist:

- [ ] Changed default PostgreSQL password
- [ ] Database in private subnet (no public IP)
- [ ] SSL/TLS enabled and enforced
- [ ] Firewall rules restrict access to application only
- [ ] Credentials stored in AWS Secrets Manager / Azure Key Vault
- [ ] Automated backups configured and tested
- [ ] Monitoring and alerting configured
- [ ] Audit logging enabled
- [ ] Row-level security (RLS) policies applied
- [ ] Quarterly password rotation scheduled
- [ ] Incident response plan documented

See [DATABASE_SECURITY.md](../docs/DATABASE_SECURITY.md) for complete checklist.

## Troubleshooting

### Database won't start

```bash
# Check logs
docker-compose logs postgres

# Common issues:
# - Port 5432 already in use
# - Insufficient disk space
# - Incorrect permissions on data directory
```

### Connection refused

```bash
# Verify database is running
docker-compose ps postgres

# Check if port is exposed
netstat -an | grep 5432

# Test connection
telnet localhost 5432
```

### SSL connection failed

```bash
# Generate new certificates
cd database/ssl
./generate-ssl-certs.sh

# Restart database
docker-compose restart postgres
```

### Backup fails

```bash
# Check disk space
df -h database/backups

# Verify credentials
echo $POSTGRES_PASSWORD

# Test manual backup
docker-compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > test.sql
```

### Performance issues

```bash
# Check active connections
psql -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Check slow queries
psql -c "SELECT * FROM slow_queries;"

# Check cache hit ratio (should be > 90%)
psql -c "SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 FROM pg_statio_user_tables;"
```

## Support

### Community Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Docker PostgreSQL Image](https://hub.docker.com/_/postgres)

### Internal Resources
- Slack: #database-help
- Wiki: https://wiki.company.com/database
- On-call: database-oncall (PagerDuty)

### Emergency Contacts
- Database Team: devops@company.com
- Security Team: security@company.com
- Emergency Hotline: 1-800-XXX-XXXX (24/7)

---

## License

Copyright © 2024 PFA Vanguard. All rights reserved.

---

**Last Updated:** 2024-11-25
**Maintainer:** DevSecOps Team
