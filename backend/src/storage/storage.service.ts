import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { type PedrStage } from '@portlog/schemas';

const STAGE_FOLDER: Record<PedrStage, string> = {
  PRE_ARRIVAL: '01-pre-arrival',
  ATTENDING: '02-attending',
  DISPATCH: '03-dispatch',
  CLOSING: '04-closing',
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private readonly bucket: string;
  private available = false;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'portlog');
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
      this.available = true;
      this.logger.log(`StorageService connected — bucket: ${this.bucket}`);
    } catch {
      this.logger.warn(
        `MinIO unavailable — storage features disabled. Set MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY to enable.`,
      );
    }
  }

  buildKey(nominationId: string, stage: PedrStage, filename: string): string {
    return `sgc-documents/${nominationId}/${STAGE_FOLDER[stage]}/${filename}`;
  }

  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    this.assertAvailable();
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async getPresignedUrl(key: string, expirySeconds = 900): Promise<string> {
    this.assertAvailable();
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async deleteFile(key: string): Promise<void> {
    this.assertAvailable();
    await this.client.removeObject(this.bucket, key);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    this.assertAvailable();
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async fileExists(key: string): Promise<boolean> {
    this.assertAvailable();
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  private assertAvailable(): void {
    if (!this.available) {
      throw new Error('MinIO storage is not available. Check MINIO_* environment variables.');
    }
  }
}
