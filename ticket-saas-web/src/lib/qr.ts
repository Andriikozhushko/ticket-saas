export function buildQrImageUrl(baseUrl: string, data: string, size = 220, format: "svg" | "png" = "svg"): string {
  void baseUrl;
  const safeSize = Number.isFinite(size) ? Math.max(120, Math.min(512, Math.round(size))) : 220;
  const pixels = `${safeSize}x${safeSize}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${pixels}&format=${format}&data=${encodeURIComponent(data)}`;
}
