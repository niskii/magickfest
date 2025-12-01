export type DecodedAudioBuffer = {
  left: Float32Array<ArrayBufferLike>;
  right: Float32Array<ArrayBufferLike>;
  samplesDecoded: number;
  sampleRate: number;
};

export type ChanneledAudioBuffer = {
  channelData: Array<Float32Array<ArrayBuffer>>;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
};
