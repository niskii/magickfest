export interface AudioPacket {
  Buffer: Uint8Array<ArrayBuffer>;
  PageStart: number;
  PageEnd: number;
  ChunkPlayPosition: number;
  TotalDuration: number;
  ServerTime: number;
}

export enum Bitrate {
  High = 128,
  Medium = 96,
  Low = 64,
}
