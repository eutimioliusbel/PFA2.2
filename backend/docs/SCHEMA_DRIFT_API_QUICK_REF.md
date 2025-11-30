# Schema Drift API - Quick Reference

## Endpoints

### 1. Get Schema Drift Analysis
```bash
GET /api/endpoints/:endpointId/schema-drift
Authorization: Bearer <token>
Permission: perm_Read
```

**Returns**: Drift metrics, baseline/received schemas, AI suggestions

---

### 2. List Mapping Versions
```bash
GET /api/endpoints/:endpointId/mapping-versions
Authorization: Bearer <token>
Permission: perm_Read
```

**Returns**: Version snapshots with counts and timestamps

---

### 3. Get Version Detail
```bash
GET /api/endpoints/:endpointId/mapping-versions/:versionId
Authorization: Bearer <token>
Permission: perm_Read
```

**Returns**: All mappings for a specific version

---

### 4. Create Mappings (Batch)
```bash
POST /api/endpoints/:endpointId/mappings/batch
Authorization: Bearer <token>
Permission: perm_ManageSettings

Body:
{
  "mappings": [
    {
      "sourceField": "pems_field_name",
      "destinationField": "pfa_field_name",
      "transformType": "direct",
      "dataType": "string"
    }
  ]
}
```

**Returns**: Created/failed counts + mapping objects

---

### 5. Restore Historical Version
```bash
POST /api/endpoints/:endpointId/mapping-versions/:versionId/restore
Authorization: Bearer <token>
Permission: perm_ManageSettings
```

**Returns**: Restored mapping count + mapping objects

---

## Testing

```bash
# Run test script
cd backend
npx ts-node scripts/test-schema-drift-endpoints.ts
```

---

## Key Files

- **Controller**: `src/controllers/apiEndpointController.ts`
- **Routes**: `src/routes/apiServers.ts`
- **Service**: `src/services/pems/SchemaDriftDetector.ts`
- **Tests**: `scripts/test-schema-drift-endpoints.ts`
- **Docs**: `docs/backend/API_REFERENCE.md`

---

## Common Issues

**404 on version restore**: Check version ID format (`version_2025-11-28T10:00:00.000Z`)

**Empty suggestions**: Increase Levenshtein threshold in controller (line 667)

**No drift detected**: Need at least 2 completed batches for comparison

---

## Dependencies

```bash
npm install fastest-levenshtein --legacy-peer-deps
```
