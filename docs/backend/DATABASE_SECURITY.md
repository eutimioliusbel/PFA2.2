# PostgreSQL Database Security & Incident Response

Comprehensive security hardening guide and incident response procedures for PFA Vanguard database.

## Table of Contents
1. [Security Hardening Checklist](#security-hardening-checklist)
2. [Network Security](#network-security)
3. [Authentication & Authorization](#authentication--authorization)
4. [Data Protection](#data-protection)
5. [Audit Logging](#audit-logging)
6. [Security Monitoring](#security-monitoring)
7. [Incident Response Plan](#incident-response-plan)
8. [Security Testing](#security-testing)

---

## Security Hardening Checklist

### Pre-Deployment Checklist

**Database Configuration:**
- [ ] Change default PostgreSQL password immediately
- [ ] Disable `trust` authentication in `pg_hba.conf`
- [ ] Enforce SSL/TLS connections (`hostssl` only)
- [ ] Set `password_encryption = scram-sha-256`
- [ ] Configure connection limits (`max_connections`)
- [ ] Enable query logging (`log_statement = mod`)
- [ ] Set statement timeout (`statement_timeout = 30s`)
- [ ] Disable unnecessary extensions
- [ ] Remove default `postgres` superuser from application access

**Network Security:**
- [ ] Deploy database in private subnet (no public IP)
- [ ] Configure security groups/firewall (port 5432 only from application)
- [ ] Enable VPC flow logs for audit trail
- [ ] Use VPN or bastion host for administrative access
- [ ] Implement network segmentation (database tier isolated)
- [ ] Enable DDoS protection (AWS Shield, Cloudflare)

**Access Control:**
- [ ] Create separate database users for different roles (app, readonly, backup)
- [ ] Implement least privilege principle (GRANT specific permissions only)
- [ ] Rotate database passwords every 90 days
- [ ] Store credentials in secrets manager (never in code/config)
- [ ] Enable Row-Level Security (RLS) for multi-tenant isolation
- [ ] Audit database user permissions quarterly

**Data Protection:**
- [ ] Enable encryption at rest (AES-256)
- [ ] Enable encryption in transit (TLS 1.2+)
- [ ] Encrypt backups
- [ ] Implement data masking for sensitive fields (PII)
- [ ] Configure backup retention policy (30 days minimum)
- [ ] Test backup restore procedure monthly

**Monitoring & Alerting:**
- [ ] Enable failed authentication logging
- [ ] Set up alerts for connection pool exhaustion
- [ ] Monitor for unusual query patterns (SQL injection)
- [ ] Alert on database errors and crashes
- [ ] Track backup success/failure
- [ ] Monitor disk space usage (alert at 70%)

**Compliance:**
- [ ] Document data classification (public, internal, confidential)
- [ ] Implement audit logging for sensitive data access
- [ ] Configure log retention per compliance requirements (1 year minimum)
- [ ] Conduct quarterly security reviews
- [ ] Maintain incident response runbook

---

## Network Security

### Private Subnet Deployment

**Best Practice:** Database should NEVER be publicly accessible.

**AWS RDS Configuration:**
```terraform
# Terraform configuration
resource "aws_db_instance" "pfa_production" {
  identifier     = "pfa-production"
  engine         = "postgres"
  engine_version = "15.3"

  # Instance
  instance_class = "db.t3.medium"
  allocated_storage = 100

  # Network - CRITICAL: No public access
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false  # NEVER set to true in production!

  # Security
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn

  # Backups
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true

  # Protection
  deletion_protection = true
  skip_final_snapshot = false

  tags = {
    Environment = "production"
    Application = "pfa-vanguard"
  }
}

# Security Group - Restrict access to application only
resource "aws_security_group" "database" {
  name        = "pfa-database-sg"
  description = "Security group for PFA database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from application"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }

  egress {
    description = "Allow outbound for replication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "pfa-database-sg"
  }
}
```

### Firewall Rules (Self-Hosted)

**UFW Configuration (Ubuntu):**
```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# SSH access (from bastion host only)
ufw allow from 10.0.1.5 to any port 22

# PostgreSQL access (from application servers only)
ufw allow from 10.0.2.0/24 to any port 5432

# Enable firewall
ufw enable
```

**iptables Configuration:**
```bash
# Flush existing rules
iptables -F

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH (from bastion only)
iptables -A INPUT -p tcp -s 10.0.1.5 --dport 22 -j ACCEPT

# PostgreSQL (from application subnet only)
iptables -A INPUT -p tcp -s 10.0.2.0/24 --dport 5432 -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

### Bastion Host Access

**For administrative access, use bastion host (jump server):**

```bash
# SSH tunnel through bastion
ssh -L 5432:db-private-ip:5432 user@bastion-host

# Connect to database via tunnel
psql -h localhost -p 5432 -U admin -d pfa_vanguard_prod
```

**AWS Systems Manager Session Manager (Preferred - No SSH Keys):**
```bash
# Start session
aws ssm start-session --target i-bastion-instance-id

# Port forward to database
aws ssm start-session \
  --target i-bastion-instance-id \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["db-private-ip"],"portNumber":["5432"],"localPortNumber":["5432"]}'
```

---

## Authentication & Authorization

### Connection Methods

**❌ NEVER Use:**
```conf
# pg_hba.conf - INSECURE!
host    all    all    0.0.0.0/0    trust    # NO PASSWORD REQUIRED!
host    all    all    0.0.0.0/0    md5      # Weak encryption
```

**✅ ALWAYS Use:**
```conf
# pg_hba.conf - SECURE
# Require SSL and strong password encryption
hostssl all all 0.0.0.0/0 scram-sha-256

# Or even better: Certificate authentication
hostssl all all 0.0.0.0/0 cert clientcert=verify-full
```

### Role-Based Access Control (RBAC)

**Create Separate Roles for Different Access Levels:**

```sql
-- ============================================================================
-- APPLICATION ROLE (Read-Write)
-- ============================================================================
CREATE ROLE pfa_application;
GRANT CONNECT ON DATABASE pfa_vanguard_prod TO pfa_application;
GRANT USAGE ON SCHEMA public TO pfa_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pfa_application;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pfa_application;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM pfa_application;
REVOKE DROP, TRUNCATE ON ALL TABLES IN SCHEMA public FROM pfa_application;

-- Create application user
CREATE USER pfa_app WITH PASSWORD 'secure_password_from_secrets_manager';
GRANT pfa_application TO pfa_app;

-- ============================================================================
-- READ-ONLY ROLE (Analytics/Reporting)
-- ============================================================================
CREATE ROLE pfa_readonly;
GRANT CONNECT ON DATABASE pfa_vanguard_prod TO pfa_readonly;
GRANT USAGE ON SCHEMA public TO pfa_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pfa_readonly;

-- Apply to future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pfa_readonly;

-- Create readonly user
CREATE USER pfa_reporting WITH PASSWORD 'secure_password';
GRANT pfa_readonly TO pfa_reporting;

-- ============================================================================
-- BACKUP ROLE (pg_dump only)
-- ============================================================================
CREATE ROLE pfa_backup;
GRANT CONNECT ON DATABASE pfa_vanguard_prod TO pfa_backup;
GRANT USAGE ON SCHEMA public TO pfa_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pfa_backup;

CREATE USER pfa_backup_user WITH PASSWORD 'secure_password';
GRANT pfa_backup TO pfa_backup_user;

-- ============================================================================
-- ADMIN ROLE (Database Administration)
-- ============================================================================
CREATE ROLE pfa_admin WITH LOGIN SUPERUSER PASSWORD 'extremely_secure_password';

-- Limit admin connections
ALTER ROLE pfa_admin CONNECTION LIMIT 2;
```

### Row-Level Security (Multi-Tenant Isolation)

**Ensure organizations cannot access each other's data:**

```sql
-- Enable RLS on pfa_records table
ALTER TABLE pfa_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their organization's data
CREATE POLICY pfa_records_isolation ON pfa_records
    FOR ALL
    TO pfa_application
    USING (organization_id = current_setting('app.current_organization_id', true)::TEXT);

-- Application must set organization context
-- In application code (Node.js/Prisma):
await prisma.$executeRaw`SET app.current_organization_id = ${organizationId}`;

-- Verify RLS is working
-- User should NOT see other organizations' data
SELECT * FROM pfa_records WHERE organization_id != current_setting('app.current_organization_id', true);
-- Result: 0 rows (even though data exists)
```

---

## Data Protection

### Encryption at Rest

**AWS RDS:**
```terraform
resource "aws_db_instance" "pfa_production" {
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn
}

# KMS Key for database encryption
resource "aws_kms_key" "database" {
  description             = "PFA Vanguard database encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "pfa-database-key"
  }
}
```

**Self-Hosted (LUKS):**
```bash
# Encrypt disk volume
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb pfa_encrypted
mkfs.ext4 /dev/mapper/pfa_encrypted
mount /dev/mapper/pfa_encrypted /var/lib/postgresql/data
```

### Encryption in Transit

**Enforce SSL in postgresql.conf:**
```conf
ssl = on
ssl_cert_file = '/var/lib/postgresql/server.crt'
ssl_key_file = '/var/lib/postgresql/server.key'
ssl_ca_file = '/var/lib/postgresql/ca-cert.pem'
ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'
ssl_prefer_server_ciphers = on
ssl_min_protocol_version = 'TLSv1.2'
```

**Require SSL in pg_hba.conf:**
```conf
# Reject non-SSL connections
hostnossl all all 0.0.0.0/0 reject

# Only allow SSL connections
hostssl all all 0.0.0.0/0 scram-sha-256
```

**Verify SSL in application:**
```typescript
// Prisma connection string
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca-cert.pem

// Connection test
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem').toString(),
  },
});

await client.connect();
const result = await client.query('SELECT ssl_is_used()');
console.log('SSL Enabled:', result.rows[0].ssl_is_used); // Should be true
```

### Data Masking (Sensitive Fields)

**Mask PII in logs and non-production environments:**

```sql
-- Create function to mask email addresses
CREATE OR REPLACE FUNCTION mask_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(email, '(.{2})(.*)(@.*)', '\1***\3');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for reporting (masked data)
CREATE VIEW users_masked AS
SELECT
  id,
  username,
  mask_email(email) AS email,
  role,
  created_at
FROM users;

GRANT SELECT ON users_masked TO pfa_readonly;
REVOKE SELECT ON users FROM pfa_readonly;
```

---

## Audit Logging

### PostgreSQL Logging Configuration

**postgresql.conf:**
```conf
# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000  # Log queries > 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = on
log_line_prefix = '%m [%p] %u@%d %h '
log_statement = 'mod'  # Log INSERT, UPDATE, DELETE, TRUNCATE
log_timezone = 'UTC'

# Security
log_error_verbosity = default
log_min_error_statement = error
```

### Application-Level Audit Trail

**Track sensitive data changes:**

```sql
-- Audit log table (created in 01-init-security.sql)
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_name TEXT NOT NULL,
    database_name TEXT NOT NULL,
    client_addr INET,
    application_name TEXT,
    event_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_values JSONB,
    new_values JSONB,
    query TEXT
);

-- Trigger function for automatic auditing
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        user_name,
        database_name,
        event_type,
        table_name,
        record_id,
        old_values,
        new_values
    ) VALUES (
        current_user,
        current_database(),
        TG_OP,
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
            ELSE NEW.id::TEXT
        END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to sensitive tables
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_api_configurations
    AFTER INSERT OR UPDATE OR DELETE ON api_configurations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Query audit log
SELECT
    event_time,
    user_name,
    event_type,
    table_name,
    record_id,
    new_values->>'username' AS modified_username
FROM audit_log
WHERE table_name = 'users'
  AND event_time > NOW() - INTERVAL '24 hours'
ORDER BY event_time DESC;
```

### Log Shipping to SIEM

**Export logs to centralized security monitoring:**

```bash
# Ship PostgreSQL logs to AWS CloudWatch
aws logs create-log-group --log-group-name /aws/rds/pfa-production/postgresql

# Or ship to Datadog
# Install Datadog agent and configure:
# /etc/datadog-agent/conf.d/postgres.d/conf.yaml

# Or ship to Splunk/ELK
# Configure log forwarding in postgresql.conf
```

---

## Security Monitoring

### Real-Time Security Alerts

**Failed Authentication Attempts:**
```promql
# Prometheus alert
- alert: HighFailedLoginAttempts
  expr: |
    rate(pg_stat_database_conflicts{conflict_type="auth"}[5m]) > 10
  for: 5m
  labels:
    severity: high
  annotations:
    summary: "High rate of failed authentication attempts"
    description: "{{ $value }} failed logins per second detected"
```

**Unusual Query Patterns (SQL Injection Attempt):**
```sql
-- Monitor for suspicious queries in pg_stat_statements
SELECT
    queryid,
    query,
    calls,
    mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%union%select%'
   OR query ILIKE '%drop%table%'
   OR query ILIKE '%exec(%'
   OR query ILIKE '%1=1%'
ORDER BY calls DESC;
```

**Connection Spike (DDoS Attempt):**
```promql
- alert: ConnectionSpike
  expr: |
    rate(pg_stat_database_numbackends[5m]) >
    avg_over_time(pg_stat_database_numbackends[1h]) * 3
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Database connection spike detected"
    description: "Connection rate 3x above normal average"
```

---

## Incident Response Plan

### Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P1 - Critical** | Database down or data breach | 15 minutes | Database offline, credentials leaked, data exfiltration |
| **P2 - High** | Degraded performance or security risk | 1 hour | Connection pool exhausted, failed backups, unusual access |
| **P3 - Medium** | Minor security issue | 4 hours | Audit log anomaly, configuration drift |
| **P4 - Low** | Informational | Next business day | Password expiring soon, disk space warning |

### Incident Response Procedures

#### Scenario 1: Database Credentials Compromised

**Detection:**
- Secrets scanner alert in CI/CD
- Unusual database access from unexpected IP
- CloudTrail shows unauthorized Secrets Manager access

**Immediate Response (< 15 minutes):**
```bash
# 1. REVOKE compromised credentials immediately
psql -h DB_HOST -U postgres -c "ALTER USER compromised_user WITH PASSWORD 'REVOKED';"
psql -h DB_HOST -U postgres -c "REVOKE ALL PRIVILEGES ON DATABASE pfa_vanguard_prod FROM compromised_user;"

# 2. Terminate all active connections from compromised user
psql -h DB_HOST -U postgres <<EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE usename = 'compromised_user';
EOF

# 3. Generate new credentials
NEW_PASSWORD=$(openssl rand -base64 32)
psql -h DB_HOST -U postgres -c "ALTER USER pfa_app WITH PASSWORD '$NEW_PASSWORD';"

# 4. Update credentials in Secrets Manager
aws secretsmanager update-secret \
  --secret-id pfa-vanguard/production/database/app_password \
  --secret-string "$NEW_PASSWORD"

# 5. Rolling restart of application (pick up new credentials)
kubectl rollout restart deployment pfa-backend
# OR
aws ecs update-service --cluster pfa-prod --service pfa-backend --force-new-deployment
```

**Investigation (< 1 hour):**
```sql
-- Audit database access from compromised credentials
SELECT
    event_time,
    user_name,
    client_addr,
    query
FROM audit_log
WHERE user_name = 'compromised_user'
  AND event_time > NOW() - INTERVAL '7 days'
ORDER BY event_time DESC;

-- Check for data exfiltration (large SELECT queries)
SELECT
    query,
    calls,
    rows,
    total_exec_time
FROM pg_stat_statements
WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = 'compromised_user')
  AND query ILIKE '%select%'
ORDER BY rows DESC;
```

**Notification:**
- Security team
- Compliance officer (if PII accessed)
- Management
- Affected customers (if GDPR applies)

**Post-Incident:**
- Document incident in security log
- Review how credentials were leaked
- Implement preventive controls (git-secrets, pre-commit hooks)
- Schedule secret rotation audit

---

#### Scenario 2: SQL Injection Attack Detected

**Detection:**
- WAF alert on suspicious payloads
- Unusual query patterns in pg_stat_statements
- Application error logs show SQL errors

**Immediate Response (< 15 minutes):**
```bash
# 1. Block attacker IP at firewall/WAF level
aws wafv2 update-ip-set \
  --name pfa-blocklist \
  --id XXX \
  --addresses 1.2.3.4/32

# 2. Enable query logging temporarily for forensics
psql -c "ALTER SYSTEM SET log_statement = 'all';"
psql -c "SELECT pg_reload_conf();"

# 3. Review recent queries for attack signatures
tail -f /var/log/postgresql/postgresql.log | grep -E "union|drop|exec|1=1"
```

**Investigation:**
```sql
-- Find injection attempts in pg_stat_statements
SELECT
    queryid,
    query,
    calls,
    mean_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%union%select%'
   OR query ILIKE '%or%1=1%'
   OR query ILIKE '%drop%table%'
ORDER BY last_exec DESC
LIMIT 20;

-- Check if any unauthorized data was accessed
SELECT
    event_time,
    user_name,
    client_addr,
    query
FROM audit_log
WHERE query ILIKE '%union%'
   OR query ILIKE '%drop%'
ORDER BY event_time DESC;
```

**Remediation:**
- Patch vulnerable application code (use parameterized queries!)
- Deploy updated application immediately
- Review all database queries for SQL injection vulnerabilities
- Implement prepared statements and ORM safeguards

**Post-Incident:**
- Conduct code review of all database queries
- Add Web Application Firewall (WAF) rules
- Implement input validation
- Schedule penetration testing

---

#### Scenario 3: Database Ransomware Attack

**Detection:**
- Tables encrypted or deleted
- Ransom note in database
- Backup deletion attempts

**Immediate Response (< 15 minutes):**
```bash
# 1. IMMEDIATELY take database offline (prevent further damage)
aws rds stop-db-instance --db-instance-identifier pfa-production

# 2. Isolate compromised servers (network quarantine)
aws ec2 modify-instance-attribute \
  --instance-id i-compromised \
  --groups sg-quarantine

# 3. DO NOT pay ransom!

# 4. Assess damage
psql -c "\dt" # List tables (check for encryption/deletion)
```

**Recovery (< 1 hour):**
```bash
# 1. Provision new database instance
aws rds create-db-instance --db-instance-identifier pfa-production-recovery ...

# 2. Restore from last known good backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier pfa-production-recovery \
  --db-snapshot-identifier pfa-production-snapshot-20241125

# 3. Verify data integrity
psql -h NEW_DB_HOST -c "SELECT COUNT(*) FROM pfa_records;"
psql -h NEW_DB_HOST -c "SELECT COUNT(*) FROM users;"

# 4. Point application to new database
kubectl set env deployment/pfa-backend DATABASE_URL="postgresql://..."

# 5. Destroy compromised database (after forensics)
aws rds delete-db-instance --db-instance-identifier pfa-production --skip-final-snapshot
```

**Forensics:**
- Contact AWS security team
- Analyze CloudTrail logs for attack vector
- Review IAM access logs
- Check for privilege escalation

**Post-Incident:**
- Implement immutable backups (write-once, read-many)
- Enable MFA delete on S3 backup buckets
- Review IAM permissions (principle of least privilege)
- Conduct security audit
- Notify law enforcement if applicable

---

## Security Testing

### Pre-Deployment Security Checklist

**Run before every production deployment:**

```bash
# 1. Check for hardcoded secrets
git secrets --scan

# 2. Scan for SQL injection vulnerabilities
sqlmap -u "https://api.pfa-vanguard.com/api/pfa?id=1" --batch

# 3. Test SSL/TLS configuration
testssl.sh db.pfa-vanguard.com:5432

# 4. Verify firewall rules
nmap -p 5432 db.pfa-vanguard.com  # Should timeout (port closed)

# 5. Test authentication
psql -h DB_HOST -U test_user -d postgres  # Should require password and SSL

# 6. Check for default credentials
psql -h DB_HOST -U postgres -d postgres  # Should fail

# 7. Verify backup integrity
./database/backup-scripts/restore.sh --latest  # Restore to test database
```

### Quarterly Security Audit

**Conduct every 90 days:**

1. **Access Review**
   ```sql
   -- List all database users and roles
   \du

   -- Review user permissions
   SELECT
       grantee,
       privilege_type,
       table_schema,
       table_name
   FROM information_schema.role_table_grants
   WHERE grantee NOT IN ('postgres', 'rdsadmin')
   ORDER BY grantee, table_name;
   ```

2. **Password Rotation**
   - Rotate all database passwords
   - Update secrets in Secrets Manager
   - Document rotation in audit log

3. **Log Review**
   - Review failed authentication attempts
   - Analyze slow query log for suspicious patterns
   - Check for privilege escalation attempts

4. **Vulnerability Scanning**
   - Run Nessus/OpenVAS scan against database
   - Review CVE database for PostgreSQL vulnerabilities
   - Apply security patches

5. **Backup Testing**
   - Restore backup to isolated environment
   - Verify data integrity
   - Test disaster recovery procedures

---

## Security Resources

- [PostgreSQL Security Documentation](https://www.postgresql.org/docs/current/security.html)
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
- [CIS PostgreSQL Benchmark](https://www.cisecurity.org/benchmark/postgresql)
- [AWS RDS Security Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.Security.html)

---

## Contact Information

**Security Team:**
- Email: security@company.com
- Slack: #security-incidents
- PagerDuty: security-oncall

**Database Team:**
- Email: devops@company.com
- Slack: #database-alerts
- PagerDuty: database-oncall

**Emergency Hotline:** 1-800-XXX-XXXX (24/7)

---

**Document Version:** 1.0
**Last Updated:** 2024-11-25
**Next Security Audit:** 2025-02-25
**Document Owner:** DevSecOps Team
