# Changelog

All notable changes to PFA Vanguard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - PEMS Data Synchronization Feature (2025-11-25)

#### Database Schema
- **Sync Tracking Fields** added to `ApiConfiguration` model:
  - `firstSyncAt` (DateTime?) - Date of first successful data sync
  - `lastSyncAt` (DateTime?) - Date of most recent data sync
  - `lastSyncRecordCount` (Int?) - Records synced in last operation
  - `totalSyncRecordCount` (Int?) - Lifetime total records synced
- **Migration**: `20251125040401_add_sync_tracking_fields`

#### Backend Services
- **PEMS Sync Service** (`backend/src/services/pemsSyncService.ts`):
  - Batch processing with configurable page size (10,000 records/API call)
  - Database batch operations (1,000 records/transaction)
  - Organization-based filtering for multi-tenant support
  - Real-time progress tracking with in-memory sync status
  - Memory-safe processing for large datasets (millions of records)

- **PEMS Sync Controller** (`backend/src/controllers/pemsSyncController.ts`):
  - `POST /api/pems/sync` - Start data synchronization
  - `GET /api/pems/sync/:syncId` - Get sync progress status
  - Background processing (non-blocking API responses)
  - Automatic sync statistics persistence after completion

#### Frontend UI
- **API Connectivity Table** (`components/admin/ApiConnectivity.tsx`):
  - Four new columns for sync tracking:
    - **First Sync**: Date of first successful sync (MMM DD, YYYY format)
    - **Last Sync**: Date and time of most recent sync (MMM DD, YYYY HH:MM format)
    - **Last Pull**: Records synced in last operation (with thousands separator)
    - **Total Records**: Lifetime cumulative records (bold blue, thousands separator)
  - **Sync Data Button**: Green button appears for APIs with `feeds` configuration
  - **Progress Modal**: Real-time sync progress with batch tracking and percentage
  - **Empty States**: Shows "Never" or "—" for APIs that have never been synced

#### Authentication Fix
- **JWT Token Storage**: Fixed authentication to use correct localStorage key
  - Token stored under `'pfa_auth_token'` (not `'token'`)
  - User data stored under `'pfa_user_data'`
- **API Client Integration**: All sync operations now use `apiClient` service
  - Automatic token injection in Authorization headers
  - Proper error handling and token cleanup on 401 responses
  - TypeScript interfaces updated to match backend response structures

#### Utility Scripts
- **`backend/check-feeds.ts`**: Diagnostic tool to verify feeds configuration and sync statistics
- **`backend/update-feeds.ts`**: Manual utility to populate feeds field for PEMS APIs
- **`backend/clear-pfa-data.ts`**: Utility to delete all PFA records before full sync

#### API Configuration
- **Feeds Field**: JSON configuration defining what data each API synchronizes
  - PEMS PFA Read: Syncs PFA records for Timeline, Matrix, Grid views
  - PEMS PFA Write: Write operations for PFA data
  - PEMS Assets: Syncs asset master data
  - PEMS Classes: Syncs classification data

### Fixed
- **Authentication Error**: Resolved 401 "Invalid token" error when clicking Sync Data button
  - Root cause: Manual `fetch()` calls using wrong localStorage key
  - Solution: Migrated to `apiClient` service methods for all sync operations
- **Feeds Field NULL**: Fixed issue where existing API configurations had NULL feeds
  - Created update script to populate feeds for existing records
  - Updated seed script to properly set feeds on upsert

### Changed
- **API Client TypeScript Interfaces** (`services/apiClient.ts`):
  - Updated `getSyncStatus()` return type to match actual backend response
  - Added nested types for `progress`, `batch`, and `timing` objects
- **Sync Controller Statistics** (`backend/src/controllers/pemsSyncController.ts`):
  - Now saves sync statistics to database after successful completion
  - Calculates cumulative total records across all syncs
  - Preserves `firstSyncAt` timestamp (never overwrites)

### Documentation
- **CLAUDE.md**: Added comprehensive "PEMS Data Synchronization" section:
  - Sync architecture and flow diagrams
  - Sync tracking fields documentation
  - API configuration feeds examples
  - Frontend authentication patterns
  - UI sync tracking columns specification
  - Batch processing characteristics
  - Utility scripts usage
  - Troubleshooting guide
  - Related files reference

## Technical Details

### Performance Characteristics
- **API Page Size**: 10,000 records per PEMS Grid Data API call
- **Database Batch Size**: 1,000 records per Prisma transaction
- **Polling Interval**: 2 seconds for progress updates
- **Memory Usage**: Processes large datasets without loading all into memory
- **Organization Filtering**: Supports multi-organization scenarios

### Security Considerations
- All sync endpoints protected by JWT authentication
- Token stored securely in browser localStorage
- Organization-level data isolation maintained
- Background processing prevents request timeouts

### Browser Compatibility
- localStorage API required for token storage
- Fetch API used for HTTP requests
- Modern JavaScript features (async/await, Map, Set)

### Database Migrations
To apply the sync tracking fields:
```bash
cd backend
npm run prisma:migrate
```

### Seeding Database
To populate feeds configuration:
```bash
cd backend
npm run prisma:seed
# Or manually: npx tsx update-feeds.ts
```

## Breaking Changes
None. This is an additive feature with backward compatibility.

## Deprecations
None.

## Known Issues
- Sync button only visible for APIs with non-null `feeds` field
- First-time sync requires manual feeds population if seed didn't run
- Large syncs (1M+ records) may take several minutes

## Migration Guide
For existing installations:
1. Run database migration: `npm run prisma:migrate`
2. Check feeds status: `npx tsx check-feeds.ts`
3. If feeds are NULL, run: `npx tsx update-feeds.ts`
4. Refresh frontend to see sync tracking columns
5. Test sync with small organization first

## Contributors
- Claude Code (AI Assistant)

---

## Version History

### [0.1.0] - Initial Release
- Core PFA Vanguard application
- Timeline, Matrix, Grid Lab views
- Command Deck bulk operations
- Filter panel with multi-dimensional filtering
- KPI Board with variance tracking
- AI Assistant integration (Gemini, OpenAI, Claude)
- Multi-organization support
- JWT authentication
- CSV import/export
- Asset Master and Classification management
