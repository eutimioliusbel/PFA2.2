#!/bin/bash

###############################################################################
# Load Testing Suite Runner
# Executes all load tests and generates comprehensive report
###############################################################################

set -e

echo "🚀 PFA Vanguard Load Testing Suite"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:3001}"
REPORT_DIR="docs/performance"

# Check if backend is running
echo "🔍 Checking backend availability..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend not running at $BASE_URL${NC}"
    echo "   Start backend with: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Step 1: Generate test data
echo "📦 Step 1: Generating test data..."
cd "$(dirname "$0")/.."
npx tsx load-tests/generate-test-data.ts
echo -e "${GREEN}✅ Test data generated${NC}"
echo ""

# Step 2: Run permission check load test
echo "🧪 Step 2: Permission Check Load Test (200 concurrent users)..."
cd load-tests
artillery run permission-check.yml --output ../temp/output/permission-check-results.json
echo -e "${GREEN}✅ Permission check test complete${NC}"
echo ""

# Step 3: Run permission grant load test
echo "🧪 Step 3: Permission Grant Load Test (50 concurrent admins)..."
artillery run permission-grant.yml --output ../temp/output/permission-grant-results.json
echo -e "${GREEN}✅ Permission grant test complete${NC}"
echo ""

# Step 4: Run organization switch load test
echo "🧪 Step 4: Organization Switch Load Test (100 concurrent users)..."
artillery run org-switch.yml --output ../temp/output/org-switch-results.json
echo -e "${GREEN}✅ Organization switch test complete${NC}"
echo ""

# Step 5: Run database stress test
echo "🧪 Step 5: Database Stress Test (connection pool limits)..."
artillery run db-stress.yml --output ../temp/output/db-stress-results.json
echo -e "${GREEN}✅ Database stress test complete${NC}"
echo ""

# Step 6: Run memory leak detection
echo "🧪 Step 6: Memory Leak Detection (1000+ operations)..."
cd ..
npx tsx --expose-gc load-tests/memory-leak-test.ts
echo -e "${GREEN}✅ Memory leak test complete${NC}"
echo ""

# Step 7: Generate HTML reports
echo "📊 Step 7: Generating HTML reports..."
cd load-tests
artillery report ../temp/output/permission-check-results.json --output ../docs/performance/permission-check-report.html
artillery report ../temp/output/permission-grant-results.json --output ../docs/performance/permission-grant-report.html
artillery report ../temp/output/org-switch-results.json --output ../docs/performance/org-switch-report.html
artillery report ../temp/output/db-stress-results.json --output ../docs/performance/db-stress-report.html
echo -e "${GREEN}✅ HTML reports generated${NC}"
echo ""

# Step 8: Generate comprehensive summary report
echo "📝 Step 8: Generating comprehensive summary..."
cd ..
npx tsx load-tests/generate-summary-report.ts
echo -e "${GREEN}✅ Summary report generated${NC}"
echo ""

# Summary
echo "✅ All load tests complete!"
echo ""
echo "📊 Reports available at:"
echo "   - Permission Check:  $REPORT_DIR/permission-check-report.html"
echo "   - Permission Grant:  $REPORT_DIR/permission-grant-report.html"
echo "   - Org Switch:        $REPORT_DIR/org-switch-report.html"
echo "   - DB Stress:         $REPORT_DIR/db-stress-report.html"
echo "   - Memory Leak:       $REPORT_DIR/MEMORY_LEAK_TEST_REPORT.md"
echo "   - Summary:           $REPORT_DIR/LOAD_TEST_REPORT.md"
echo ""
