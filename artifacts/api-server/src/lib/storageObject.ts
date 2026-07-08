import { Readable } from "stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

export const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
const S3_ACL_METADATA_KEY = "custom-aclpolicy";

export interface ObjectMetadata {
  size?: number;
  contentType?: string;
  generation?: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  name: string;
  metadata?: { timeCreated?: string };
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[ObjectMetadata]>;
  createReadStream(): Readable;
  delete(): Promise<void>;
  setMetadata(opts: { metadata: Record<string, string> }): Promise<void>;
}

function mapS3Metadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  if (!metadata) return {};
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key === S3_ACL_METADATA_KEY) {
      mapped[ACL_POLICY_METADATA_KEY] = value;
    } else {
      mapped[key] = value;
    }
  }
  return mapped;
}

function toS3Metadata(
  metadata: Record<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key === ACL_POLICY_METADATA_KEY) {
      mapped[S3_ACL_METADATA_KEY] = value;
    } else {
      mapped[key.replace(/^custom:/, "custom-")] = value;
    }
  }
  return mapped;
}

export function createStorageObject(
  client: S3Client,
  bucket: string,
  key: string,
  listedMetadata?: { timeCreated?: string },
): StorageObject {
  return {
    name: key,
    metadata: listedMetadata,

    async exists(): Promise<[boolean]> {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return [true];
      } catch (err: unknown) {
        const code = (
          err as { name?: string; $metadata?: { httpStatusCode?: number } }
        ).name;
        const status = (err as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode;
        if (code === "NotFound" || code === "NoSuchKey" || status === 404) {
          return [false];
        }
        throw err;
      }
    },

    async getMetadata(): Promise<[ObjectMetadata]> {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return [
        {
          size: head.ContentLength,
          contentType: head.ContentType,
          generation: head.ETag?.replace(/^"|"$/g, ""),
          metadata: mapS3Metadata(head.Metadata),
        },
      ];
    },

    createReadStream(): Readable {
      const bodyPromise = client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const stream = new Readable({
        read() {},
      });

      void bodyPromise
        .then((response) => {
          const body = response.Body;
          if (!body) {
            stream.destroy(new Error("Empty object body"));
            return;
          }
          if (body instanceof Readable) {
            body.on("data", (chunk) => stream.push(chunk));
            body.on("end", () => stream.push(null));
            body.on("error", (err) => stream.destroy(err));
            return;
          }
          if (
            typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] ===
            "function"
          ) {
            void (async () => {
              try {
                for await (const chunk of body as AsyncIterable<Uint8Array>) {
                  if (!stream.push(chunk)) {
                    await new Promise<void>((resolve) =>
                      stream.once("drain", resolve),
                    );
                  }
                }
                stream.push(null);
              } catch (err) {
                stream.destroy(err as Error);
              }
            })();
            return;
          }
          stream.destroy(new Error("Unsupported object body type"));
        })
        .catch((err) => stream.destroy(err));

      return stream;
    },

    async delete(): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async setMetadata(opts: {
      metadata: Record<string, string>;
    }): Promise<void> {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      await client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: key,
          CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`,
          MetadataDirective: "REPLACE",
          ContentType: head.ContentType,
          Metadata: toS3Metadata(opts.metadata),
        }),
      );
    },
  };
}

export async function listStorageObjectsByPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of response.Contents ?? []) {
      if (!item.Key) continue;
      objects.push(
        createStorageObject(client, bucket, item.Key, {
          timeCreated: item.LastModified?.toISOString(),
        }),
      );
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}
