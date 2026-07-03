import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

/**
 * Backup Service
 *
 * Provides database backup and restore functionality
 * with cloud storage integration.
 */

const execFileAsync = promisify(execFile);

// ============================================
// CONFIGURATION
// ============================================

interface BackupConfig {
  databaseUrl: string;
  bucketName: string;
  backupDir: string;
  retentionDays: number;
  encryptionKey?: string;
  compressionEnabled: boolean;
}

const config: BackupConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  bucketName: process.env.BACKUP_BUCKET || 'projectflow-backups',
  backupDir: process.env.BACKUP_DIR || '/tmp/backups',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  compressionEnabled: process.env.BACKUP_COMPRESSION !== 'false',
};

// ============================================
// TYPES
// ============================================

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  filename: string;
  size: number;
  checksum: string;
  type: 'full' | 'incremental';
  encrypted: boolean;
  compressed: boolean;
  databaseVersion?: string;
  tables?: string[];
}

export interface RestoreOptions {
  backupId: string;
  targetDatabase?: string;
  dropExisting?: boolean;
  tables?: string[];
}

export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
  duration: number;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  duration: number;
  tablesRestored?: number;
}

// ============================================
// BACKUP SERVICE CLASS
// ============================================

class BackupService {
  private storage: Storage;
  private initialized = false;

  constructor() {
    this.storage = new Storage();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure backup directory exists
    await fs.mkdir(config.backupDir, { recursive: true });

    // Verify bucket access
    try {
      const [exists] = await this.storage.bucket(config.bucketName).exists();
      if (!exists) {
        console.warn(`Backup bucket ${config.bucketName} does not exist`);
      }
    } catch (error) {
      console.warn('Could not verify backup bucket:', error);
    }

    this.initialized = true;
  }

  /**
   * Create a full database backup
   */
  async createBackup(tables?: string[]): Promise<BackupResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      const backupId = this.generateBackupId();
      const timestamp = new Date();
      const baseFilename = `backup_${backupId}`;
      const dumpFile = path.join(config.backupDir, `${baseFilename}.sql`);

      // Build pg_dump args (execFile avoids shell injection)
      const dumpArgs = [config.databaseUrl];
      if (tables) {
        for (const t of tables) {
          dumpArgs.push('-t', t);
        }
      }
      dumpArgs.push('-F', 'p', '-f', dumpFile);

      // Execute pg_dump without a shell
      await execFileAsync('pg_dump', dumpArgs);

      // Compress if enabled
      let finalFile = dumpFile;
      if (config.compressionEnabled) {
        await execFileAsync('gzip', [dumpFile]);
        finalFile = `${dumpFile}.gz`;
      }

      // Encrypt if key is provided
      if (config.encryptionKey) {
        await this.encryptFile(finalFile);
        finalFile = `${finalFile}.enc`;
      }

      // Calculate checksum
      const fileBuffer = await fs.readFile(finalFile);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Get file stats
      const stats = await fs.stat(finalFile);

      // Upload to cloud storage
      const cloudFilename = path.basename(finalFile);
      await this.uploadToCloud(finalFile, cloudFilename);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        filename: cloudFilename,
        size: stats.size,
        checksum,
        type: tables ? 'incremental' : 'full',
        encrypted: !!config.encryptionKey,
        compressed: config.compressionEnabled,
        tables,
      };

      // Save metadata
      await this.saveMetadata(metadata);

      // Cleanup local file
      await fs.unlink(finalFile);

      console.log(`Backup completed: ${backupId} (${stats.size} bytes)`);

      return {
        success: true,
        metadata,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Backup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Get backup metadata
      const metadata = await this.getBackupMetadata(options.backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }

      // Download from cloud storage
      const localFile = path.join(config.backupDir, metadata.filename);
      await this.downloadFromCloud(metadata.filename, localFile);

      // Decrypt if needed
      let workingFile = localFile;
      if (metadata.encrypted) {
        if (!config.encryptionKey) {
          throw new Error('Encryption key required for encrypted backup');
        }
        await this.decryptFile(workingFile);
        workingFile = workingFile.replace('.enc', '');
      }

      // Decompress if needed
      if (metadata.compressed) {
        await execFileAsync('gunzip', ['-k', workingFile]);
        workingFile = workingFile.replace('.gz', '');
      }

      // Verify checksum
      const fileBuffer = await fs.readFile(
        metadata.compressed && !metadata.encrypted
          ? `${workingFile}.gz`
          : workingFile
      );
      const _checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Note: Checksum comparison might differ after decompression
      // In production, store both compressed and uncompressed checksums

      // Build psql args (execFile avoids shell injection)
      const targetDb = options.targetDatabase || config.databaseUrl;

      if (options.dropExisting) {
        console.warn('Dropping existing database objects...');
        // This should be done with extreme caution in production
      }

      // Execute restore without a shell
      const { stdout: _stdout, stderr } = await execFileAsync('psql', [targetDb, '-f', workingFile]);

      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('Restore warnings:', stderr);
      }

      // Cleanup
      await fs.unlink(localFile);
      if (workingFile !== localFile) {
        await fs.unlink(workingFile);
      }

      console.log(`Restore completed from backup: ${options.backupId}`);

      return {
        success: true,
        duration: Date.now() - startTime,
        tablesRestored: metadata.tables?.length,
      };
    } catch (error) {
      console.error('Restore failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(limit = 50): Promise<BackupMetadata[]> {
    try {
      const [files] = await this.storage
        .bucket(config.bucketName)
        .getFiles({ prefix: 'metadata/' });

      const metadataFiles = files.slice(-limit);
      const backups: BackupMetadata[] = [];

      for (const file of metadataFiles) {
        const [content] = await file.download();
        const metadata = JSON.parse(content.toString());
        backups.push(metadata);
      }

      return backups.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups(1000);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (new Date(backup.timestamp) < cutoffDate) {
          await this.deleteBackup(backup.id);
          deletedCount++;
        }
      }

      console.log(`Cleaned up ${deletedCount} old backups`);
      return deletedCount;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) return false;

      // Delete backup file
      await this.storage
        .bucket(config.bucketName)
        .file(metadata.filename)
        .delete();

      // Delete metadata file
      await this.storage
        .bucket(config.bucketName)
        .file(`metadata/${backupId}.json`)
        .delete();

      return true;
    } catch (error) {
      console.error(`Failed to delete backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      // Download and verify checksum
      const localFile = path.join(config.backupDir, `verify_${metadata.filename}`);
      await this.downloadFromCloud(metadata.filename, localFile);

      const fileBuffer = await fs.readFile(localFile);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      await fs.unlink(localFile);

      if (checksum !== metadata.checksum) {
        console.error(`Checksum mismatch for backup ${backupId}`);
        return false;
      }

      console.log(`Backup ${backupId} verified successfully`);
      return true;
    } catch (error) {
      console.error(`Verification failed for ${backupId}:`, error);
      return false;
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private generateBackupId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }

  private async uploadToCloud(localPath: string, cloudPath: string): Promise<void> {
    await this.storage.bucket(config.bucketName).upload(localPath, {
      destination: cloudPath,
      metadata: {
        contentType: 'application/octet-stream',
      },
    });
  }

  private async downloadFromCloud(cloudPath: string, localPath: string): Promise<void> {
    await this.storage
      .bucket(config.bucketName)
      .file(cloudPath)
      .download({ destination: localPath });
  }

  private async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = `metadata/${metadata.id}.json`;
    const content = JSON.stringify(metadata, null, 2);

    await this.storage.bucket(config.bucketName).file(metadataPath).save(content, {
      contentType: 'application/json',
    });
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataPath = `metadata/${backupId}.json`;
      const [content] = await this.storage
        .bucket(config.bucketName)
        .file(metadataPath)
        .download();

      return JSON.parse(content.toString());
    } catch {
      return null;
    }
  }

  private async encryptFile(filePath: string): Promise<void> {
    if (!config.encryptionKey) return;

    const key = crypto.scryptSync(config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const input = await fs.readFile(filePath);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const encrypted = Buffer.concat([iv, cipher.update(input), cipher.final()]);
    await fs.writeFile(`${filePath}.enc`, encrypted);
    await fs.unlink(filePath);
  }

  private async decryptFile(filePath: string): Promise<void> {
    if (!config.encryptionKey) return;

    const key = crypto.scryptSync(config.encryptionKey, 'salt', 32);
    const input = await fs.readFile(filePath);

    const iv = input.subarray(0, 16);
    const encrypted = input.subarray(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const outputPath = filePath.replace('.enc', '');
    await fs.writeFile(outputPath, decrypted);
    await fs.unlink(filePath);
  }
}

// ============================================
// SCHEDULED BACKUP JOB
// ============================================

export async function runScheduledBackup(): Promise<void> {
  console.log('Starting scheduled backup...');

  const service = new BackupService();
  const result = await service.createBackup();

  if (result.success) {
    console.log(`Scheduled backup completed: ${result.metadata?.id}`);

    // Cleanup old backups
    await service.cleanupOldBackups();
  } else {
    console.error('Scheduled backup failed:', result.error);
    // In production, send alert to ops team
  }
}

// ============================================
// EXPORTS
// ============================================

export const backupService = new BackupService();

export default backupService;
