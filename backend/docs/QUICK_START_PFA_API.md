# Quick Start: PFA Data API

**5-Minute Guide to Using the Live Merge API**

---

## Prerequisites

1. **Backend running**:
```bash
cd backend
npm run dev
```

2. **Database populated**: Run Phase 2 sync to populate `pfa_mirror` table
3. **User account**: Default admin user (`admin` / `admin123`)

---

## Step 1: Login & Get Token

```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "username": "admin",
    "organizationIds": ["org-uuid-1", "org-uuid-2"]
  }
}
```

**Save the token** for subsequent requests!

---

## Step 2: Get Your Organization ID

```bash
curl -X GET "http://localhost:3001/api/organizations" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Response**:
```json
{
  "success": true,
  "organizations": [
    {
      "id": "org-uuid-1",
      "code": "HOLNG",
      "name": "HOLNG Project"
    }
  ]
}
```

**Save the `id`** for API calls!

---

## Step 3: Get Merged PFA Data

### Basic Query

```bash
TOKEN="<YOUR_TOKEN>"
ORG_ID="<YOUR_ORG_ID>"

curl -X GET "http://localhost:3001/api/pfa/${ORG_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Filtered Query

```bash
# Get all Cranes that are Rentals
curl -X GET "http://localhost:3001/api/pfa/${ORG_ID}?category=Crane&source=Rental" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Paginated Query

```bash
# Get page 1 with 50 records per page
curl -X GET "http://localhost:3001/api/pfa/${ORG_ID}?page=1&pageSize=50" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "mirror-uuid",
      "pfaId": "PFA-001",
      "data": {
        "pfaId": "PFA-001",
        "category": "Crane",
        "source": "Rental",
        "monthlyRate": 5000,
        "forecastStart": "2025-12-01",
        "forecastEnd": "2025-12-31"
      },
      "syncState": "pristine"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalRecords": 150,
    "totalPages": 3
  }
}
```

---

## Step 4: Save Draft Modification

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/draft" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session-001",
    "modifications": [
      {
        "pfaId": "PFA-001",
        "delta": {
          "forecastStart": "2025-12-15",
          "monthlyRate": 5500
        },
        "changeReason": "Weather delay"
      }
    ]
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Saved 1 modifications",
  "sessionId": "my-session-001",
  "saved": [
    {
      "pfaId": "PFA-001",
      "modificationId": "mod-uuid",
      "version": 1
    }
  ]
}
```

---

## Step 5: View Merged Data (with Draft)

```bash
# Get data - now includes your draft modification
curl -X GET "http://localhost:3001/api/pfa/${ORG_ID}?syncState=draft" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response** (notice modified values):
```json
{
  "data": [
    {
      "pfaId": "PFA-001",
      "data": {
        "forecastStart": "2025-12-15",  // Modified ✓
        "monthlyRate": 5500,            // Modified ✓
        "forecastEnd": "2025-12-31"     // Original (unchanged)
      },
      "syncState": "draft",
      "modifiedAt": "2025-11-25T10:30:00Z"
    }
  ]
}
```

---

## Step 6: Commit or Discard

### Option A: Commit Draft

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/commit" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session-001"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Committed 1 modifications",
  "committedCount": 1,
  "note": "Write sync to PEMS will be implemented in Phase 4"
}
```

### Option B: Discard Draft

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/discard" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session-001"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Discarded 1 draft modifications",
  "discardedCount": 1
}
```

---

## Step 7: Get KPI Statistics

```bash
curl -X GET "http://localhost:3001/api/pfa/${ORG_ID}/stats" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_records": 150,
    "actualized_count": 45,
    "discontinued_count": 10,
    "draft_count": 5,
    "total_monthly_rental": 125000,
    "total_purchase_cost": 450000,
    "category_breakdown": {
      "Crane": 35,
      "Excavator": 28,
      "Loader": 15
    }
  }
}
```

---

## Common Filters

### Category Filter

```bash
?category=Crane
?category=Crane,Excavator  # Multiple values
```

### Date Range Filter

```bash
?dateRangeStart=2025-12-01&dateRangeEnd=2025-12-31
```

### Source Filter

```bash
?source=Rental
?source=Purchase
```

### DOR Filter

```bash
?dor=BEO
?dor=PROJECT
```

### Status Flags

```bash
?isActualized=true   # Only actualized records
?isActualized=false  # Only forecast records
?isDiscontinued=false  # Exclude discontinued
```

### Sync State Filter

```bash
?syncState=draft      # Only draft modifications
?syncState=pristine   # Only unmodified records
```

### Full-Text Search

```bash
?searchText=tower crane
```

### Sorting

```bash
?sortBy=forecastStart&sortOrder=asc
?sortBy=category&sortOrder=desc
```

---

## Error Handling

### 401 Unauthorized

**Cause**: Missing or invalid JWT token

**Solution**: Login again and get fresh token

### 403 Forbidden

**Cause**: User doesn't have access to organization

**Solution**: Check `organizationIds` in user profile

### 404 Not Found

**Cause**: No records found or invalid endpoint

**Solution**: Verify organization has data (run Phase 2 sync)

### 500 Internal Server Error

**Cause**: Database or server error

**Solution**: Check backend logs: `backend/logs/combined.log`

---

## Automated Testing

```bash
cd backend/scripts
chmod +x test-pfa-api.sh

# Edit ORG_ID in script
nano test-pfa-api.sh

# Run tests
./test-pfa-api.sh
```

**Expected Output**:
```
✓ Login successful
✓ GET successful - Found 150 records
✓ Draft saved - 1 modifications
✓ Found 1 draft records
✓ Stats retrieved - Total records: 150
✓ Discarded 1 modifications

✓ All tests passed!
```

---

## Advanced Usage

### Bulk Save (10 records)

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/draft" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "bulk-session",
    "modifications": [
      {"pfaId": "PFA-001", "delta": {"monthlyRate": 5100}},
      {"pfaId": "PFA-002", "delta": {"monthlyRate": 5200}},
      {"pfaId": "PFA-003", "delta": {"monthlyRate": 5300}},
      ...
    ]
  }'
```

### Discard Specific Records

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/discard" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "pfaIds": ["PFA-001", "PFA-002", "PFA-003"]
  }'
```

### Discard All User Drafts

```bash
curl -X POST "http://localhost:3001/api/pfa/${ORG_ID}/discard" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"discardAll": true}'
```

---

## Postman Collection

Import: `backend/docs/postman/PFA_Data_API.postman_collection.json`

**Pre-configured requests**:
- Login
- Get Organizations
- Get Merged Data (various filters)
- Save Draft
- Commit Draft
- Discard Draft
- Get Stats

---

## Next Steps

1. **Explore API**: Try different filters and combinations
2. **Read Full Docs**: See `backend/docs/API_PFA_DATA.md`
3. **Run Tests**: Execute integration tests
4. **Frontend Integration**: Connect React app to API
5. **Phase 4**: Wait for PEMS write sync implementation

---

## Support

- **API Issues**: See `backend/docs/API_PFA_DATA.md`
- **Database Issues**: See `backend/prisma/schema.prisma`
- **Performance Issues**: Check indexes with `\d pfa_mirror` in psql

---

**Happy Coding!** 🚀
