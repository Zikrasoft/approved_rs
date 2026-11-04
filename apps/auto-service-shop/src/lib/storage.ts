import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { MedusaContainer } from '@medusajs/framework/types';

import { parseEnv, type S3Config } from './env';

export const SHOP_STORAGE_REGISTRATION = 'shopStorage';

export type Bucket = {
  put: (
    key: string,
    body: Buffer,
    options: { contentType: string; metadata?: Record<string, string> },
  ) => Promise<void>;
  get: (key: string) => Promise<Buffer | null>;
  has: (key: string) => Promise<boolean>;
};

export type ShopStorage = {
  pages: Bucket;
  images: Bucket;
  publicUrl: (key: string) => string;
};

const missing = (error: unknown) =>
  error instanceof NoSuchKey || error instanceof NotFound;

const s3Bucket = (client: S3Client, Bucket: string): Bucket => ({
  put: async (Key, Body, { contentType, metadata }) => {
    await client.send(
      new PutObjectCommand({
        Bucket,
        Key,
        Body,
        ContentType: contentType,
        Metadata: metadata,
      }),
    );
  },
  get: async (Key) => {
    try {
      const { Body } = await client.send(new GetObjectCommand({ Bucket, Key }));
      return Body ? Buffer.from(await Body.transformToByteArray()) : null;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  },
  has: async (Key) => {
    try {
      await client.send(new HeadObjectCommand({ Bucket, Key }));
      return true;
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  },
});

export const s3Client = (config: S3Config) =>
  new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

export const s3PagesBucket = (config: S3Config): Bucket =>
  s3Bucket(s3Client(config), config.privateBucket);

export const s3Storage = (config: S3Config, fileUrl: string): ShopStorage => {
  const client = s3Client(config);
  return {
    pages: s3PagesBucket(config),
    images: s3Bucket(client, config.publicBucket),
    publicUrl: (key) => `${fileUrl}/${key}`,
  };
};

export const configuredStorage = (): ShopStorage | null => {
  const env = parseEnv(process.env);
  return env.S3 ? s3Storage(env.S3, env.FILE_URL) : null;
};

export const shopStorage = (scope: MedusaContainer): ShopStorage | null =>
  scope.hasRegistration(SHOP_STORAGE_REGISTRATION)
    ? scope.resolve<ShopStorage>(SHOP_STORAGE_REGISTRATION)
    : configuredStorage();
