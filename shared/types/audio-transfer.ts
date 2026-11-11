import { EncodedPacket } from "mediabunny";

export type MediaType = "video" | "audio";

export type AudioPacket = MediaPacket & {
  Buffer: Uint8Array<ArrayBuffer>;
};

export type VideoPacket = MediaPacket & {
  EncodedPackets: Uint8Array<ArrayBufferLike>;
};

export type MediaPacket = {
  PacketStart: number;
  PacketEnd: number;
  Timestamp: number;
  TotalDuration: number;
  ServerTime: number;
};

export enum Bitrate {
  High = 128,
  Medium = 96,
  Low = 64,
  Bad = 4,
}
