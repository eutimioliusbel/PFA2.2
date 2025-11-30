import { IArchivalBackend } from './IArchivalBackend';
import { FilesystemArchivalBackend } from './FilesystemArchivalBackend';
import { S3ArchivalBackend } from './S3ArchivalBackend';
import { AzureBlobArchivalBackend } from './AzureBlobArchivalBackend';
import { logger } from '../../../utils/logger';

export type ArchivalBackendType = 'filesystem' | 's3' | 'azure-blob' | 'disabled';

export interface ArchivalConfig {
  type: ArchivalBackendType;
  filesystem?: {
    archivePath: string;
    compressionLevel?: number;
  };
  s3?: {
    region: string;
    bucket: string;
    prefix?: string;
    storageClass?: 'STANDARD' | 'GLACIER' | 'DEEP_ARCHIVE' | 'INTELLIGENT_TIERING';
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  azureBlob?: {
    accountName: string;
    accountKey: string;
    containerName: string;
    prefix?: string;
    accessTier?: 'Hot' | 'Cool' | 'Archive';
  };
}

/**
 * Factory for creating archival backends
 *
 * Usage:
 * ```typescript
 * const backend = ArchivalBackendFactory.create({
 *   type: 's3',
 *   s3: {
 *     region: 'us-east-1',
 *     bucket: 'my-archives',
 *     storageClass: 'GLACIER'
 *   }
 * });
 * ```
 */
export class ArchivalBackendFactory {
  static create(config: ArchivalConfig): IArchivalBackend | undefined {
    switch (config.type) {
      case 'filesystem':
        if (!config.filesystem) {
          throw new Error('Filesystem configuration required');
        }
        logger.info('[ArchivalBackend] Creating filesystem backend', {
          path: config.filesystem.archivePath,
        });
        return new FilesystemArchivalBackend(config.filesystem);

      case 's3':
        if (!config.s3) {
          throw new Error('S3 configuration required');
        }
        logger.info('[ArchivalBackend] Creating S3 backend', {
          region: config.s3.region,
          bucket: config.s3.bucket,
          storageClass: config.s3.storageClass,
        });
        return new S3ArchivalBackend(config.s3);

      case 'azure-blob':
        if (!config.azureBlob) {
          throw new Error('Azure Blob configuration required');
        }
        logger.info('[ArchivalBackend] Creating Azure Blob backend', {
          accountName: config.azureBlob.accountName,
          container: config.azureBlob.containerName,
          accessTier: config.azureBlob.accessTier,
        });
        return new AzureBlobArchivalBackend(config.azureBlob);

      case 'disabled':
        logger.info('[ArchivalBackend] Archival disabled');
        return undefined;

      default:
        throw new Error(`Unknown archival backend type: ${config.type}`);
    }
  }

  /**
   * Create backend from environment variables
   */
  static createFromEnv(): IArchivalBackend | undefined {
    const type = (process.env.ARCHIVAL_BACKEND_TYPE || 'disabled') as ArchivalBackendType;

    if (type === 'disabled') {
      return undefined;
    }

    const config: ArchivalConfig = { type };

    if (type === 'filesystem') {
      config.filesystem = {
        archivePath: process.env.ARCHIVAL_FILESYSTEM_PATH || './archives',
        compressionLevel: parseInt(process.env.ARCHIVAL_COMPRESSION_LEVEL || '9'),
      };
    }

    if (type === 's3') {
      config.s3 = {
        region: process.env.AWS_REGION || process.env.ARCHIVAL_S3_REGION || 'us-east-1',
        bucket: process.env.ARCHIVAL_S3_BUCKET!,
        prefix: process.env.ARCHIVAL_S3_PREFIX,
        storageClass: (process.env.ARCHIVAL_S3_STORAGE_CLASS as any) || 'GLACIER',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.ARCHIVAL_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.ARCHIVAL_S3_SECRET_ACCESS_KEY,
      };

      if (!config.s3.bucket) {
        throw new Error('ARCHIVAL_S3_BUCKET environment variable required for S3 backend');
      }
    }

    if (type === 'azure-blob') {
      config.azureBlob = {
        accountName: process.env.ARCHIVAL_AZURE_ACCOUNT_NAME!,
        accountKey: process.env.ARCHIVAL_AZURE_ACCOUNT_KEY!,
        containerName: process.env.ARCHIVAL_AZURE_CONTAINER!,
        prefix: process.env.ARCHIVAL_AZURE_PREFIX,
        accessTier: (process.env.ARCHIVAL_AZURE_ACCESS_TIER as any) || 'Archive',
      };

      if (!config.azureBlob.accountName || !config.azureBlob.accountKey || !config.azureBlob.containerName) {
        throw new Error('Azure Blob configuration missing: ARCHIVAL_AZURE_ACCOUNT_NAME, ARCHIVAL_AZURE_ACCOUNT_KEY, ARCHIVAL_AZURE_CONTAINER required');
      }
    }

    return this.create(config);
  }
}
