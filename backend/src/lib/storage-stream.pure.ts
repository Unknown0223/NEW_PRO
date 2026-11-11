/** Stream bajtidan oshsa FILE_TOO_LARGE. */

export type ByteCountState = { written: number };

export async function* limitStreamBytes(
  source: AsyncIterable<unknown>,
  maxBytes: number,
  state: ByteCountState = { written: 0 }
): AsyncGenerator<Buffer, void, unknown> {
  for await (const chunk of source) {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    state.written += buf.length;
    if (state.written > maxBytes) {
      throw new Error("FILE_TOO_LARGE");
    }
    yield buf;
  }
}
