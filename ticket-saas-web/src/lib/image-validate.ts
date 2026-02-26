/**
 * Validates image uploads by magic bytes (file signatures) to reject spoofed MIME types.
 */

const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]); // "RIFF"
const WEBP_WEBP = Buffer.from([0x57, 0x45, 0x42, 0x50]); // "WEBP" at offset 8

function bufSlice(buf: Buffer, start: number, len: number): Buffer {
  return buf.subarray(start, start + len);
}

export function isJpegBuffer(buf: Buffer): boolean {
  return buf.length >= 3 && bufSlice(buf, 0, 3).equals(JPEG_SIG);
}

export function isPngBuffer(buf: Buffer): boolean {
  return buf.length >= 8 && bufSlice(buf, 0, 8).equals(PNG_SIG);
}

export function isWebpBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    bufSlice(buf, 0, 4).equals(WEBP_RIFF) &&
    bufSlice(buf, 8, 4).equals(WEBP_WEBP)
  );
}

export type AllowedImageType = "image/jpeg" | "image/png" | "image/webp";

/** Returns true if buffer matches the claimed MIME (by magic bytes). */
export function bufferMatchesMime(buffer: Buffer, mime: string): boolean {
  if (mime === "image/jpeg" || mime === "image/jpg") return isJpegBuffer(buffer);
  if (mime === "image/png") return isPngBuffer(buffer);
  if (mime === "image/webp") return isWebpBuffer(buffer);
  return false;
}
