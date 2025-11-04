export interface Chunk {
  buffer: Uint8Array;
  pageStart;
  pageEnd;
  headerSize;
  duration;
}
