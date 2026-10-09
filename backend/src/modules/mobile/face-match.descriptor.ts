import sharp from "sharp";
import { l2Normalize } from "./face-match.pure";

const SIZE = 128;
const BLOCK = 8; // 8x8 → 64 block means
const HIST_BINS = 16;
const GRAD_BINS = 8;

function meanCenter(vec: number[]): number[] {
  if (vec.length === 0) return vec;
  let sum = 0;
  for (const v of vec) sum += v;
  const m = sum / vec.length;
  return vec.map((v) => v - m);
}

/**
 * Local face fingerprint (grayscale block means + histogram + gradients).
 * Mean-centering before L2 so cosine can drop for dissimilar images
 * (non-negative vectors alone stay near cosine ≈ 1).
 */
export async function buildFaceDescriptor(imageBuf: Buffer): Promise<number[]> {
  const { data, info } = await sharp(imageBuf)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== SIZE || info.height !== SIZE) {
    throw new Error("FACE_DESC_SIZE");
  }

  const pixels = data;
  let varianceAcc = 0;
  let meanAcc = 0;
  const n = pixels.length;
  for (let i = 0; i < n; i++) meanAcc += pixels[i]!;
  const mean = meanAcc / n;
  for (let i = 0; i < n; i++) {
    const d = pixels[i]! - mean;
    varianceAcc += d * d;
  }
  const variance = varianceAcc / n;
  if (variance < 40) {
    throw new Error("FACE_IMAGE_BLANK");
  }

  const blockMeans: number[] = [];
  const blockW = SIZE / BLOCK;
  for (let by = 0; by < BLOCK; by++) {
    for (let bx = 0; bx < BLOCK; bx++) {
      let sum = 0;
      let count = 0;
      const y0 = by * blockW;
      const x0 = bx * blockW;
      for (let y = y0; y < y0 + blockW; y++) {
        for (let x = x0; x < x0 + blockW; x++) {
          sum += pixels[y * SIZE + x]!;
          count++;
        }
      }
      blockMeans.push(sum / count / 255);
    }
  }

  const hist = new Array<number>(HIST_BINS).fill(0);
  for (let i = 0; i < n; i++) {
    const bin = Math.min(HIST_BINS - 1, Math.floor((pixels[i]! / 256) * HIST_BINS));
    hist[bin]! += 1;
  }
  const histNorm = hist.map((c) => c / n);

  const gradHist = new Array<number>(GRAD_BINS).fill(0);
  let gradCount = 0;
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const gx = pixels[y * SIZE + x + 1]! - pixels[y * SIZE + x - 1]!;
      const gy = pixels[(y + 1) * SIZE + x]! - pixels[(y - 1) * SIZE + x]!;
      const mag = Math.hypot(gx, gy);
      if (mag < 8) continue;
      let ang = Math.atan2(gy, gx); // -pi..pi
      if (ang < 0) ang += Math.PI; // fold to 0..pi (unsigned)
      const bin = Math.min(GRAD_BINS - 1, Math.floor((ang / Math.PI) * GRAD_BINS));
      gradHist[bin]! += mag;
      gradCount += 1;
    }
  }
  const gradNorm =
    gradCount > 0 ? gradHist.map((c) => c / (gradCount * 255)) : gradHist.map(() => 0);

  return l2Normalize([...meanCenter(blockMeans), ...meanCenter(histNorm), ...meanCenter(gradNorm)]);
}
