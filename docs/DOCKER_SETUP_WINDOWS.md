# Docker Desktop Setup for Windows

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: Step-by-step guide for installing Docker Desktop on Windows and verifying PostgreSQL setup.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Verification](#verification)
4. [Starting PostgreSQL](#starting-postgresql)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum Requirements**:
- Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
- Or Windows 11 64-bit: Home, Pro, Enterprise, or Education
- Hardware virtualization enabled in BIOS
- 4GB RAM (8GB+ recommended)
- 20GB free disk space

**WSL 2 Backend** (Recommended):
- Windows Subsystem for Linux 2 (WSL 2) installed
- Provides better performance than Hyper-V

### Check Your Windows Version

```powershell
# Run in PowerShell
winver
```

Look for:
- Windows 10: Build 19041 or higher
- Windows 11: Any build

---

## Installation Steps

### Step 1: Download Docker Desktop

**Option A: Official Website**
1. Visit: https://www.docker.com/products/docker-desktop
2. Click "Download for Windows"
3. Save `Docker Desktop Installer.exe` to your Downloads folder

**Option B: Direct Link**
- Download: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

**File Size**: ~500 MB

---

### Step 2: Install Docker Desktop

1. **Run the Installer**:
   - Double-click `Docker Desktop Installer.exe`
   - If prompted by User Account Control, click "Yes"

2. **Configuration Options**:
   - ✅ **Use WSL 2 instead of Hyper-V** (recommended)
   - ✅ **Add shortcut to desktop** (optional)
   - Click "OK" to proceed

3. **Installation Progress**:
   - Wait for installation to complete (5-10 minutes)
   - Installer will extract files and configure Docker

4. **Restart Required**:
   - Click "Close and restart" when prompted
   - Your computer will restart to apply changes

---

### Step 3: Initial Setup (After Restart)

1. **Launch Docker Desktop**:
   - Docker Desktop should start automatically after restart
   - Or click the Docker Desktop icon on your desktop/Start menu

2. **Accept Terms**:
   - Read and accept Docker Subscription Service Agreement
   - Click "Accept"

3. **Setup WSL 2** (if not already installed):
   - Docker may prompt to install WSL 2
   - Click "Install" and follow prompts
   - This may require another restart

4. **Docker Desktop Starting**:
   - Wait for "Docker Desktop is starting..." to complete
   - You'll see a green status indicator when ready
   - This can take 2-5 minutes on first start

5. **Skip Sign-In** (Optional):
   - Docker will ask you to sign in or create an account
   - You can click "Continue without signing in" for local development
   - Signing in is optional and not required for our use case

---

## Verification

### Verify Docker Installation

**Open PowerShell or Command Prompt** and run:

```powershell
# Check Docker version
docker --version

# Expected output:
# Docker version 24.0.7, build afdd53b
```

```powershell
# Check Docker Compose version
docker-compose --version

# Expected output:
# Docker Compose version v2.23.0
```

```powershell
# Test Docker is working
docker run hello-world

# Expected output:
# Hello from Docker!
# This message shows that your installation appears to be working correctly.
```

**If all commands succeed**: ✅ Docker is installed correctly!

---

### Verify WSL 2 Backend

```powershell
# Check WSL version
wsl --list --verbose

# Expected output should show Docker-related distributions:
# NAME                   STATE           VERSION
# * docker-desktop       Running         2
#   docker-desktop-data  Running         2
```

---

## Starting PostgreSQL

### Navigate to Project Directory

```powershell
# Change to your project backend folder
cd C:\Projects\PFA2.2\backend
```

### Start PostgreSQL Container

```powershell
# Start PostgreSQL and pgAdmin in detached mode
docker-compose up -d

# Expected output:
# Creating network "backend_default" with the default driver
# Creating volume "backend_postgres_data" with default driver
# Creating backend_postgres_1 ... done
# Creating backend_pgadmin_1  ... done
```

**What This Does**:
- Pulls PostgreSQL 15-alpine image (if not already downloaded)
- Pulls pgAdmin 4 image (if not already downloaded)
- Creates a Docker network for containers
- Creates a persistent volume for PostgreSQL data
- Starts both containers in the background

**First Run**: Download may take 2-5 minutes (pulls ~200 MB of images)

---

### Verify Containers Are Running

```powershell
# List running containers
docker ps

# Expected output (2 containers):
# CONTAINER ID   IMAGE                    STATUS         PORTS                    NAMES
# abc123def456   postgres:15-alpine       Up 30 seconds  0.0.0.0:5432->5432/tcp   backend_postgres_1
# def456abc789   dpage/pgadmin4:latest    Up 30 seconds  0.0.0.0:5050->80/tcp     backend_pgadmin_1
```

**Key Indicators**:
- ✅ **STATUS**: Should say "Up X seconds" or "Up X minutes"
- ✅ **PORTS**: PostgreSQL on 5432, pgAdmin on 5050

---

### Check Container Logs

```powershell
# View PostgreSQL logs (Ctrl+C to exit)
docker-compose logs -f postgres

# Expected output should include:
# database system is ready to accept connections
```

**If you see "ready to accept connections"**: ✅ PostgreSQL is running correctly!

---

### Test PostgreSQL Connection

```powershell
# Connect to PostgreSQL using Docker exec
docker exec -it backend_postgres_1 psql -U pfa_user -d pfa_vanguard_dev

# If successful, you'll see:
# psql (15.4)
# pfa_vanguard_dev=#
```

**Inside psql prompt**, test basic commands:

```sql
-- List databases
\l

-- List tables (should be empty initially)
\dt

-- Exit psql
\q
```

---

### Access pgAdmin Web Interface

1. **Open Browser**: Navigate to http://localhost:5050
2. **Login Credentials**:
   - Email: `admin@pfa.local`
   - Password: `admin`
3. **Add PostgreSQL Server**:
   - Right-click "Servers" → Register → Server
   - **General Tab**:
     - Name: `PFA Vanguard Dev`
   - **Connection Tab**:
     - Host: `postgres` (container name)
     - Port: `5432`
     - Database: `pfa_vanguard_dev`
     - Username: `pfa_user`
     - Password: `pfa_dev_password`
     - Save password: ✅ Yes
   - Click "Save"

4. **Verify Connection**:
   - Expand: Servers → PFA Vanguard Dev → Databases → pfa_vanguard_dev
   - You should see the database structure (empty initially)

---

## Troubleshooting

### Issue 1: "Docker Desktop starting..." takes forever

**Symptoms**: Docker Desktop stuck on "starting" for 10+ minutes

**Solutions**:
1. **Check WSL 2**:
   ```powershell
   wsl --status
   # If WSL is not running, restart it:
   wsl --shutdown
   # Then restart Docker Desktop
   ```

2. **Restart Docker Desktop**:
   - Right-click Docker tray icon → Quit Docker Desktop
   - Wait 10 seconds
   - Launch Docker Desktop again

3. **Check Virtualization**:
   - Open Task Manager → Performance tab
   - Check if "Virtualization: Enabled"
   - If disabled, enable in BIOS

---

### Issue 2: "Cannot connect to Docker daemon"

**Symptoms**: `docker` commands fail with "Cannot connect to Docker daemon"

**Solutions**:
1. **Ensure Docker Desktop is Running**:
   - Look for Docker whale icon in system tray
   - Should be green/blue, not red

2. **Restart Docker Service**:
   - Right-click Docker tray icon → Restart

3. **Check Docker Settings**:
   - Right-click Docker tray icon → Settings
   - Ensure "Use the WSL 2 based engine" is checked
   - Click "Apply & Restart"

---

### Issue 3: Port 5432 or 5050 already in use

**Symptoms**:
```
Error: bind: address already in use
```

**Solutions**:

**Option A: Stop Conflicting Service**

```powershell
# Find process using port 5432
netstat -ano | findstr :5432

# Kill process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

**Option B: Change Docker Port**

Edit `backend/docker-compose.yml`:

```yaml
# Change PostgreSQL port
postgres:
  ports:
    - "15432:5432"  # Changed from 5432:5432

# Then update DATABASE_URL in .env:
DATABASE_URL="postgresql://pfa_user:pfa_dev_password@localhost:15432/pfa_vanguard_dev"
```

---

### Issue 4: Container starts but immediately exits

**Symptoms**: `docker ps` shows no containers, but `docker ps -a` shows exited containers

**Solutions**:

1. **Check Container Logs**:
   ```powershell
   docker logs backend_postgres_1
   ```

2. **Common Issues**:
   - **Missing environment variables**: Check `docker-compose.yml` has `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - **Volume permission issues**: Delete volume and recreate:
     ```powershell
     docker-compose down -v
     docker-compose up -d
     ```

---

### Issue 5: "WSL 2 installation is incomplete"

**Symptoms**: Docker Desktop shows error about WSL 2

**Solutions**:

1. **Install WSL 2 Kernel Update**:
   - Download: https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi
   - Run installer
   - Restart Docker Desktop

2. **Set WSL 2 as Default**:
   ```powershell
   wsl --set-default-version 2
   ```

3. **Install a Linux Distribution** (Optional but recommended):
   ```powershell
   wsl --install -d Ubuntu
   ```

---

## Docker Desktop Settings (Optional Optimizations)

### Recommended Settings

**Right-click Docker tray icon → Settings**:

1. **General**:
   - ✅ Use the WSL 2 based engine
   - ✅ Start Docker Desktop when you log in (optional)
   - ❌ Send usage statistics (optional - can disable for privacy)

2. **Resources**:
   - **Memory**: 4 GB minimum (8 GB recommended)
   - **Disk image size**: 60 GB (default is fine)
   - **CPUs**: 2 minimum (4 recommended)

3. **Docker Engine** (Advanced):
   - Default settings are fine for our use case

4. **Apply & Restart** after changes

---

## Useful Docker Commands

### Managing Containers

```powershell
# Start containers
docker-compose up -d

# Stop containers (preserves data)
docker-compose stop

# Start stopped containers
docker-compose start

# Restart containers
docker-compose restart

# Stop and remove containers (preserves data in volumes)
docker-compose down

# Stop and remove containers + volumes (⚠️ deletes data)
docker-compose down -v

# View logs (all containers)
docker-compose logs -f

# View logs (specific container)
docker-compose logs -f postgres
```

---

### Managing Images

```powershell
# List downloaded images
docker images

# Remove unused images
docker image prune

# Pull latest PostgreSQL image
docker pull postgres:15-alpine
```

---

### Managing Volumes

```powershell
# List volumes
docker volume ls

# Inspect volume
docker volume inspect backend_postgres_data

# Remove unused volumes
docker volume prune
```

---

### Container Shell Access

```powershell
# Access PostgreSQL shell
docker exec -it backend_postgres_1 psql -U pfa_user -d pfa_vanguard_dev

# Access container bash shell
docker exec -it backend_postgres_1 sh

# Copy file from container
docker cp backend_postgres_1:/var/lib/postgresql/data/postgresql.conf ./

# Copy file to container
docker cp ./custom.conf backend_postgres_1:/tmp/
```

---

## Next Steps

Once Docker Desktop is installed and PostgreSQL is running:

1. **✅ Verify Installation**: All verification steps pass
2. **✅ PostgreSQL Running**: Container shows "Up" status
3. **✅ Connection Works**: Can connect via psql or pgAdmin

**Proceed to Phase 1 Implementation**:
- Follow: `docs/implementation/PHASE1-IMPLEMENTATION-SUMMARY.md`
- Or: `docs/implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md`

---

## Related Documentation

- [Phase 1 Implementation Summary](./implementation/PHASE1-IMPLEMENTATION-SUMMARY.md)
- [Implementation Plan](./implementation/IMPLEMENTATION-PLAN-MIRROR-DELTA.md)
- [Migration Guide](../backend/scripts/migration/MIGRATION_GUIDE.md)
- [Database Architecture](../backend/DATABASE_ARCHITECTURE.md)

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-25 | Initial Docker Desktop setup guide for Windows | Claude Code |

---

**Document Version:** 1.0
**Last Updated:** 2025-11-25
**Maintained By:** PFA Vanguard Project Team

**Questions?** See [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
