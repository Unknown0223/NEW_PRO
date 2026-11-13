import fs from "fs";
import path from "path";
import sharp from "sharp";

async function main() {
  const wasm = await import("@tensorflow/tfjs-backend-wasm");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const faceapi = require("@vladmandic/face-api/dist/face-api.node-wasm.js");
  const tf = faceapi.tf;

  const wasmPath = path
    .join(path.dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json")), "dist")
    .replace(/\\/g, "/");
  wasm.setWasmPaths(wasmPath.endsWith("/") ? wasmPath : `${wasmPath}/`);
  await tf.setBackend("wasm");
  await tf.ready();
  console.log("backend", tf.getBackend());

  const models = path.join(process.cwd(), "assets", "face-api");
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(models);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(models);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(models);

  const dir = path.join(process.cwd(), "node_modules", "@vladmandic", "face-api", "demo");
  const names = ["sample1.jpg", "sample2.jpg", "sample5.jpg"];

  async function desc(file: string) {
    const buf = fs.readFileSync(path.join(dir, file));
    const { data, info } = await sharp(buf).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
    const det = await faceapi
      .detectSingleFace(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    tf.dispose(tensor);
    if (!det) throw new Error("no face " + file);
    const d = Array.from(det.descriptor as Float32Array) as number[];
    let norm = 0;
    for (const x of d) norm += x * x;
    norm = Math.sqrt(norm);
    console.log(
      file,
      "score",
      det.detection.score.toFixed(3),
      "box",
      Math.round(det.detection.box.x),
      Math.round(det.detection.box.y),
      Math.round(det.detection.box.width),
      Math.round(det.detection.box.height),
      "descNorm",
      norm.toFixed(3),
      "head",
      d
        .slice(0, 4)
        .map((x) => x.toFixed(3))
        .join(",")
    );
    return d;
  }

  const a = await desc(names[0]!);
  const b = await desc(names[1]!);
  const c = await desc(names[2]!);

  function euclid(x: number[], y: number[]) {
    let s = 0;
    for (let i = 0; i < x.length; i++) {
      const t = x[i]! - y[i]!;
      s += t * t;
    }
    return Math.sqrt(s);
  }

  console.log("1vs2", euclid(a, b).toFixed(4));
  console.log("1vs5", euclid(a, c).toFixed(4));
  console.log("2vs5", euclid(b, c).toFixed(4));

  // same image twice
  const a2 = await desc(names[0]!);
  console.log("1vs1", euclid(a, a2).toFixed(4));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
