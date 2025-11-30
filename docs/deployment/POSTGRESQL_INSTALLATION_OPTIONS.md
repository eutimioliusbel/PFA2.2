# PostgreSQL Installation Options for Windows

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: Comprehensive guide to PostgreSQL installation options for PFA Vanguard development on Windows.

---

## Table of Contents

1. [Quick Comparison](#quick-comparison)
2. [Option 1: Docker Desktop (Recommended)](#option-1-docker-desktop-recommended)
3. [Option 2: Native PostgreSQL on Windows](#option-2-native-postgresql-on-windows)
4. [Option 3: WSL 2 + PostgreSQL](#option-3-wsl-2--postgresql)
5. [Option 4: Cloud PostgreSQL](#option-4-cloud-postgresql)
6. [Which Option Should You Choose?](#which-option-should-you-choose)

---

## Quick Comparison

| Option | Setup Time | Pros | Cons | Best For |
|--------|------------|------|------|----------|
| **Docker Desktop** | 30 min | Isolated, reproducible, pgAdmin included | Requires WSL 2, uses more RAM | **Development (Recommended)** |
| **Native Windows** | 15 min | Simple, no Docker, lower RAM | Manual configuration, harder to reset | Quick testing |
| **WSL 2 + PostgreSQL** | 20 min | Linux-native, fast, lower RAM | Command-line setup, no GUI | Linux-familiar developers |
| **Cloud (Supabase)** | 5 min | Zero local setup, managed backups | Requires internet, monthly cost | Remote development |

---

## Option 1: Docker Desktop (Recommended)

### Why Docker?

✅ **Isolation**: Separate from system PostgreSQL
✅ **Reproducibility**: Same setup across all developers
✅ **Easy Reset**: Delete and recreate in seconds
✅ **pgAdmin Included**: Web-based database management
✅ **Production-Like**: Mirrors cloud deployment

### Setup Time: 30 minutes

### Prerequisites

- Windows 10 Pro/Enterprise/Education (Build 19041+) or Windows 11
- 8GB RAM (minimum 4GB)
- 20GB free disk space
- Administrator access

### Installation Steps

**See detailed guide**: `docs/DOCKER_SETUP_WINDOWS.md`

**Quick Setup**:
```powershell
# 1. Download Docker Desktop
# Visit: https://www.docker.com/products/docker-desktop

# 2. Install and restart computer

# 3. Start PostgreSQL
cd C:\Projects\PFA2.2\backend
docker-compose up -d

# 4. Verify
docker ps
```

### Connection Details

```env
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public"
```

**pgAdmin**: http://localhost:5050 (admin@pfa.local / admin)

---

## Option 2: Native PostgreSQL on Windows

### Why Native?

✅ **Simple**: No Docker required
✅ **Fast Setup**: 15 minutes
✅ **Lower RAM**: ~200MB vs ~2GB for Docker
✅ **Windows Service**: Starts automatically

❌ **Manual Config**: Need to configure security manually
❌ **Harder Reset**: Can't easily destroy and recreate
❌ **System-Wide**: Shares with other PostgreSQL apps

### Setup Time: 15 minutes

### Installation Steps

#### 1. Download PostgreSQL

**Official Installer**:
- Visit: https://www.postgresql.org/download/windows/
- Download: PostgreSQL 15.x (Windows x86-64)
- File size: ~250 MB

**Direct Link**:
- https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe

#### 2. Run Installer

1. **Launch Installer**:
   - Double-click downloaded `.exe`
   - Click "Yes" on UAC prompt

2. **Installation Directory**:
   - Default: `C:\Program Files\PostgreSQL\15`
   - Click "Next"

3. **Components** (Select all):
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4
   - ✅ Stack Builder
   - ✅ Command Line Tools
   - Click "Next"

4. **Data Directory**:
   - Default: `C:\Program Files\PostgreSQL\15\data`
   - Click "Next"

5. **Password** (IMPORTANT):
   - Enter password for `postgres` superuser
   - **Recommended**: `pfa_dev_password` (for consistency)
   - Confirm password
   - Click "Next"

6. **Port**:
   - Default: `5432`
   - Click "Next"

7. **Locale**:
   - Default: `[Default locale]`
   - Click "Next"

8. **Pre-Installation Summary**:
   - Review settings
   - Click "Next"

9. **Installation**:
   - Wait 5-10 minutes
   - Click "Finish"

#### 3. Create Database and User

**Open psql (PostgreSQL SQL Shell)**:

```sql
-- Connect as postgres superuser
-- Password: (the one you set during installation)

-- Create database
CREATE DATABASE pfa_vanguard_dev;

-- Create user
CREATE USER pfa_user WITH PASSWORD 'pfa_dev_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard_dev TO pfa_user;

-- Connect to database
\c pfa_vanguard_dev

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO pfa_user;

-- Exit
\q
```

#### 4. Update .env File

```env
# Native PostgreSQL connection
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public"
```

#### 5. Verify Installation

```powershell
# Test connection
psql -U pfa_user -d pfa_vanguard_dev -h localhost

# Password: pfa_dev_password

# Inside psql:
\l          # List databases
\dt         # List tables (empty)
\q          # Exit
```

### pgAdmin Access

**Installed with PostgreSQL**:
- Open: Start Menu → pgAdmin 4
- Add Server:
  - Name: `PFA Vanguard Dev`
  - Host: `localhost`
  - Port: `5432`
  - Database: `pfa_vanguard_dev`
  - Username: `pfa_user`
  - Password: `pfa_dev_password`

### Pros & Cons

**Pros**:
- ✅ Quick installation (15 minutes)
- ✅ No Docker required
- ✅ Lower memory usage (~200MB)
- ✅ Starts automatically on boot
- ✅ pgAdmin 4 included

**Cons**:
- ❌ System-wide installation (affects other apps)
- ❌ Manual configuration required
- ❌ Harder to reset/clean database
- ❌ Not containerized (less reproducible)

---

## Option 3: WSL 2 + PostgreSQL

### Why WSL 2?

✅ **Linux-Native**: True Linux PostgreSQL
✅ **Fast**: Better performance than Docker Desktop
✅ **Lower RAM**: ~300MB vs ~2GB
✅ **Learning**: Good for Linux familiarity

❌ **Command-Line**: No GUI by default
❌ **WSL Setup**: Requires WSL 2 installation
❌ **Manual Config**: More setup steps

### Setup Time: 20 minutes

### Installation Steps

#### 1. Install WSL 2

```powershell
# Run as Administrator
wsl --install -d Ubuntu

# Restart computer

# After restart, Ubuntu terminal opens
# Set username and password
```

#### 2. Install PostgreSQL in WSL

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start PostgreSQL service
sudo service postgresql start

# Check status
sudo service postgresql status
# Should show: "online"
```

#### 3. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Inside psql:
-- Create database
CREATE DATABASE pfa_vanguard_dev;

-- Create user
CREATE USER pfa_user WITH PASSWORD 'pfa_dev_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pfa_vanguard_dev TO pfa_user;

-- Configure for external connections
ALTER USER pfa_user WITH SUPERUSER;

-- Exit
\q

# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and change:
# listen_addresses = 'localhost'  →  listen_addresses = '*'

# Edit pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add line at the end:
# host    all             all             0.0.0.0/0               md5

# Restart PostgreSQL
sudo service postgresql restart
```

#### 4. Get WSL IP Address

```bash
# Get WSL IP
ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1

# Example output: 172.18.123.45
```

#### 5. Update .env File

```env
# WSL PostgreSQL connection (replace with your WSL IP)
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@172.18.123.45:5432/pfa_vanguard_dev?schema=public"
```

#### 6. Verify Connection (from Windows)

```powershell
# Test from Windows PowerShell
cd C:\Projects\PFA2.2\backend
npx prisma db pull
```

### Auto-Start PostgreSQL on WSL Boot

Create startup script:

```bash
# Create script
sudo nano /usr/local/bin/start-postgres.sh

# Add content:
#!/bin/bash
sudo service postgresql start

# Make executable
sudo chmod +x /usr/local/bin/start-postgres.sh

# Add to Windows startup (optional)
# Create shortcut: wsl -e /usr/local/bin/start-postgres.sh
```

### Pros & Cons

**Pros**:
- ✅ True Linux PostgreSQL (better performance)
- ✅ Lower memory usage (~300MB)
- ✅ Fast startup (<1 second)
- ✅ Good for Linux learning

**Cons**:
- ❌ Requires WSL 2 installation
- ❌ Command-line only (no GUI)
- ❌ Manual network configuration
- ❌ WSL IP can change on restart

---

## Option 4: Cloud PostgreSQL

### Why Cloud?

✅ **Zero Setup**: No local installation
✅ **Managed**: Automatic backups, updates
✅ **Accessible**: Work from anywhere
✅ **Scalable**: Upgrade easily

❌ **Cost**: $25+/month
❌ **Internet Required**: Can't work offline
❌ **Latency**: Slower than local

### Setup Time: 5 minutes

### Recommended Providers

#### Supabase (Recommended)

**Free Tier**:
- 500MB database
- Unlimited API requests
- Social OAuth
- Realtime subscriptions

**Paid Tier** ($25/month):
- 8GB database
- Daily backups
- Point-in-time recovery
- Custom domains

**Setup**:

1. **Sign Up**: https://supabase.com
2. **Create Project**:
   - Project name: `pfa-vanguard-dev`
   - Database password: Generate strong password
   - Region: Choose closest to you
3. **Get Connection String**:
   - Project Settings → Database
   - Connection String → URI
4. **Update .env**:
   ```env
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

#### Heroku Postgres

**Free Tier**:
- 10,000 rows (limited)
- 20 connections
- Auto-backups (7 days)

**Paid Tier** ($9/month):
- 10M rows
- 120 connections
- Continuous backups

**Setup**: https://devcenter.heroku.com/articles/heroku-postgresql

#### Neon (Serverless)

**Free Tier**:
- 3GB storage
- Unlimited compute hours
- Instant branching

**Paid Tier** ($19/month):
- 200GB storage
- Multiple branches

**Setup**: https://neon.tech

---

## Which Option Should You Choose?

### For Development (Recommended)

**Choose Docker Desktop** if:
- ✅ You want the most reproducible setup
- ✅ You're okay with 30-minute setup
- ✅ You have 8GB+ RAM
- ✅ You want pgAdmin included
- ✅ You want production-like environment

**Choose Native PostgreSQL** if:
- ✅ You want quick setup (15 minutes)
- ✅ You don't want Docker
- ✅ You have <8GB RAM
- ✅ You're okay with manual configuration

**Choose WSL 2 + PostgreSQL** if:
- ✅ You're comfortable with Linux
- ✅ You want best performance
- ✅ You want lower memory usage
- ✅ You don't need a GUI

### For Testing

**Choose Cloud PostgreSQL** if:
- ✅ You want zero local setup
- ✅ You have good internet
- ✅ You're okay with monthly cost
- ✅ You want to test from multiple devices

---

## Decision Matrix

| Requirement | Docker | Native | WSL 2 | Cloud |
|-------------|--------|--------|-------|-------|
| Quick setup (<20 min) | ❌ | ✅ | ✅ | ✅ |
| Easy to reset | ✅ | ❌ | ⚠️ | ✅ |
| Low RAM (<1GB) | ❌ | ✅ | ✅ | ✅ |
| GUI included | ✅ | ✅ | ❌ | ✅ |
| Production-like | ✅ | ⚠️ | ✅ | ✅ |
| Offline work | ✅ | ✅ | ✅ | ❌ |
| Zero cost | ✅ | ✅ | ✅ | ⚠️ |
| Reproducible | ✅ | ❌ | ⚠️ | ✅ |

**Legend**: ✅ Yes, ❌ No, ⚠️ Partial

---

## Installation Time Comparison

| Option | Download | Install | Configure | Total |
|--------|----------|---------|-----------|-------|
| Docker Desktop | 5 min | 15 min | 10 min | **30 min** |
| Native PostgreSQL | 3 min | 10 min | 2 min | **15 min** |
| WSL 2 + PostgreSQL | 5 min | 10 min | 5 min | **20 min** |
| Cloud (Supabase) | 0 min | 0 min | 5 min | **5 min** |

---

## Recommendation by Use Case

### Scenario 1: Solo Developer on Laptop

**Best Choice**: Native PostgreSQL or WSL 2
- Lower RAM usage
- Faster startup
- Simpler setup

### Scenario 2: Team Development

**Best Choice**: Docker Desktop
- Consistent across team
- Easy onboarding for new developers
- Matches production environment

### Scenario 3: Low-End Machine (<8GB RAM)

**Best Choice**: WSL 2 + PostgreSQL or Native
- Minimal memory footprint
- No Docker overhead

### Scenario 4: Quick Testing/Demo

**Best Choice**: Cloud (Supabase Free Tier)
- Instant setup
- No local resources
- Easy to share

### Scenario 5: Production Migration Testing

**Best Choice**: Docker Desktop
- Matches cloud deployment
- Test full migration process
- Easy to destroy and recreate

---

## Migration Between Options

### From Docker → Native

```powershell
# 1. Export from Docker
docker exec backend_postgres_1 pg_dump -U pfa_user pfa_vanguard_dev > backup.sql

# 2. Install native PostgreSQL

# 3. Import to native
psql -U pfa_user -d pfa_vanguard_dev -h localhost -f backup.sql
```

### From Native → Docker

```powershell
# 1. Export from native
pg_dump -U pfa_user -d pfa_vanguard_dev -h localhost > backup.sql

# 2. Start Docker
docker-compose up -d

# 3. Import to Docker
docker exec -i backend_postgres_1 psql -U pfa_user pfa_vanguard_dev < backup.sql
```

---

## Related Documentation

- [Docker Setup Guide](./DOCKER_SETUP_WINDOWS.md) - Detailed Docker Desktop instructions
- [Implementation Plan](./implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md) - Phase 1 roadmap
- [What's Next](../WHATS_NEXT.md) - Quick-start guide

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-25 | Initial PostgreSQL installation options guide | Claude Code |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Maintained By:** PFA Vanguard Project Team

**Questions?** See [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
