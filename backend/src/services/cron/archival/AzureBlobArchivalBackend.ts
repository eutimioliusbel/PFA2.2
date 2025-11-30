import { IArchivalBackend, ArchivalMetadata, ArchivalRecord } from './IArchivalBackend';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';
import { createGzip, createGunzip } from 'zlib';

export interface AzureBlobConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
  prefix?: string;
  accessTier?: 'Hot' | 'Cool' | 'Archive';
}

/**
 * Azure Blob Storage Archival Backend
 *
 * Stores Bronze records in Azure Blob Storage with tiered storage.
 * Suitable for:
 * - Azure-based deployments
 * - Compliance requirements
 * - Cost-effective long-term storage (Archive tier)
 * - Cross-region redundancy
 */
export class AzureBlobArchivalBackend implements IArchivalBackend {
  private client: BlobServiceClient;
  private containerName: string;
  private prefix: string;
  private accessTier: 'Hot' | 'Cool' | 'Archive';

  constructor(config: AzureBlobConfig) {
    const sharedKeyCredential = new StorageSharedKeyCredential(
      config.accountName,
      config.accountKey
    );

    this.client = new BlobServiceClient(
      `https://${config.accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    this.containerName = config.containerName;
    this.prefix = config.prefix ?? 'bronze-archives';
    this.accessTier = config.accessTier ?? 'Archive';
  }

  async archiveBatch(records: ArchivalRecord[]): Promise<ArchivalMetadata> {
    const archiveId = `bronze-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
    const blobName = `${this.prefix}/${archiveId}.jsonl.gz`;

    try {
      const uncompressedData = records.map(r => JSON.stringify(r)).join('\n');
      const uncompressedSize = Buffer.byteLength(uncompressedData);

      const compressedBuffer = await this.compressData(uncompressedData);
      const compressedSize = compressedBuffer.length;

      const containerClient = this.client.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.upload(compressedBuffer, compressedSize, {
        blobHTTPHeaders: {
          blobContentType: 'application/x-jsonlines+gzip',
        },
        tier: this.accessTier,
        metadata: {
          recordCount: records.length.toString(),
          archiveDate: new Date().toISOString(),
          compressedSize: compressedSize.toString(),
          uncompressedSize: uncompressedSize.toString(),
        },
      });

      const compressionRatio = ((1 - compressedSize / uncompressedSize) * 100).toFixed(1);

      logger.info(`[AzureBlobArchival] Archived ${records.length} records to Azure Blob`, {
        archiveId,
        container: this.containerName,
        blobName,
        accessTier: this.accessTier,
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
      logger.error('[AzureBlobArchival] Archive failed', { error, archiveId });
      throw new Error(`Azure Blob archival failed: ${error.message}`);
    }
  }

  async retrieveArchive(archiveId: string): Promise<ArchivalRecord[]> {
    const blobName = `${this.prefix}/${archiveId}.jsonl.gz`;

    try {
      const containerClient = this.client.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const downloadResponse = await blockBlobClient.download(0);
      if (!downloadResponse.readableStreamBody) {
        throw new Error('Empty response from Azure Blob');
      }

      const compressedData = await this.streamToBuffer(downloadResponse.readableStreamBody);
      const decompressedData = await this.decompressData(compressedData);

      const records: ArchivalRecord[] = decompressedData
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      logger.info(`[AzureBlobArchival] Retrieved ${records.length} records from Azure Blob`, {
        archiveId,
        container: this.containerName,
        blobName,
      });

      return records;
    } catch (error: any) {
      logger.error('[AzureBlobArchival] Retrieval failed', { error, archiveId });
      throw new Error(`Azure Blob retrieval failed: ${error.message}`);
    }
  }

  async listArchives(options?: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<ArchivalMetadata[]> {
    try {
      const containerClient = this.client.getContainerClient(this.containerName);
      const archives: ArchivalMetadata[] = [];

      for await (const blob of containerClient.listBlobsFlat({ prefix: this.prefix })) {
        if (!blob.name.endsWith('.jsonl.gz')) continue;

        const archiveId = blob.name.replace(`${this.prefix}/`, '').replace('.jsonl.gz', '');
        const archiveDate = blob.properties.lastModified || new Date();

        if (options?.startDate && archiveDate < options.startDate) continue;
        if (options?.endDate && archiveDate > options.endDate) continue;

        archives.push({
          archiveId,
          recordCount: parseInt(blob.metadata?.recordCount || '0'),
          compressedSize: blob.properties.contentLength || 0,
          uncompressedSize: parseInt(blob.metadata?.uncompressedSize || '0'),
          archiveDate,
        });
      }

      return archives.sort((a, b) => b.archiveDate.getTime() - a.archiveDate.getTime());
    } catch (error: any) {
      logger.error('[AzureBlobArchival] List archives failed', { error });
      throw new Error(`Azure Blob list failed: ${error.message}`);
    }
  }

  async deleteArchive(archiveId: string): Promise<void> {
    const blobName = `${this.prefix}/${archiveId}.jsonl.gz`;

    try {
      const containerClient = this.client.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.delete();

      logger.info(`[AzureBlobArchival] Deleted archive from Azure Blob`, {
        archiveId,
        blobName,
      });
    } catch (error: any) {
      logger.error('[AzureBlobArchival] Delete failed', { error, archiveId });
      throw new Error(`Azure Blob delete failed: ${error.message}`);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const containerClient = this.client.getContainerClient(this.containerName);
      await containerClient.getProperties();
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
      const chunks: Buffer[] = [];
      const gunzip = createGunzip();

      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      gunzip.on('error', reject);

      gunzip.write(buffer);
      gunzip.end();
    });
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
