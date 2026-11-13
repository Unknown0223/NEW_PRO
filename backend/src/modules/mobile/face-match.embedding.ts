import path from "path";

type FaceApiModule = typeof import("@vladmandic/face-api");

/** Loose TFJS handle from face-api.node-wasm (types omit setBackend/ready). */
type TfLike = {
  setBackend: (name: string) => Promise<boolean>;
  ready: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tensor3d: (values: Uint8Array, shape: [number, number, number]) => any;
  dispose: (tensor: unknown) => void;
};

type FaceApiRuntime = {
  faceapi: FaceApiModule;
  tf: TfLike;
};

let initPromise: Promise<FaceApiRuntime> | null = null;

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

function modelDir(): string {
  const fromEnv = process.env.FACE_API_MODEL_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "assets", "face-api");
}

function wasmDir(): string {
  return path.join(
    path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")),
    "dist"
  );
}

async function ensureFaceApi(): Promise<FaceApiRuntime> {
  if (!initPromise) {
    initPromise = (async () => {
      const wasm = await import("@tensorflow/tfjs-backend-wasm");
      // CommonJS build — shares one TFJS instance via faceapi.tf (no native binding).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js") as FaceApiModule;
      const tf = faceapi.tf as unknown as TfLike;

      const wasmPath = wasmDir().replace(/\\/g, "/");
      wasm.setWasmPaths(wasmPath.endsWith("/") ? wasmPath : `${wasmPath}/`);
      await tf.setBackend("wasm");
      await tf.ready();

      const models = modelDir();
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(models);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(models);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(models);
      return { faceapi, tf };
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function imageBufferToTensor(tf: TfLike, imageBuf: Buffer) {
  const sharp = await loadSharp();
  const { data, info } = await sharp(imageBuf)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width < 48 || info.height < 48) {
    throw new Error("FACE_IMAGE_BLANK");
  }
  if (info.channels !== 3) {
    throw new Error("FACE_IMAGE_BLANK");
  }
  // Must use faceapi.tf so instanceof Tensor checks pass inside face-api.
  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
}

/**
 * 128-d FaceRecognitionNet embedding (raw output).
 * Match with Euclidean distance (face-api convention).
 * Throws FACE_NOT_DETECTED when no face box is found.
 */
export async function buildFaceEmbedding(imageBuf: Buffer): Promise<number[]> {
  const { tf, faceapi } = await ensureFaceApi();
  const tensor = await imageBufferToTensor(tf, imageBuf);
  try {
    const options = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.4,
      maxResults: 1
    });
    const result = await faceapi
      .detectSingleFace(tensor, options)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result?.descriptor || result.descriptor.length < 64) {
      throw new Error("FACE_NOT_DETECTED");
    }
    const detectionScore =
      typeof result.detection?.score === "number" ? result.detection.score : 0;
    if (detectionScore < 0.4) {
      throw new Error("FACE_NOT_DETECTED");
    }
    // Keep raw FaceRecognitionNet output — match via Euclidean distance.
    return Array.from(result.descriptor);
  } finally {
    tf.dispose(tensor);
  }
}

/** Smoke helper — resolves model path for logs/tests. */
export function faceApiModelDirForTests(): string {
  return modelDir();
}
