# Docker Setup Verification Script for Windows
# Run this after installing Docker Desktop to verify everything is working

Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Docker Setup Verification for PFA Vanguard                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allChecks = @()

# Function to add check result
function Add-Check {
    param($name, $passed, $message)
    $script:allChecks += @{Name=$name; Passed=$passed; Message=$message}
}

# Check 1: Docker installed
Write-Host "📦 Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker installed: $dockerVersion" -ForegroundColor Green
        Add-Check "Docker Installed" $true $dockerVersion
    } else {
        Write-Host "   ❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
        Write-Host "   Download: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        Add-Check "Docker Installed" $false "Docker command not found"
        exit 1
    }
} catch {
    Write-Host "   ❌ Error checking Docker: $_" -ForegroundColor Red
    Add-Check "Docker Installed" $false "Error: $_"
    exit 1
}

Write-Host ""

# Check 2: Docker Compose installed
Write-Host "📦 Checking Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker Compose installed: $composeVersion" -ForegroundColor Green
        Add-Check "Docker Compose" $true $composeVersion
    } else {
        Write-Host "   ❌ Docker Compose not found" -ForegroundColor Red
        Add-Check "Docker Compose" $false "Not installed"
    }
} catch {
    Write-Host "   ⚠️  Docker Compose not available: $_" -ForegroundColor Yellow
    Add-Check "Docker Compose" $false "Error: $_"
}

Write-Host ""

# Check 3: Docker daemon running
Write-Host "🐳 Checking Docker daemon..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker daemon is running" -ForegroundColor Green
        Add-Check "Docker Daemon" $true "Running"
    } else {
        Write-Host "   ❌ Docker daemon not running. Start Docker Desktop." -ForegroundColor Red
        Add-Check "Docker Daemon" $false "Not running"
        exit 1
    }
} catch {
    Write-Host "   ❌ Cannot connect to Docker daemon: $_" -ForegroundColor Red
    Add-Check "Docker Daemon" $false "Error: $_"
    exit 1
}

Write-Host ""

# Check 4: Test Docker with hello-world
Write-Host "🧪 Testing Docker with hello-world..." -ForegroundColor Yellow
try {
    $helloWorld = docker run --rm hello-world 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker test successful" -ForegroundColor Green
        Add-Check "Docker Test" $true "hello-world ran successfully"
    } else {
        Write-Host "   ❌ Docker test failed: $helloWorld" -ForegroundColor Red
        Add-Check "Docker Test" $false "hello-world failed"
    }
} catch {
    Write-Host "   ❌ Docker test error: $_" -ForegroundColor Red
    Add-Check "Docker Test" $false "Error: $_"
}

Write-Host ""

# Check 5: Verify docker-compose.yml exists
Write-Host "📄 Checking docker-compose.yml..." -ForegroundColor Yellow
if (Test-Path "docker-compose.yml") {
    Write-Host "   ✅ docker-compose.yml found" -ForegroundColor Green
    Add-Check "Docker Compose File" $true "File exists"
} else {
    Write-Host "   ❌ docker-compose.yml not found in current directory" -ForegroundColor Red
    Write-Host "   Make sure you're in the backend/ directory" -ForegroundColor Yellow
    Add-Check "Docker Compose File" $false "File not found"
}

Write-Host ""

# Check 6: Check for running PostgreSQL container
Write-Host "🐘 Checking PostgreSQL container..." -ForegroundColor Yellow
try {
    $containers = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
    if ($containers -and $LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL container running: $containers" -ForegroundColor Green
        Add-Check "PostgreSQL Container" $true "Running: $containers"
    } else {
        Write-Host "   ⚠️  PostgreSQL container not running" -ForegroundColor Yellow
        Write-Host "   Run: docker-compose up -d" -ForegroundColor Cyan
        Add-Check "PostgreSQL Container" $false "Not running (start with docker-compose up -d)"
    }
} catch {
    Write-Host "   ⚠️  Could not check containers: $_" -ForegroundColor Yellow
    Add-Check "PostgreSQL Container" $false "Error checking"
}

Write-Host ""

# Check 7: Test PostgreSQL connection (if running)
$containers = docker ps --filter "name=postgres" --format "{{.Names}}" 2>&1
if ($containers -and $LASTEXITCODE -eq 0) {
    Write-Host "🔌 Testing PostgreSQL connection..." -ForegroundColor Yellow
    try {
        $pgTest = docker exec $containers psql -U pfa_user -d pfa_vanguard_dev -c "\l" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ PostgreSQL connection successful" -ForegroundColor Green
            Add-Check "PostgreSQL Connection" $true "Connected"
        } else {
            Write-Host "   ❌ Cannot connect to PostgreSQL: $pgTest" -ForegroundColor Red
            Add-Check "PostgreSQL Connection" $false "Connection failed"
        }
    } catch {
        Write-Host "   ❌ PostgreSQL connection error: $_" -ForegroundColor Red
        Add-Check "PostgreSQL Connection" $false "Error: $_"
    }
    Write-Host ""
}

# Summary
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Verification Summary                                         ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$passed = ($allChecks | Where-Object { $_.Passed -eq $true }).Count
$total = $allChecks.Count

Write-Host "Checks Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })
Write-Host ""

foreach ($check in $allChecks) {
    $icon = if ($check.Passed) { "✅" } else { "❌" }
    $color = if ($check.Passed) { "Green" } else { "Red" }
    Write-Host "  $icon $($check.Name): $($check.Message)" -ForegroundColor $color
}

Write-Host ""

# Next steps
if ($passed -eq $total) {
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ All checks passed! You're ready to proceed.              ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Update DATABASE_URL in backend/.env" -ForegroundColor White
    Write-Host "      DATABASE_URL=`"postgresql://pfa_user:pfa_dev_password@localhost:5432/pfa_vanguard_dev?schema=public`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Run migrations:" -ForegroundColor White
    Write-Host "      npx prisma generate" -ForegroundColor Gray
    Write-Host "      npx prisma migrate deploy" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   3. Import data:" -ForegroundColor White
    Write-Host "      npx tsx scripts/migration/import-to-postgresql.ts scripts/migration/export-2025-11-25" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   4. Verify:" -ForegroundColor White
    Write-Host "      npx tsx scripts/migration/verify-export.ts scripts/migration/export-2025-11-25" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   5. Start backend:" -ForegroundColor White
    Write-Host "      npm run dev" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║  ⚠️  Some checks failed. Review the issues above.            ║" -ForegroundColor Yellow
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host ""

    # Specific guidance based on failures
    $dockerInstalled = ($allChecks | Where-Object { $_.Name -eq "Docker Installed" }).Passed
    $daemonRunning = ($allChecks | Where-Object { $_.Name -eq "Docker Daemon" }).Passed
    $pgRunning = ($allChecks | Where-Object { $_.Name -eq "PostgreSQL Container" }).Passed

    if (-not $dockerInstalled) {
        Write-Host "📥 Install Docker Desktop:" -ForegroundColor Cyan
        Write-Host "   1. Download: https://www.docker.com/products/docker-desktop" -ForegroundColor White
        Write-Host "   2. Run installer" -ForegroundColor White
        Write-Host "   3. Restart your computer" -ForegroundColor White
        Write-Host "   4. Run this script again" -ForegroundColor White
        Write-Host ""
    }

    if ($dockerInstalled -and -not $daemonRunning) {
        Write-Host "🐳 Start Docker Desktop:" -ForegroundColor Cyan
        Write-Host "   1. Launch Docker Desktop from Start menu" -ForegroundColor White
        Write-Host "   2. Wait for green status indicator" -ForegroundColor White
        Write-Host "   3. Run this script again" -ForegroundColor White
        Write-Host ""
    }

    if ($dockerInstalled -and $daemonRunning -and -not $pgRunning) {
        Write-Host "🐘 Start PostgreSQL:" -ForegroundColor Cyan
        Write-Host "   cd backend" -ForegroundColor White
        Write-Host "   docker-compose up -d" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host "📖 For detailed instructions, see:" -ForegroundColor Cyan
Write-Host "   docs/DOCKER_SETUP_WINDOWS.md" -ForegroundColor White
Write-Host ""
