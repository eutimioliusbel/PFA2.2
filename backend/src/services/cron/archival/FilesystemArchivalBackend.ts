import { IArchivalBackend, ArchivalMetadata, ArchivalRecord } from './IArchivalBackend';
import { createWriteStream, createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '../../../utils/logger';
import path from 'path';
import { randomUUID } from 'crypto';

export interface FilesystemConfig {
  archivePath: string;
  compressionLevel?: number;
}

/**
 * Filesystem Archival Backend
 *
 * Stores Bronze records as compressed JSONL files on local filesystem.
 * Suitable for:
 * - Development/testing
 * - Small deployments
 * - Network-attached storage (NAS)
 * - When cloud storage is not available
 */
export class FilesystemArchivalBackend implements IArchivalBackend {
  private config: Required<FilesystemConfig>;

  constructor(config: FilesystemConfig) {
    this.config = {
      archivePath: config.archivePath,
      compressionLevel: config.compressionLevel ?? 9,
    };

    if (!existsSync(this.config.archivePath)) {
      mkdirSync(this.config.archivePath, { recursive: true });
      logger.info(`[FilesystemArchival] Created archive directory: ${this.config.archivePath}`);
    }
  }

  async archiveBatch(records: ArchivalRecord[]): Promise<ArchivalMetadata> {
    const archiveId = `bronze-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
    const archivePath = path.join(this.config.archivePath, `${archiveId}.jsonl.gz`);

    try {
      const uncompressedSize = JSON.stringify(records).length;
      const gzip = createGzip({ level: this.config.compressionLevel });
      const output = createWriteStream(archivePath);

      let lineCount = 0;
      for (const record of records) {
        const line = JSON.stringify(record) + '\n';
        gzip.write(line);
        lineCount++;
      }
      gzip.end();

      await pipeline(gzip, output);

      const compressedSize = statSync(archivePath).size;
      const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);

      logger.info(`[FilesystemArchival] Archived ${lineCount} records`, {
        archiveId,
        compressedSize,
        uncompressedSize,
        compressionRatio: `${compressionRatio}%`,
      });

      return {
        archiveId,
        recordCount: records.length,
        compressedSize,
        uncompressedSize,
        archiveDate: new Date(),
      };
    } catch (error) {
      const err = error as any;
      logger.error('[FilesystemArchival] Archive failed', { error, archiveId });
      throw new Error(`Filesystem archival failed: ${err.message}`);
    }
  }

  async retrieveArchive(archiveId: string): Promise<ArchivalRecord[]> {
    const archivePath = path.join(this.config.archivePath, `${archiveId}.jsonl.gz`);

    if (!existsSync(archivePath)) {
      throw new Error(`Archive not found: ${archiveId}`);
    }

    try {
      const records: ArchivalRecord[] = [];
      const gunzip = createGunzip();
      const input = createReadStream(archivePath);

      let buffer = '';
      gunzip.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            records.push(JSON.parse(line));
          }
        }
      });

      await pipeline(input, gunzip);

      if (buffer.trim()) {
        records.push(JSON.parse(buffer));
      }

      logger.info(`[FilesystemArchival] Retrieved ${records.length} records from ${archiveId}`);
      return records;
    } catch (error) {
      const err = error as any;
      logger.error('[FilesystemArchival] Retrieval failed', { error, archiveId });
      throw new Error(`Failed to retrieve archive: ${err.message}`);
    }
  }

  async listArchives(options?: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<ArchivalMetadata[]> {
    try {
      const files = readdirSync(this.config.archivePath).filter(f => f.endsWith('.jsonl.gz'));

      const archives: ArchivalMetadata[] = [];
      for (const file of files) {
        const filePath = path.join(this.config.archivePath, file);
        const stats = statSync(filePath);
        const archiveId = file.replace('.jsonl.gz', '');

        const archiveDate = stats.mtime;
        if (options?.startDate && archiveDate < options.startDate) continue;
        if (options?.endDate && archiveDate > options.endDate) continue;

        archives.push({
          archiveId,
          recordCount: 0,
          compressedSize: stats.size,
          uncompressedSize: 0,
          archiveDate,
        });
      }

      return archives.sort((a, b) => b.archiveDate.getTime() - a.archiveDate.getTime());
    } catch (error) {
      const err = error as any;
      logger.error('[FilesystemArchival] List archives failed', { error });
      throw new Error(`Failed to list archives: ${err.message}`);
    }
  }

  async deleteArchive(archiveId: string): Promise<void> {
    const archivePath = path.join(this.config.archivePath, `${archiveId}.jsonl.gz`);

    if (!existsSync(archivePath)) {
      throw new Error(`Archive not found: ${archiveId}`);
    }

    try {
      unlinkSync(archivePath);
      logger.info(`[FilesystemArchival] Deleted archive: ${archiveId}`);
    } catch (error) {
      const err = error as any;
      logger.error('[FilesystemArchival] Delete failed', { error, archiveId });
      throw new Error(`Failed to delete archive: ${err.message}`);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const testPath = path.join(this.config.archivePath, '.health-check');
      const testContent = `health-check-${Date.now()}`;

      createWriteStream(testPath).write(testContent);
      createReadStream(testPath).read(); // Read test to verify access

      unlinkSync(testPath);

      return { healthy: true };
    } catch (error) {
      const err = error as any;
      return { healthy: false, error: err.message };
    }
  }
}
