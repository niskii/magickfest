export interface Chunk {
  buffer: Uint8Array;
  pageStart: number;
  pageEnd: number;
  chunkPlayPosition: number;
  serverTime: number;
  totalDuration: number;
}
