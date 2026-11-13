/** Crop a face bounding box from video using MediaPipe landmarks (normalized 0..1). */

export type NormPoint = { x: number; y: number };

export function faceBoundingBoxFromLandmarks(
  landmarks: NormPoint[],
  pad = 0.28
): { x: number; y: number; w: number; h: number } | null {
  if (!landmarks.length) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (maxX <= minX || maxY <= minY) return null;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const side = Math.max(bw, bh) * (1 + pad);
  const x = Math.max(0, cx - side / 2);
  const y = Math.max(0, cy - side / 2);
  const w = Math.min(1 - x, side);
  const h = Math.min(1 - y, side);
  if (w < 0.12 || h < 0.12) return null;
  return { x, y, w, h };
}

/** Draw video frame (optionally face-cropped) to JPEG data URL. */
export function captureVideoJpeg(
  video: HTMLVideoElement,
  opts?: { landmarks?: NormPoint[]; quality?: number }
): string | null {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (vw < 2 || vh < 2) return null;
  const canvas = document.createElement("canvas");
  const box = opts?.landmarks?.length
    ? faceBoundingBoxFromLandmarks(opts.landmarks)
    : null;
  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;
  if (box) {
    sx = Math.floor(box.x * vw);
    sy = Math.floor(box.y * vh);
    sw = Math.max(32, Math.floor(box.w * vw));
    sh = Math.max(32, Math.floor(box.h * vh));
    if (sx + sw > vw) sw = vw - sx;
    if (sy + sh > vh) sh = vh - sy;
  }
  const out = Math.max(sw, sh, 256);
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, out, out);
  const scale = Math.min(out / sw, out / sh);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);
  const dx = Math.floor((out - dw) / 2);
  const dy = Math.floor((out - dh) / 2);
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  return canvas.toDataURL("image/jpeg", opts?.quality ?? 0.92);
}
