import { Readable } from "stream";
import { describe, expect, it } from "vitest";
import { limitStreamBytes } from "../src/lib/storage-stream.pure";

describe("limitStreamBytes", () => {
  it("passes small streams", async () => {
    const state = { written: 0 };
    const chunks: Buffer[] = [];
    for await (const c of limitStreamBytes(Readable.from([Buffer.from("ab"), Buffer.from("cd")]), 10, state)) {
      chunks.push(c);
    }
    expect(Buffer.concat(chunks).toString()).toBe("abcd");
    expect(state.written).toBe(4);
  });

  it("throws FILE_TOO_LARGE when over max", async () => {
    const state = { written: 0 };
    await expect(async () => {
      for await (const _ of limitStreamBytes(Readable.from([Buffer.alloc(8)]), 4, state)) {
        /* drain */
      }
    }).rejects.toThrow("FILE_TOO_LARGE");
  });
});
