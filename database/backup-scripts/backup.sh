#!/bin/bash
#
# PostgreSQL Automated Backup Script
#
# Features:
# - Full database backup with pg_dump
# - Compressed backups (gzip)
# - Automatic retention policy (configurable days)
# - S3/Azure upload support (optional)
# - Backup verification
# - Email notifications on failure
#
# Usage: ./backup.sh
#

set -e
set -o pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Database connection (from environment variables)
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${POSTGRES_DB:-pfa_vanguard_dev}"
PGUSER="${POSTGRES_USER:-pfa_admin}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Backup settings
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="pfa_backup_${PGDATABASE}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# S3 settings (optional)
S3_ENABLED="${S3_ENABLED:-false}"
S3_BUCKET="${AWS_BACKUP_BUCKET:-}"
S3_PREFIX="${AWS_BACKUP_PREFIX:-backups}"

# Azure settings (optional)
AZURE_ENABLED="${AZURE_ENABLED:-false}"
AZURE_CONTAINER="${AZURE_STORAGE_CONTAINER:-}"

# Notification settings
NOTIFY_ON_SUCCESS="${NOTIFY_ON_SUCCESS:-false}"
NOTIFY_ON_FAILURE="${NOTIFY_ON_FAILURE:-true}"
EMAIL_FROM="${ALERT_EMAIL_FROM:-}"
EMAIL_TO="${ALERT_EMAIL_TO:-}"

# ============================================================================
# LOGGING
# ============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# ============================================================================
# NOTIFICATION FUNCTIONS
# ============================================================================

send_notification() {
    local subject="$1"
    local message="$2"

    if [ -n "$EMAIL_TO" ]; then
        echo "$message" | mail -s "$subject" -r "$EMAIL_FROM" "$EMAIL_TO" 2>/dev/null || true
    fi

    # Add Slack webhook support (optional)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"$subject\n$message\"}" 2>/dev/null || true
    fi
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

create_backup() {
    log "Starting backup of database: ${PGDATABASE}"
    log "Backup file: ${BACKUP_FILENAME}"

    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"

    # Create backup with pg_dump
    # Options:
    #   --format=plain     : SQL script format (human-readable)
    #   --no-owner         : Don't output ownership commands
    #   --no-privileges    : Don't output privilege commands
    #   --clean            : Include DROP statements
    #   --if-exists        : Use IF EXISTS with DROP statements
    #   --compress=6       : Compress with gzip level 6 (via pipe)
    if pg_dump \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        --verbose \
        2>&1 | gzip -6 > "$BACKUP_PATH"; then

        log "Backup completed successfully"
        return 0
    else
        log_error "Backup failed"
        return 1
    fi
}

verify_backup() {
    log "Verifying backup integrity..."

    # Check if file exists
    if [ ! -f "$BACKUP_PATH" ]; then
        log_error "Backup file not found: $BACKUP_PATH"
        return 1
    fi

    # Check file size (should be > 1KB)
    local file_size=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
    if [ "$file_size" -lt 1024 ]; then
        log_error "Backup file is too small: ${file_size} bytes"
        return 1
    fi

    # Test gzip integrity
    if ! gzip -t "$BACKUP_PATH" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        return 1
    fi

    # Test SQL integrity (check for common SQL keywords)
    if ! zcat "$BACKUP_PATH" | head -20 | grep -q "PostgreSQL database dump"; then
        log_error "Backup file does not appear to be a valid PostgreSQL dump"
        return 1
    fi

    log "Backup verification successful (${file_size} bytes)"
    return 0
}

upload_to_s3() {
    if [ "$S3_ENABLED" != "true" ] || [ -z "$S3_BUCKET" ]; then
        log "S3 upload disabled or not configured"
        return 0
    fi

    log "Uploading backup to S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILENAME}"

    if aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILENAME}" \
        --storage-class STANDARD_IA \
        --metadata "database=${PGDATABASE},timestamp=${TIMESTAMP}"; then
        log "S3 upload successful"
        return 0
    else
        log_error "S3 upload failed"
        return 1
    fi
}

upload_to_azure() {
    if [ "$AZURE_ENABLED" != "true" ] || [ -z "$AZURE_CONTAINER" ]; then
        log "Azure upload disabled or not configured"
        return 0
    fi

    log "Uploading backup to Azure: ${AZURE_CONTAINER}/${BACKUP_FILENAME}"

    if az storage blob upload \
        --container-name "$AZURE_CONTAINER" \
        --file "$BACKUP_PATH" \
        --name "$BACKUP_FILENAME" \
        --tier Cool; then
        log "Azure upload successful"
        return 0
    else
        log_error "Azure upload failed"
        return 1
    fi
}

cleanup_old_backups() {
    log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

    local deleted_count=0

    # Delete local backups older than retention period
    find "$BACKUP_DIR" -name "pfa_backup_*.sql.gz" -type f -mtime +"$BACKUP_RETENTION_DAYS" -print0 | while IFS= read -r -d '' file; do
        log "Deleting old backup: $(basename "$file")"
        rm -f "$file"
        deleted_count=$((deleted_count + 1))
    done

    # Cleanup S3 (if enabled)
    if [ "$S3_ENABLED" = "true" ] && [ -n "$S3_BUCKET" ]; then
        local cutoff_date=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)

        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
            local file_date=$(echo "$line" | awk '{print $1}')
            local file_name=$(echo "$line" | awk '{print $4}')

            if [[ "$file_date" < "$cutoff_date" ]]; then
                log "Deleting old S3 backup: $file_name"
                aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file_name}"
                deleted_count=$((deleted_count + 1))
            fi
        done
    fi

    # Cleanup Azure (if enabled)
    if [ "$AZURE_ENABLED" = "true" ] && [ -n "$AZURE_CONTAINER" ]; then
        local cutoff_timestamp=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%s 2>/dev/null || date -v-${BACKUP_RETENTION_DAYS}d +%s)

        az storage blob list --container-name "$AZURE_CONTAINER" --query "[?properties.creationTime < '$(date -d @$cutoff_timestamp -Iseconds)'].name" -o tsv | while read -r blob; do
            log "Deleting old Azure backup: $blob"
            az storage blob delete --container-name "$AZURE_CONTAINER" --name "$blob"
            deleted_count=$((deleted_count + 1))
        done
    fi

    log "Cleanup complete (deleted $deleted_count backups)"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    local status=0

    log "============================================================"
    log "PostgreSQL Backup Started"
    log "============================================================"
    log "Database: ${PGDATABASE}"
    log "Host: ${PGHOST}:${PGPORT}"
    log "Retention: ${BACKUP_RETENTION_DAYS} days"
    log "============================================================"

    # Create backup
    if ! create_backup; then
        log_error "Backup creation failed"
        status=1
    fi

    # Verify backup
    if [ $status -eq 0 ] && ! verify_backup; then
        log_error "Backup verification failed"
        status=1
    fi

    # Upload to cloud storage
    if [ $status -eq 0 ]; then
        upload_to_s3 || log_error "S3 upload failed (non-fatal)"
        upload_to_azure || log_error "Azure upload failed (non-fatal)"
    fi

    # Cleanup old backups
    cleanup_old_backups

    # Final status
    log "============================================================"
    if [ $status -eq 0 ]; then
        log "Backup completed successfully"
        log "Backup location: ${BACKUP_PATH}"
        log "Backup size: $(du -h "$BACKUP_PATH" | cut -f1)"

        if [ "$NOTIFY_ON_SUCCESS" = "true" ]; then
            send_notification \
                "✅ PostgreSQL Backup Success - ${PGDATABASE}" \
                "Backup completed successfully\nDatabase: ${PGDATABASE}\nFile: ${BACKUP_FILENAME}\nSize: $(du -h "$BACKUP_PATH" | cut -f1)"
        fi
    else
        log_error "Backup failed"

        if [ "$NOTIFY_ON_FAILURE" = "true" ]; then
            send_notification \
                "❌ PostgreSQL Backup Failed - ${PGDATABASE}" \
                "Backup failed for database: ${PGDATABASE}\nTimestamp: ${TIMESTAMP}\nPlease investigate immediately."
        fi
    fi
    log "============================================================"

    return $status
}

# Run main function
main
exit $?
