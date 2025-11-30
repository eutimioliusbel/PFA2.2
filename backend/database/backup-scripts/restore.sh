#!/bin/bash
#
# PostgreSQL Database Restore Script
#
# Features:
# - Restore from local or S3/Azure backup
# - Pre-restore safety checks
# - Database recreation option
# - Connection validation
# - Rollback on failure
#
# Usage:
#   ./restore.sh /path/to/backup.sql.gz              # Restore from local file
#   ./restore.sh s3://bucket/prefix/backup.sql.gz    # Restore from S3
#   ./restore.sh azure://container/backup.sql.gz     # Restore from Azure
#   ./restore.sh --latest                            # Restore latest local backup
#   ./restore.sh --list                              # List available backups
#

set -e
set -o pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${POSTGRES_DB:-pfa_vanguard_dev}"
PGUSER="${POSTGRES_USER:-pfa_admin}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TEMP_DIR="/tmp/pfa-restore"

# Safety settings
REQUIRE_CONFIRMATION="${REQUIRE_CONFIRMATION:-true}"
CREATE_DATABASE_IF_NOT_EXISTS="${CREATE_DATABASE_IF_NOT_EXISTS:-true}"

# ============================================================================
# LOGGING
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

log_warn() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*" >&2
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

show_usage() {
    cat <<EOF
PostgreSQL Database Restore Script

Usage:
  $0 <backup_file>           Restore from specific backup file
  $0 --latest                Restore from latest local backup
  $0 --list                  List available backups
  $0 --help                  Show this help message

Examples:
  $0 /backups/pfa_backup_20241125_120000.sql.gz
  $0 s3://pfa-backups/prod/backup.sql.gz
  $0 azure://pfa-backups/backup.sql.gz
  $0 --latest

Environment Variables:
  PGHOST                          Database host (default: postgres)
  PGPORT                          Database port (default: 5432)
  PGDATABASE                      Database name (default: pfa_vanguard_dev)
  PGUSER                          Database user (default: pfa_admin)
  POSTGRES_PASSWORD               Database password (required)
  BACKUP_DIR                      Backup directory (default: /backups)
  REQUIRE_CONFIRMATION            Require user confirmation (default: true)
  CREATE_DATABASE_IF_NOT_EXISTS   Create DB if missing (default: true)

EOF
}

list_backups() {
    log "Available local backups in ${BACKUP_DIR}:"
    echo ""

    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        return 1
    fi

    local backups=$(find "$BACKUP_DIR" -name "pfa_backup_*.sql.gz" -type f | sort -r)

    if [ -z "$backups" ]; then
        echo "  No backups found"
        return 0
    fi

    echo "$backups" | while read -r backup; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || stat -c "%y" "$backup" 2>/dev/null | cut -d'.' -f1)
        printf "  %-60s  %10s  %s\n" "$filename" "$size" "$date"
    done

    echo ""
}

get_latest_backup() {
    find "$BACKUP_DIR" -name "pfa_backup_*.sql.gz" -type f | sort -r | head -1
}

confirm_action() {
    if [ "$REQUIRE_CONFIRMATION" != "true" ]; then
        return 0
    fi

    echo ""
    log_warn "⚠️  This will OVERWRITE the database: ${PGDATABASE}"
    log_warn "⚠️  All existing data will be REPLACED"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation

    if [ "$confirmation" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# ============================================================================
# BACKUP DOWNLOAD FUNCTIONS
# ============================================================================

download_from_s3() {
    local s3_uri="$1"
    local local_path="$2"

    log "Downloading from S3: $s3_uri"

    if aws s3 cp "$s3_uri" "$local_path"; then
        log "S3 download successful"
        return 0
    else
        log_error "S3 download failed"
        return 1
    fi
}

download_from_azure() {
    local azure_uri="$1"
    local local_path="$2"

    # Parse azure://container/blob
    local container=$(echo "$azure_uri" | sed 's|azure://||' | cut -d'/' -f1)
    local blob=$(echo "$azure_uri" | sed 's|azure://||' | cut -d'/' -f2-)

    log "Downloading from Azure: $azure_uri"

    if az storage blob download \
        --container-name "$container" \
        --name "$blob" \
        --file "$local_path"; then
        log "Azure download successful"
        return 0
    else
        log_error "Azure download failed"
        return 1
    fi
}

prepare_backup_file() {
    local backup_source="$1"
    local backup_file=""

    # Create temp directory
    mkdir -p "$TEMP_DIR"

    # Handle different backup sources
    if [[ "$backup_source" == s3://* ]]; then
        backup_file="${TEMP_DIR}/$(basename "$backup_source")"
        download_from_s3 "$backup_source" "$backup_file" || return 1

    elif [[ "$backup_source" == azure://* ]]; then
        backup_file="${TEMP_DIR}/$(basename "$backup_source")"
        download_from_azure "$backup_source" "$backup_file" || return 1

    elif [ -f "$backup_source" ]; then
        backup_file="$backup_source"

    else
        log_error "Backup file not found: $backup_source"
        return 1
    fi

    echo "$backup_file"
}

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

check_database_connection() {
    log "Checking database connection..."

    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
        log "Database connection successful"
        return 0
    else
        log_error "Cannot connect to database server"
        return 1
    fi
}

database_exists() {
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1
}

create_database() {
    log "Creating database: ${PGDATABASE}"

    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "CREATE DATABASE \"${PGDATABASE}\""; then
        log "Database created successfully"
        return 0
    else
        log_error "Failed to create database"
        return 1
    fi
}

terminate_connections() {
    log "Terminating existing connections to database: ${PGDATABASE}"

    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${PGDATABASE}'
  AND pid <> pg_backend_pid();
EOF
}

backup_current_database() {
    log "Creating pre-restore backup of current database..."

    local pre_restore_backup="${BACKUP_DIR}/pre_restore_${PGDATABASE}_$(date +%Y%m%d_%H%M%S).sql.gz"

    if pg_dump \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --format=plain \
        --no-owner \
        --no-privileges \
        2>&1 | gzip -6 > "$pre_restore_backup"; then

        log "Pre-restore backup saved: $pre_restore_backup"
        echo "$pre_restore_backup"
        return 0
    else
        log_warn "Pre-restore backup failed (non-fatal)"
        return 0
    fi
}

# ============================================================================
# RESTORE FUNCTIONS
# ============================================================================

restore_database() {
    local backup_file="$1"

    log "Starting database restore..."
    log "Backup file: $backup_file"
    log "Target database: ${PGDATABASE}"

    # Verify backup file
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "Backup file is corrupted"
        return 1
    fi

    # Restore database
    if zcat "$backup_file" | psql \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --single-transaction \
        --set ON_ERROR_STOP=on \
        2>&1 | tee "${TEMP_DIR}/restore.log"; then

        log "Database restore completed successfully"
        return 0
    else
        log_error "Database restore failed"
        log_error "See ${TEMP_DIR}/restore.log for details"
        return 1
    fi
}

verify_restore() {
    log "Verifying restored database..."

    # Check if database has tables
    local table_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")

    if [ "$table_count" -gt 0 ]; then
        log "Verification successful: Found $table_count tables"
        return 0
    else
        log_error "Verification failed: No tables found"
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local backup_source="$1"

    # Handle special arguments
    case "$backup_source" in
        --help|-h)
            show_usage
            exit 0
            ;;
        --list|-l)
            list_backups
            exit 0
            ;;
        --latest)
            backup_source=$(get_latest_backup)
            if [ -z "$backup_source" ]; then
                log_error "No backups found in $BACKUP_DIR"
                exit 1
            fi
            log "Using latest backup: $(basename "$backup_source")"
            ;;
        "")
            log_error "No backup file specified"
            show_usage
            exit 1
            ;;
    esac

    log "============================================================"
    log "PostgreSQL Database Restore"
    log "============================================================"
    log "Target: ${PGHOST}:${PGPORT}/${PGDATABASE}"
    log "Backup: $backup_source"
    log "============================================================"

    # Safety confirmation
    confirm_action

    # Check database connection
    if ! check_database_connection; then
        exit 1
    fi

    # Check if database exists
    if ! database_exists; then
        if [ "$CREATE_DATABASE_IF_NOT_EXISTS" = "true" ]; then
            create_database || exit 1
        else
            log_error "Database does not exist: ${PGDATABASE}"
            exit 1
        fi
    else
        # Backup current database before restore
        backup_current_database
    fi

    # Prepare backup file (download if needed)
    local backup_file=$(prepare_backup_file "$backup_source")
    if [ $? -ne 0 ]; then
        exit 1
    fi

    # Terminate existing connections
    terminate_connections

    # Restore database
    if restore_database "$backup_file"; then
        # Verify restore
        if verify_restore; then
            log "============================================================"
            log "✅ Database restore completed successfully"
            log "============================================================"

            # Cleanup temp files
            if [[ "$backup_file" == ${TEMP_DIR}/* ]]; then
                rm -f "$backup_file"
            fi

            exit 0
        else
            log_error "Restore verification failed"
            exit 1
        fi
    else
        log_error "Restore failed"
        exit 1
    fi
}

# Run main function
main "$@"
