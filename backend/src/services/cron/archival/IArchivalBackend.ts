/**
 * Archival Backend Interface
 *
 * Defines contract for archiving Bronze layer records to cold storage.
 * Implementations include S3, Azure Blob, and local filesystem.
 */

export interface ArchivalMetadata {
  archiveId: string;
  recordCount: number;
  compressedSize: number;
  uncompressedSize: number;
  archiveDate: Date;
  retentionDays?: number;
}

export interface ArchivalRecord {
  id: string;
  syncBatchId: string;
  organizationId: string;
  ingestedAt: Date;
  rawData: any;
  metadata?: any;
}

export interface IArchivalBackend {
  /**
   * Archive a batch of records to cold storage
   */
  archiveBatch(records: ArchivalRecord[]): Promise<ArchivalMetadata>;

  /**
   * Retrieve archived records by archive ID
   */
  retrieveArchive(archiveId: string): Promise<ArchivalRecord[]>;

  /**
   * List all archives
   */
  listArchives(options?: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<ArchivalMetadata[]>;

  /**
   * Delete an archive (permanent)
   */
  deleteArchive(archiveId: string): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
}
