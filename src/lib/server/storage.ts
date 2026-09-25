import 'server-only';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Object storage for uploaded documents and extracted text (Architecture doc §6).
// S3-compatible storage in production; a local folder in development when S3 isn't configured.

const s3Configured = () =>
  Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const getBucket = () => process.env.AWS_S3_BUCKET || 'nurselearn';

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
    forcePathStyle: true,
  });
  return client;
}

const LOCAL_ROOT = path.join(process.cwd(), '.uploads');

function localPath(key: string) {
  const resolved = path.resolve(LOCAL_ROOT, key);
  // Keys are generated server-side, but guard against traversal anyway.
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Invalid storage key');
  return resolved;
}

function assertStorageAvailable() {
  if (!s3Configured() && process.env.NODE_ENV === 'production') {
    throw new Error('S3 storage is not configured (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
  }
}

export function storageBackend() {
  return s3Configured() ? 's3' : 'local';
}

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  assertStorageAvailable();
  if (s3Configured()) {
    await s3().send(new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getFile(key: string): Promise<Buffer> {
  if (s3Configured()) {
    const res = await s3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function deleteFile(key: string) {
  if (s3Configured()) {
    await s3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}
