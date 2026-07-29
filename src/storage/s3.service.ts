import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly allowedBucket = process.env.AWS_S3_BUCKET;

  constructor() {
    const endpoint = process.env.AWS_S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!!accessKeyId !== !!secretAccessKey) {
      throw new Error(
        'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together',
      );
    }
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle:
        !!endpoint && process.env.AWS_S3_FORCE_PATH_STYLE !== 'false',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! }
          : undefined,
    });
  }

  private validateBucket(bucket: string) {
    if (this.allowedBucket && bucket !== this.allowedBucket) {
      throw new NotFoundException('Bucket não autorizado');
    }
  }

  private unavailable(error: unknown): never {
    if (
      error instanceof NoSuchKey ||
      (typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404)
    ) {
      throw new NotFoundException('Vídeo não encontrado no S3');
    }
    throw new ServiceUnavailableException(
      'Não foi possível acessar o armazenamento de vídeos',
    );
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    this.validateBucket(bucket);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return false;
      this.unavailable(error);
    }
  }

  async getStream(
    bucket: string,
    key: string,
  ): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    this.validateBucket(bucket);
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!object.Body)
        throw new NotFoundException('Conteúdo do vídeo não encontrado no S3');
      return {
        stream: object.Body as Readable,
        contentType: object.ContentType,
        contentLength: object.ContentLength,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.unavailable(error);
    }
  }

  async streamFile(
    bucket: string,
    key: string,
    fileName: string,
    response: Response,
    disposition: 'inline' | 'attachment',
  ) {
    const object = await this.getStream(bucket, key);
    const safeName = fileName.replace(/["\r\n]/g, '_');
    response.setHeader(
      'Content-Type',
      object.contentType || 'application/octet-stream',
    );
    if (object.contentLength !== undefined)
      response.setHeader('Content-Length', object.contentLength);
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    await pipeline(object.stream, response);
  }
}
