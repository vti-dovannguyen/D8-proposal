import { describe, it, expect } from "vitest";
import { uploadAttachmentFile } from "@/lib/storage";

function file(name: string, type: string, size = 3): File {
  const f = new File([new Uint8Array(size)], name, { type });
  return f;
}

describe("uploadAttachmentFile() guards (run before any Supabase call)", () => {
  it("rejects a disallowed extension", async () => {
    await expect(uploadAttachmentFile("meetings/x.exe", file("x.exe", "application/octet-stream"))).rejects.toThrow(/not allowed/i);
  });
  it("rejects active-content types (html/svg/js)", async () => {
    await expect(uploadAttachmentFile("m/x.html", file("x.html", "text/html"))).rejects.toThrow(/not allowed/i);
    await expect(uploadAttachmentFile("m/x.svg", file("x.svg", "image/svg+xml"))).rejects.toThrow(/not allowed/i);
  });
  it("rejects an oversize file", async () => {
    const big = file("big.pdf", "application/pdf");
    Object.defineProperty(big, "size", { value: 51 * 1024 * 1024 });
    await expect(uploadAttachmentFile("m/big.pdf", big)).rejects.toThrow(/50MB/);
  });
});
