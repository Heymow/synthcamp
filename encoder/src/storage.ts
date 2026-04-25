import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

const r2 = new S3Client({
  endpoint: required('R2_ENDPOINT'),
  region: 'auto',
  credentials: {
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  },
});

const bucket = required('R2_BUCKET');

/**
 * Download an R2 object to a local path. Streams via Node Readable to avoid
 * buffering the whole file in memory (audio sources can be 50+ MB).
 */
export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`R2 object ${key} has no body`);
  const stream = res.Body as Readable;
  await pipeline(stream, createWriteStream(destPath));
}

/**
 * Multipart-aware upload from a local file or buffer. Used for HLS segments
 * and preview MP3. ContentType is required for browser playback (R2 returns
 * what we set; defaulting to octet-stream breaks <audio> on Safari).
 */
export async function uploadFile(args: {
  key: string;
  bodyPath?: string;
  bodyBuffer?: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  if (!args.bodyPath && !args.bodyBuffer) {
    throw new Error('uploadFile requires either bodyPath or bodyBuffer');
  }
  // Lazy import only when needed (Node fs).
  const body = args.bodyBuffer ?? (await import('node:fs')).createReadStream(args.bodyPath!);
  const upload = new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: args.key,
      Body: body,
      ContentType: args.contentType,
      CacheControl: args.cacheControl,
    },
  });
  await upload.done();
}

/**
 * Best-effort delete. Used to clean up old segments when re-encoding.
 * Swallows NotFound — re-encoding a never-encoded track shouldn't error.
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return;
    throw err;
  }
}
