import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { FileRepository } from './infrastructure/persistence/file.repository';
import { FileType } from './domain/file';
import { NullableType } from '../utils/types/nullable.type';
import { AllConfigType } from '../config/config.type';
import { FileDriver } from './config/file-config.type';

@Injectable()
export class FilesService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  findById(id: FileType['id']): Promise<NullableType<FileType>> {
    return this.fileRepository.findById(id);
  }

  findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    return this.fileRepository.findByIds(ids);
  }

  /** Resolves stored file path/key to a client-usable URL (aligned with FileType serialization). */
  async resolvePublicUrl(storedPath: string): Promise<string> {
    const fileConf = this.configService.getOrThrow('file', { infer: true });
    const appConf = this.configService.getOrThrow('app', { infer: true });

    if (fileConf.driver === FileDriver.LOCAL) {
      return appConf.backendDomain + storedPath;
    }

    if ([FileDriver.S3_PRESIGNED, FileDriver.S3].includes(fileConf.driver)) {
      const s3 = new S3Client({
        region: fileConf.awsS3Region ?? '',
        credentials: {
          accessKeyId: fileConf.accessKeyId ?? '',
          secretAccessKey: fileConf.secretAccessKey ?? '',
        },
      });

      const command = new GetObjectCommand({
        Bucket: fileConf.awsDefaultS3Bucket ?? '',
        Key: storedPath,
      });

      return getSignedUrl(s3, command, { expiresIn: 3600 });
    }

    return storedPath;
  }
}
