import { describe, it, expect } from "vitest";
import { isJpegBuffer, isPngBuffer, isWebpBuffer, bufferMatchesMime } from "./image-validate";

describe("image-validate", () => {
  const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00]);
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webpMagic = Buffer.alloc(12);
  Buffer.from("RIFF").copy(webpMagic, 0);
  Buffer.from("WEBP").copy(webpMagic, 8);

  it("isJpegBuffer returns true for JPEG signature", () => {
    expect(isJpegBuffer(jpegMagic)).toBe(true);
    expect(isJpegBuffer(Buffer.concat([jpegMagic, Buffer.alloc(100)]))).toBe(true);
  });

  it("isJpegBuffer returns false for non-JPEG", () => {
    expect(isJpegBuffer(pngMagic)).toBe(false);
    expect(isJpegBuffer(Buffer.from([0x00, 0x00, 0x00]))).toBe(false);
    expect(isJpegBuffer(Buffer.alloc(2))).toBe(false);
  });

  it("isPngBuffer returns true for PNG signature", () => {
    expect(isPngBuffer(pngMagic)).toBe(true);
  });

  it("isPngBuffer returns false for non-PNG", () => {
    expect(isPngBuffer(jpegMagic)).toBe(false);
    expect(isPngBuffer(Buffer.alloc(4))).toBe(false);
  });

  it("isWebpBuffer returns true for WebP RIFF/WEBP signature", () => {
    expect(isWebpBuffer(webpMagic)).toBe(true);
  });

  it("isWebpBuffer returns false for non-WebP", () => {
    expect(isWebpBuffer(jpegMagic)).toBe(false);
    expect(isWebpBuffer(Buffer.alloc(10))).toBe(false);
  });

  it("bufferMatchesMime matches claimed MIME", () => {
    expect(bufferMatchesMime(jpegMagic, "image/jpeg")).toBe(true);
    expect(bufferMatchesMime(jpegMagic, "image/jpg")).toBe(true);
    expect(bufferMatchesMime(pngMagic, "image/png")).toBe(true);
    expect(bufferMatchesMime(webpMagic, "image/webp")).toBe(true);
  });

  it("bufferMatchesMime rejects wrong MIME", () => {
    expect(bufferMatchesMime(jpegMagic, "image/png")).toBe(false);
    expect(bufferMatchesMime(pngMagic, "image/jpeg")).toBe(false);
    expect(bufferMatchesMime(jpegMagic, "image/webp")).toBe(false);
  });
});
