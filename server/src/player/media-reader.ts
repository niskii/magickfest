import { MediaPacket } from "@shared/types/audio-transfer";
import { ReadCode } from "@shared/types/read-codes";

export interface MediaReader {
    getChunkAtTime: (
        timestamp: number,
        numberOfPages: number,
    ) => Promise<{ data: MediaPacket | null; status: ReadCode }>;
    getNextChunk: (
        pageNumber: number,
        numberOfPages: number,
        timestamp: number,
    ) => Promise<{ data: MediaPacket | null; status: ReadCode }>;
    getTotalDuration: () => number;
}
