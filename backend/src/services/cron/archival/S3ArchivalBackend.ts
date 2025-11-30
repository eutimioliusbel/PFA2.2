import { IArchivalBackend, ArchivalMetadata, ArchivalRecord } from './IArchivalBackend';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';
import { createGzip } from 'zlib';
import { Readable } from 'stream';

export interface S3Config {
  region: string;
  bucket: string;
  prefix?: string;
  storageClass?: 'STANDARD' | 'GLACIER' | 'DEEP_ARCHIVE' | 'INTELLIGENT_TIERING';
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * AWS S3 Archival Backend
 *
 * Stores Bronze records in AWS S3 with optional Glacier/Deep Archive storage.
 * Suitable for:
 * - Production deployments
 * - Long-term retention (years)
 * - Compliance requirements
 * - Cost-effective cold storage
 */
export class S3ArchivalBackend implements IArchivalBackend {
  private client: S3Client;
  private config: Required<Omit<S3Config, 'accessKeyId' | 'secretAccessKey'>>;

  constructor(config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey ? {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      } : undefined,
    });

    this.config = {
      region: config.region,
      bucket: config.bucket,
      prefix: config.prefix ?? 'bronze-archives',
      storageClass: config.storageClass ?? 'GLACIER',
    };
  }

  async archiveBatch(records: ArchivalRecord[]): Promise<ArchivalMetadata> {
    const archiveId = `bronze-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
    const key = `${this.config.prefix}/${archiveId}.jsonl.gz`;

    try {
      const uncompressedData = records.map(r => JSON.stringify(r)).join('\n');
      const uncompressedSize = Buffer.byteLength(uncompressedData);

      const compressedBuffer = await this.compressData(uncompressedData);
      const compressedSize = compressedBuffer.length;

      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: compressedBuffer,
        ContentType: 'application/x-jsonlines+gzip',
        StorageClass: this.config.storageClass,
        Metadata: {
          recordCount: records.length.toString(),
          archiveDate: new Date().toISOString(),
          compressedSize: compressedSize.toString(),
          uncompressedSize: uncompressedSize.toString(),
        },
      }));

      const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);

      logger.info(`[S3Archival] Archived ${records.length} records to S3`, {
        archiveId,
        bucket: this.config.bucket,
        key,
        storageClass: this.config.storageClass,
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
    } catch (error: any) {
      logger.error('[S3Archival] Archive failed', { error, archiveId });
      throw new Error(`S3 archival failed: ${error.message}`);
    }
  }

  async retrieveArchive(archiveId: string): Promise<ArchivalRecord[]> {
    const key = `${this.config.prefix}/${archiveId}.jsonl.gz`;

    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }));

      if (!response.Body) {
        throw new Error('Empty response from S3');
      }

      const compressedData = await this.streamToBuffer(response.Body as Readable);
      const decompressedData = await this.decompressData(compressedData);

      const records: ArchivalRecord[] = decompressedData
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      logger.info(`[S3Archival] Retrieved ${records.length} records from S3`, {
        archiveId,
        bucket: this.config.bucket,
        key,
      });

      return records;
    } catch (error: any) {
      logger.error('[S3Archival] Retrieval failed', { error, archiveId });
      throw new Error(`S3 retrieval failed: ${error.message}`);
    }
  }

  async listArchives(options?: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<ArchivalMetadata[]> {
    try {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: this.config.prefix,
      }));

      if (!response.Contents) {
        return [];
      }

      const archives: ArchivalMetadata[] = response.Contents
        .filter(obj => obj.Key?.endsWith('.jsonl.gz'))
        .map(obj => {
          const archiveId = obj.Key!.replace(`${this.config.prefix}/`, '').replace('.jsonl.gz', '');
          return {
            archiveId,
            recordCount: 0,
            compressedSize: obj.Size || 0,
            uncompressedSize: 0,
            archiveDate: obj.LastModified || new Date(),
          };
        });

      return archives
        .filter(a => {
          if (options?.startDate && a.archiveDate < options.startDate) return false;
          if (options?.endDate && a.archiveDate > options.endDate) return false;
          return true;
        })
        .sort((a, b) => b.archiveDate.getTime() - a.archiveDate.getTime());
    } catch (error: any) {
      logger.error('[S3Archival] List archives failed', { error });
      throw new Error(`S3 list failed: ${error.message}`);
    }
  }

  async deleteArchive(archiveId: string): Promise<void> {
    const key = `${this.config.prefix}/${archiveId}.jsonl.gz`;

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }));

      logger.info(`[S3Archival] Deleted archive from S3`, { archiveId, key });
    } catch (error: any) {
      logger.error('[S3Archival] Delete failed', { error, archiveId });
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({
        Bucket: this.config.bucket,
      }));
      return { healthy: true };
    } catch (error: any) {
      return { healthy: false, error: error.message };
    }
  }

  private async compressData(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gzip = createGzip({ level: 9 });

      gzip.on('data', chunk => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      gzip.write(data);
      gzip.end();
    });
  }

  private async decompressData(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const { createGunzip } = require('zlib');
      const chunks: Buffer[] = [];
      const gunzip = createGunzip();

      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      gunzip.on('error', reject);

      gunzip.write(buffer);
      gunzip.end();
    });
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
