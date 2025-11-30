# Docker Setup Guide: Development Environment

> **ADR-007 Task 1.4**: Containerized PostgreSQL + Redis for consistent development environments

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Services Overview](#services-overview)
3. [Environment Configuration](#environment-configuration)
4. [Common Operations](#common-operations)
5. [Troubleshooting](#troubleshooting)
6. [Production Considerations](#production-considerations)

---

## Quick Start

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
  - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Mac: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Linux: `sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin`

- **Minimum Resources**:
  - 4 GB RAM available for Docker
  - 10 GB disk space

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url>
cd PFA2.2

# Copy environment template
cp backend/.env.example backend/.env

# Edit backend/.env and set required secrets:
# - POSTGRES_PASSWORD (strong password, min 16 chars)
# - REDIS_PASSWORD (strong password, min 16 chars)
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - ENCRYPTION_KEY (generate with: openssl rand -hex 32)
```

### 2. Start Services

```bash
# Start PostgreSQL + Redis in background
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Initialize Database

```bash
# Navigate to backend directory
cd backend

# Run Prisma migrations
npx prisma migrate dev

# Seed initial data (optional)
npx prisma db seed
```

### 4. Verify Setup

```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U pfa_admin -d pfa_vanguard_dev -c "\dt"

# Test Redis connection
docker-compose exec redis redis-cli -a redis_dev_password ping
# Should return: PONG

# Test backend connection (from backend directory)
npx tsx scripts/check-bronze-tables.ts
```

---

## Services Overview

### PostgreSQL (pfa-postgres)

**Image**: `postgres:15-alpine`
**Port**: `5432` (localhost only)
**Container Name**: `pfa-postgres`

**Purpose**: Primary database for PFA Vanguard application

**Features**:
- **Performance Tuning**: Optimized for 1M+ record datasets
  - `shared_buffers=256MB` - Cache frequently accessed data
  - `effective_cache_size=1GB` - Query planner hint
  - `work_mem=2621kB` - Per-operation memory
  - `max_connections=100` - Connection limit

- **Security**:
  - SSL enabled (self-signed cert for dev)
  - SCRAM-SHA-256 authentication
  - Connection/disconnection logging
  - Statement logging (DDL/DML only)

- **High Availability**:
  - Health checks every 10s
  - Auto-restart on failure
  - WAL archiving (1GB-4GB)

**Volumes**:
- `postgres_data`: Persistent database files
- `./database/init-scripts`: Initialization SQL scripts (executed once)
- `./database/backups`: Automated backup storage
- `./database/logs`: PostgreSQL logs

### Redis (pfa-redis)

**Image**: `redis:7-alpine`
**Port**: `6379` (localhost only)
**Container Name**: `pfa-redis`

**Purpose**: Caching, session management, and job queues

**Features**:
- **Persistence**: AOF (Append-Only File) enabled
  - `appendfsync everysec` - Write every second
  - Safe for crashes/restarts

- **Memory Management**:
  - Max memory: 512MB
  - Eviction policy: `allkeys-lru` (least recently used)

- **Security**:
  - Password authentication required
  - Localhost-only access

**Volumes**:
- `redis_data`: Persistent Redis data (AOF file)

### PgAdmin (pfa-pgadmin) - Optional

**Image**: `dpage/pgadmin4:latest`
**Port**: `5050` (localhost only)
**Container Name**: `pfa-pgadmin`

**Purpose**: Web-based database administration tool

**Usage**:
```bash
# Start PgAdmin with profile
docker-compose --profile admin up -d pgadmin

# Access at: http://localhost:5050
# Login: admin@pfa.local
# Password: <from PGADMIN_PASSWORD in .env>

# Add server in PgAdmin:
# - Host: postgres (use container name, not localhost)
# - Port: 5432
# - Username: pfa_admin
# - Password: <from POSTGRES_PASSWORD in .env>
```

### Postgres Backup (pfa-postgres-backup) - Automated Backups

**Image**: `postgres:15-alpine`
**Container Name**: `pfa-postgres-backup`

**Purpose**: Automated daily backups at 2 AM

**Features**:
- Runs `pg_dump` daily
- Retains last 7 days of backups
- Stored in `./database/backups`

**Manual Backup**:
```bash
# Trigger manual backup
docker-compose exec postgres-backup /scripts/backup.sh
```

---

## Environment Configuration

### Required Environment Variables

**Database** (`.env` file in `backend/`):
```bash
# PostgreSQL
DATABASE_URL="postgresql://pfa_admin:<password>@localhost:5432/pfa_vanguard_dev"
POSTGRES_USER="pfa_admin"
POSTGRES_PASSWORD="<strong-password-16chars>"
POSTGRES_DB="pfa_vanguard_dev"

# Redis
REDIS_URL="redis://:<password>@localhost:6379"
REDIS_PASSWORD="<strong-password-16chars>"

# Security
JWT_SECRET="<generate-with: openssl rand -base64 32>"
ENCRYPTION_KEY="<generate-with: openssl rand -hex 32>"
```

### Optional Environment Variables

**PgAdmin**:
```bash
PGADMIN_EMAIL="admin@pfa.local"
PGADMIN_PASSWORD="<strong-password>"
```

**Backup Configuration**:
```bash
BACKUP_RETENTION_DAYS=7  # Days to keep backups
```

### Docker Compose Overrides

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.9'

services:
  postgres:
    ports:
      - "5433:5432"  # Different port to avoid conflicts

  redis:
    command:
      - "redis-server"
      - "--maxmemory"
      - "1gb"  # Increase memory limit
```

---

## Common Operations

### Starting/Stopping Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d postgres

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ DELETES DATA)
docker-compose down -v
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 redis
```

### Database Migrations

```bash
# Run pending migrations
cd backend
npx prisma migrate dev

# Create new migration
npx prisma migrate dev --name add_new_feature

# Reset database (⚠️ DELETES DATA)
npx prisma migrate reset
```

### Redis Operations

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a redis_dev_password

# Common commands:
# PING              - Test connection
# KEYS *            - List all keys
# GET key           - Get value
# FLUSHALL          - Clear all data (⚠️)
# INFO              - Redis info
# MONITOR           - Watch commands in real-time
```

### PostgreSQL Operations

```bash
# Connect to PostgreSQL CLI
docker-compose exec postgres psql -U pfa_admin -d pfa_vanguard_dev

# Common commands:
# \dt               - List tables
# \d table_name     - Describe table
# \l                - List databases
# \du               - List users
# \q                - Quit

# Execute SQL file
docker-compose exec -T postgres psql -U pfa_admin -d pfa_vanguard_dev < script.sql
```

### Backups & Restore

**Manual Backup**:
```bash
# Backup to file
docker-compose exec -T postgres pg_dump -U pfa_admin pfa_vanguard_dev > backup_$(date +%Y%m%d).sql

# Backup with compression
docker-compose exec -T postgres pg_dump -U pfa_admin pfa_vanguard_dev | gzip > backup_$(date +%Y%m%d).sql.gz
```

**Restore from Backup**:
```bash
# Restore from SQL file
docker-compose exec -T postgres psql -U pfa_admin -d pfa_vanguard_dev < backup_20251128.sql

# Restore from compressed file
gunzip -c backup_20251128.sql.gz | docker-compose exec -T postgres psql -U pfa_admin -d pfa_vanguard_dev
```

### Health Checks

```bash
# Check service health
docker-compose ps

# Manual health check - PostgreSQL
docker-compose exec postgres pg_isready -U pfa_admin

# Manual health check - Redis
docker-compose exec redis redis-cli -a redis_dev_password ping
```

---

## Troubleshooting

### Port Already in Use

**Error**: `Bind for 0.0.0.0:5432 failed: port is already allocated`

**Solution**:
```bash
# Option 1: Stop conflicting service
# Windows: Stop PostgreSQL service in Services
# Mac/Linux: sudo systemctl stop postgresql

# Option 2: Change port in docker-compose.override.yml
version: '3.9'
services:
  postgres:
    ports:
      - "5433:5432"

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://pfa_admin:password@localhost:5433/pfa_vanguard_dev"
```

### Container Won't Start

**Error**: Container exits immediately

**Solution**:
```bash
# Check logs for error details
docker-compose logs postgres

# Common fixes:
# 1. Invalid password format (special chars need escaping in .env)
# 2. Corrupted volume (remove and recreate)
docker-compose down -v
docker-compose up -d

# 3. Permission issues (Linux)
sudo chown -R $(whoami):$(whoami) ./database
```

### Database Connection Failed

**Error**: `ECONNREFUSED` or `Connection refused`

**Solution**:
```bash
# 1. Verify container is running
docker-compose ps

# 2. Check health status
docker-compose exec postgres pg_isready -U pfa_admin

# 3. Verify port mapping
docker-compose port postgres 5432

# 4. Test connection from host
psql -h localhost -U pfa_admin -d pfa_vanguard_dev

# 5. Check DATABASE_URL in .env matches container config
```

### Redis AUTH Failed

**Error**: `NOAUTH Authentication required`

**Solution**:
```bash
# Verify REDIS_PASSWORD in .env matches docker-compose.yml
# Connect with password:
docker-compose exec redis redis-cli -a <your-redis-password>
```

### Out of Disk Space

**Error**: `No space left on device`

**Solution**:
```bash
# Check Docker disk usage
docker system df

# Prune unused images/containers
docker system prune -a

# Remove specific volumes
docker volume ls
docker volume rm <volume-name>
```

### Slow Query Performance

**Solution**:
```bash
# 1. Check PostgreSQL resource allocation
docker stats pfa-postgres

# 2. Increase shared_buffers in docker-compose.yml (line 68)
- "shared_buffers=512MB"  # Increase from 256MB

# 3. Analyze slow queries
docker-compose exec postgres psql -U pfa_admin -d pfa_vanguard_dev
\x
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Production Considerations

### Security Hardening

1. **Change Default Passwords**:
   - Generate strong passwords (32+ chars, alphanumeric + symbols)
   - Store in secrets manager (AWS Secrets Manager, Azure Key Vault)

2. **Enable SSL/TLS**:
   - Replace self-signed certs with CA-signed certificates
   - Update `docker-compose.yml`:
     ```yaml
     volumes:
       - ./certs/server.crt:/var/lib/postgresql/server.crt:ro
       - ./certs/server.key:/var/lib/postgresql/server.key:ro
     ```

3. **Network Isolation**:
   - Remove port mappings (keep services internal only)
   - Use Docker networks for inter-service communication
   - Add reverse proxy (Nginx, Traefik) for external access

4. **Resource Limits**:
   - Set CPU/memory limits in `docker-compose.yml` (already configured)
   - Monitor resource usage: `docker stats`

### High Availability

1. **PostgreSQL Replication**:
   - Set up primary-replica architecture
   - Use streaming replication
   - Configure automatic failover (Patroni, Stolon)

2. **Redis Clustering**:
   - Use Redis Sentinel for automatic failover
   - Or Redis Cluster for horizontal scaling

3. **Backup Strategy**:
   - Daily automated backups (already configured)
   - Offsite backup storage (AWS S3, Azure Blob)
   - Test restore procedure quarterly

### Monitoring

1. **Health Checks**:
   - Integrate with monitoring tools (Prometheus, Datadog)
   - Alert on service failures

2. **Logs**:
   - Centralized log aggregation (ELK, Splunk)
   - Rotate logs (configured: 10MB max, 3 files)

3. **Metrics**:
   - Track query performance
   - Monitor connection pools
   - Cache hit rates (Redis)

### Scaling

1. **Vertical Scaling**:
   - Increase container resources in `docker-compose.yml`
   - Adjust PostgreSQL config (`shared_buffers`, `max_connections`)

2. **Horizontal Scaling**:
   - Read replicas for PostgreSQL
   - Redis read replicas or clustering
   - Load balancer (HAProxy, Nginx)

---

## Development Workflow

### Team Onboarding

```bash
# 1. Developer clones repo
git clone <repo-url>
cd PFA2.2

# 2. Copy environment template
cp backend/.env.example backend/.env

# 3. Team lead shares passwords securely
# - POSTGRES_PASSWORD
# - REDIS_PASSWORD
# - JWT_SECRET
# - ENCRYPTION_KEY

# 4. Start services
docker-compose up -d

# 5. Initialize database
cd backend
npx prisma migrate dev

# 6. Verify setup
npx tsx scripts/check-bronze-tables.ts
```

### Daily Development

```bash
# Start day
docker-compose up -d

# Work on features
# (containers keep running)

# End day (optional - containers auto-restart on reboot)
docker-compose stop
```

### Testing

```bash
# Run backend tests with Docker services
cd backend
npm test

# Run E2E tests (requires services running)
npm run test:e2e
```

---

## Migration from Local PostgreSQL

If you have an existing local PostgreSQL installation:

### Option 1: Migrate Data

```bash
# 1. Backup existing database
pg_dump -U postgres -d pfa_vanguard > backup.sql

# 2. Start Docker PostgreSQL
docker-compose up -d postgres

# 3. Restore to Docker PostgreSQL
cat backup.sql | docker-compose exec -T postgres psql -U pfa_admin -d pfa_vanguard_dev
```

### Option 2: Keep Both (Different Ports)

```bash
# Local PostgreSQL: Keep on port 5432
# Docker PostgreSQL: Use port 5433

# In docker-compose.override.yml:
version: '3.9'
services:
  postgres:
    ports:
      - "5433:5432"

# Update .env:
DATABASE_URL="postgresql://pfa_admin:password@localhost:5433/pfa_vanguard_dev"
```

---

## Reference

**Docker Compose File**: `docker-compose.yml` (root directory)
**Environment Template**: `backend/.env.example`
**Migration Scripts**: `backend/prisma/migrations/`
**Backup Scripts**: `database/backup-scripts/` (optional, create if needed)

**Related Documentation**:
- [DATABASE_SCHEMA_V2.md](./DATABASE_SCHEMA_V2.md) - Database schema overview
- [AI_DATA_HOOKS.md](./AI_DATA_HOOKS.md) - AI intelligence layer
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete system architecture

---

**Generated**: 2025-11-28
**ADR**: ADR-007 API Connectivity & Intelligence Layer
**Phase**: Phase 1 - Task 1.4 (Docker Compose Setup)
**Status**: ✅ Complete
