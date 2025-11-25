# PostgreSQL Backup & Restore Scripts

Automated backup and restore system for PFA Vanguard PostgreSQL database.

## Features

### Backup Script (`backup.sh`)
- **Automated Scheduling**: Daily backups via cron
- **Compression**: Gzip compression for space efficiency
- **Cloud Storage**: Upload to AWS S3 or Azure Blob Storage
- **Retention Policy**: Automatic cleanup of old backups
- **Verification**: Integrity checks after each backup
- **Notifications**: Email/Slack alerts on failure

### Restore Script (`restore.sh`)
- **Multiple Sources**: Restore from local, S3, or Azure
- **Safety Checks**: Pre-restore confirmation and validation
- **Pre-Restore Backup**: Automatic backup before restore
- **Connection Management**: Terminates active connections
- **Verification**: Post-restore integrity checks

## Quick Start

### Run Manual Backup

```bash
# Development (Docker)
docker-compose exec postgres /scripts/backup.sh

# Production (direct)
cd /path/to/PFA2.2/database/backup-scripts
./backup.sh
```

### List Available Backups

```bash
./restore.sh --list
```

### Restore Latest Backup

```bash
./restore.sh --latest
```

### Restore Specific Backup

```bash
./restore.sh /backups/pfa_backup_20241125_120000.sql.gz
```

## Setup

### 1. Configure Environment Variables

```bash
# .env file
POSTGRES_DB=pfa_vanguard_dev
POSTGRES_USER=pfa_admin
POSTGRES_PASSWORD=your_secure_password
BACKUP_RETENTION_DAYS=7

# Optional: S3 backup
S3_ENABLED=true
AWS_BACKUP_BUCKET=pfa-vanguard-backups
AWS_BACKUP_PREFIX=backups/dev

# Optional: Azure backup
AZURE_ENABLED=true
AZURE_STORAGE_CONTAINER=database-backups

# Optional: Notifications
NOTIFY_ON_FAILURE=true
ALERT_EMAIL_FROM=alerts@pfa.com
ALERT_EMAIL_TO=devops@pfa.com
```

### 2. Schedule Automated Backups

**Using Docker (docker-compose.yml already configured):**
```bash
# Backup service runs daily at 2 AM
docker-compose up -d postgres-backup
```

**Using Cron (Self-Hosted):**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /path/to/PFA2.2/database/backup-scripts/backup.sh >> /var/log/pfa-backup.log 2>&1

# Weekly backup at midnight Sunday
0 0 * * 0 /path/to/PFA2.2/database/backup-scripts/backup.sh

# Hourly backup (production critical systems)
0 * * * * /path/to/PFA2.2/database/backup-scripts/backup.sh
```

### 3. Set File Permissions

```bash
chmod +x backup.sh restore.sh
chmod 700 backup.sh restore.sh  # Only owner can execute
```

## Backup Strategy

### Development Environment

**Frequency**: Daily
**Retention**: 7 days
**Storage**: Local disk only
**Verification**: Automated

```bash
# .env.development
BACKUP_RETENTION_DAYS=7
S3_ENABLED=false
AZURE_ENABLED=false
```

### Staging Environment

**Frequency**: Daily
**Retention**: 14 days
**Storage**: Local + S3 (Standard-IA tier)
**Verification**: Automated + weekly restore test

```bash
# .env.staging
BACKUP_RETENTION_DAYS=14
S3_ENABLED=true
AWS_BACKUP_BUCKET=pfa-staging-backups
NOTIFY_ON_FAILURE=true
```

### Production Environment

**Frequency**:
- Full backup: Daily at 2 AM
- Point-in-time: WAL archiving (continuous)
- Snapshot: Weekly

**Retention**:
- Daily backups: 30 days
- Weekly backups: 90 days
- Monthly backups: 1 year

**Storage**: Local + S3 (cross-region replication) + Glacier for long-term

**Verification**: Automated + daily restore test to isolated environment

```bash
# .env.production
BACKUP_RETENTION_DAYS=30
S3_ENABLED=true
AWS_BACKUP_BUCKET=pfa-prod-backups
AWS_BACKUP_REGION=us-east-1
NOTIFY_ON_SUCCESS=false
NOTIFY_ON_FAILURE=true
ALERT_EMAIL_TO=devops-oncall@company.com
```

## Disaster Recovery Procedures

### Scenario 1: Accidental Data Deletion

**Recovery Time Objective (RTO)**: 15 minutes
**Recovery Point Objective (RPO)**: Last backup (24 hours max)

```bash
# 1. Identify backup timestamp before deletion
./restore.sh --list

# 2. Restore specific backup
./restore.sh /backups/pfa_backup_20241125_100000.sql.gz

# 3. Verify data integrity
psql -c "SELECT COUNT(*) FROM pfa_records;"
```

### Scenario 2: Database Corruption

**RTO**: 30 minutes
**RPO**: Last backup + WAL replay

```bash
# 1. Stop application to prevent writes
docker-compose stop backend

# 2. Restore from latest backup
./restore.sh --latest

# 3. Replay WAL logs (if WAL archiving enabled)
# See PostgreSQL Point-In-Time Recovery (PITR) documentation

# 4. Verify database health
psql -c "SELECT pg_size_pretty(pg_database_size('pfa_vanguard_prod'));"

# 5. Restart application
docker-compose start backend
```

### Scenario 3: Complete Database Loss

**RTO**: 1 hour
**RPO**: Last backup + WAL replay

```bash
# 1. Provision new PostgreSQL instance
# (AWS RDS, Docker, or manual installation)

# 2. Download backup from S3
aws s3 cp s3://pfa-prod-backups/backups/latest.sql.gz /tmp/restore.sql.gz

# 3. Restore database
export PGHOST=new-db-host.rds.amazonaws.com
export PGPASSWORD=new_password
./restore.sh /tmp/restore.sql.gz

# 4. Update application connection strings
# 5. Restart application and verify
```

### Scenario 4: Region-Wide Outage

**RTO**: 4 hours
**RPO**: Last cross-region replicated backup

```bash
# 1. Provision database in secondary region
# 2. Restore from cross-region S3 backup
aws s3 cp s3://pfa-prod-backups-dr/backups/latest.sql.gz /tmp/restore.sql.gz

# 3. Update DNS to point to new region
# 4. Restore and verify
./restore.sh /tmp/restore.sql.gz
```

## Point-In-Time Recovery (PITR)

For production environments, enable PostgreSQL WAL archiving for continuous backup.

### Enable WAL Archiving

**PostgreSQL Configuration (`postgresql.conf`):**
```conf
# Enable WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backups/wal/%f && cp %p /backups/wal/%f'
archive_timeout = 300  # Archive every 5 minutes

# WAL retention
wal_keep_size = 1GB
max_wal_senders = 3
```

**Upload WAL to S3:**
```bash
archive_command = 'aws s3 cp %p s3://pfa-wal-archive/%f'
```

### Perform PITR Restore

```bash
# 1. Restore base backup
./restore.sh /backups/pfa_backup_20241125_020000.sql.gz

# 2. Create recovery.conf
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://pfa-wal-archive/%f %p'
recovery_target_time = '2024-11-25 10:30:00'
EOF

# 3. Restart PostgreSQL
pg_ctl restart

# 4. PostgreSQL will replay WAL logs until target time
# 5. Promote when ready
pg_ctl promote
```

## Backup Verification

### Automated Daily Verification

```bash
# verify-backup.sh
#!/bin/bash
LATEST_BACKUP=$(find /backups -name "pfa_backup_*.sql.gz" | sort -r | head -1)

# Test restore to temporary database
export PGDATABASE=pfa_test_restore
export REQUIRE_CONFIRMATION=false
./restore.sh "$LATEST_BACKUP"

# Run validation queries
psql -d pfa_test_restore -c "SELECT COUNT(*) FROM pfa_records;" || exit 1
psql -d pfa_test_restore -c "SELECT COUNT(*) FROM users;" || exit 1

# Cleanup
psql -d postgres -c "DROP DATABASE pfa_test_restore;"

echo "✅ Backup verification passed"
```

**Schedule:**
```bash
# Daily at 3 AM (after backup completes)
0 3 * * * /path/to/verify-backup.sh >> /var/log/backup-verify.log 2>&1
```

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Backup Success Rate**: Should be 100%
2. **Backup Duration**: Track trends, alert on significant increase
3. **Backup Size**: Monitor growth, alert on unexpected changes
4. **Time Since Last Backup**: Alert if > 26 hours
5. **Restore Test Success**: Weekly restore test should pass

### Grafana Dashboard Queries

**Backup Age (Prometheus):**
```promql
time() - pfa_last_backup_timestamp_seconds
```

**Backup Size:**
```promql
pfa_backup_size_bytes
```

**Backup Duration:**
```promql
pfa_backup_duration_seconds
```

### CloudWatch Alarms (AWS)

```bash
# Create alarm for backup failures
aws cloudwatch put-metric-alarm \
  --alarm-name pfa-backup-failure \
  --metric-name BackupSuccess \
  --namespace PFA/Database \
  --statistic Sum \
  --period 86400 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:pfa-alerts
```

## Troubleshooting

### Backup Fails: "Disk Full"

**Diagnosis:**
```bash
df -h /backups
du -sh /backups/*
```

**Solution:**
```bash
# Delete old backups manually
find /backups -name "*.sql.gz" -mtime +7 -delete

# Or adjust retention policy
export BACKUP_RETENTION_DAYS=3
./backup.sh
```

### Backup Fails: "Connection Refused"

**Diagnosis:**
```bash
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT 1"
```

**Solution:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check network connectivity
ping $PGHOST
telnet $PGHOST $PGPORT

# Check authentication
cat ~/.pgpass
```

### Restore Fails: "Role Does Not Exist"

**Error:**
```
ERROR:  role "old_username" does not exist
```

**Solution:**
```bash
# Use --no-owner flag in backup (already default in script)
# Or create missing roles before restore
psql -c "CREATE ROLE old_username;"
```

### Restore Fails: "Database Already Exists"

**Solution:**
```bash
# Drop and recreate database
psql -d postgres -c "DROP DATABASE pfa_vanguard_dev;"
psql -d postgres -c "CREATE DATABASE pfa_vanguard_dev;"
./restore.sh /path/to/backup.sql.gz
```

## Best Practices

### Security
- ✅ Store backups encrypted (S3 server-side encryption, Azure encryption)
- ✅ Use separate IAM roles for backup and restore
- ✅ Restrict access to backup files (chmod 600)
- ✅ Audit backup access logs
- ✅ Test restore procedure quarterly

### Performance
- ✅ Schedule backups during low-traffic hours (2-4 AM)
- ✅ Use compression (gzip level 6 for balance of speed/size)
- ✅ Monitor backup duration, alert on significant increases
- ✅ Consider parallel backup for very large databases

### Reliability
- ✅ Store backups in multiple locations (local + S3 + cross-region)
- ✅ Verify every backup automatically
- ✅ Test restore procedure regularly (weekly minimum)
- ✅ Document disaster recovery procedures
- ✅ Maintain runbook for on-call engineers

## Advanced Configuration

### Parallel Backup (Large Databases)

```bash
# Use pg_dump with --jobs flag
pg_dump --format=directory --jobs=4 --file=/backups/parallel_backup
```

### Incremental Backup (pg_basebackup)

```bash
# Base backup
pg_basebackup -D /backups/base -Ft -z -P

# WAL archiving handles incremental changes
```

### Backup Encryption

```bash
# Encrypt backup with GPG
pg_dump ... | gzip | gpg --encrypt --recipient devops@company.com > backup.sql.gz.gpg

# Decrypt for restore
gpg --decrypt backup.sql.gz.gpg | gunzip | psql ...
```

## Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS RDS Automated Backups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)
- [Point-In-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)

---

**Last Updated:** 2024-11-25
**Maintainer:** DevSecOps Team
