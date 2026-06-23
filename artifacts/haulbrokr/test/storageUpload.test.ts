import { describe, it, expect, vi, beforeEach } from "vitest";
import { storagePublicUrl, uploadFileToStorage } from "@/lib/storageUpload";

describe("storagePublicUrl", () => {
  it("prefixes object paths with the API storage route", () => {
    expect(storagePublicUrl("/uploads/abc.jpg")).toBe("/api/storage/uploads/abc.jpg");
  });
});

describe("uploadFileToStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests presigned URL, PUTs bytes, and finalizes", async () => {
    const file = new File(["photo-bytes"], "ticket.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uploadURL: "https://r2.example/upload",
          objectPath: "/uploads/ticket.jpg",
          uploadToken: "tok-1",
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objectPath: "/uploads/ticket.jpg",
          storageToken: "stor-1",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadFileToStorage(file);

    expect(result).toEqual({ objectPath: "/uploads/ticket.jpg", storageToken: "stor-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/storage/uploads/request-url");
    expect(fetchMock.mock.calls[1][0]).toBe("https://r2.example/upload");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/storage/uploads/finalize");
  });

  it("surfaces presign failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "File too large" }),
    }));

    const file = new File(["x"], "big.bin", { type: "application/octet-stream" });
    await expect(uploadFileToStorage(file)).rejects.toThrow("File too large");
  });
});
