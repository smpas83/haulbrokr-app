/** Public URL for a stored object (matches mobile `${API_BASE}/storage${objectPath}`). */
export function storagePublicUrl(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

type PresignResponse = {
  uploadURL: string;
  objectPath: string;
  uploadToken: string;
};

type FinalizeResponse = {
  storageToken: string;
  objectPath: string;
};

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
}

/** Upload a file via presigned URL + finalize (same pipeline as mobile). */
export async function uploadFileToStorage(file: File): Promise<FinalizeResponse> {
  const contentType = file.type || "application/octet-stream";

  const presignRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType,
    }),
  });
  if (!presignRes.ok) {
    throw new Error(await parseApiError(presignRes, "Failed to request upload URL"));
  }
  const presign = (await presignRes.json()) as PresignResponse;

  const putRes = await fetch(presign.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }

  const finalizeRes = await fetch("/api/storage/uploads/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objectPath: presign.objectPath,
      uploadToken: presign.uploadToken,
    }),
  });
  if (!finalizeRes.ok) {
    throw new Error(await parseApiError(finalizeRes, "Failed to finalize upload"));
  }

  return (await finalizeRes.json()) as FinalizeResponse;
}
