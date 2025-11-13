export interface AudioPacket {
  Buffer: Uint8Array<ArrayBuffer>;
  PageStart: number;
  PageEnd: number;
  ChunkPlayPosition: number;
  TotalDuration: number;
  ServerTime: number;
}
