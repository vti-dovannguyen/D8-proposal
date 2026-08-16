/**
 * Regression guard: uploadDocumentFile must reject active-content extensions
 * (svg, html, js) BEFORE any network/Supabase access. The extension check runs
 * before getClient(), so these assertions need NO env vars and NO Supabase mock.
 *
 * If any of these start passing through to getClient(), it means ALLOWED_EXT was
 * widened to include active-content types — a stored-XSS risk for inline serving.
 */
import { describe, it, expect } from "vitest";
import { uploadDocumentFile } from "@/lib/storage";

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1])], name, { type });
}

describe("uploadDocumentFile — allowlist invariant (inline-serving XSS guard)", () => {
  it("rejects .svg files", async () => {
    const file = makeFile("evil.svg", "image/svg+xml");
    await expect(
      uploadDocumentFile("documents/evil.svg", file)
    ).rejects.toThrow(/not allowed/i);
  });

  it("rejects .html files", async () => {
    const file = makeFile("evil.html", "text/html");
    await expect(
      uploadDocumentFile("documents/evil.html", file)
    ).rejects.toThrow(/not allowed/i);
  });

  it("rejects .js files", async () => {
    const file = makeFile("evil.js", "application/javascript");
    await expect(
      uploadDocumentFile("documents/evil.js", file)
    ).rejects.toThrow(/not allowed/i);
  });

  it("rejects .exe files (not in allowlist)", async () => {
    const file = makeFile("evil.exe", "application/octet-stream");
    await expect(
      uploadDocumentFile("documents/evil.exe", file)
    ).rejects.toThrow(/not allowed/i);
  });

  it("rejects oversized .pdf files before any upload (size check)", async () => {
    const file = makeFile("big.pdf", "application/pdf");
    // Override size without allocating 50MB of memory
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 });
    await expect(
      uploadDocumentFile("documents/big.pdf", file)
    ).rejects.toThrow(/50MB/i);
  });
});
