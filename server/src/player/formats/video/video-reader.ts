import {
    ALL_FORMATS,
    EncodedPacket,
    EncodedPacketSink,
    FilePathSource,
    Input,
    InputVideoTrack,
} from "mediabunny";
import { MediaReader } from "src/player/media-reader";
import { VideoPacket } from "@shared/types/audio-transfer";
import { ReadCode } from "@shared/types/read-codes";

export class VideoReader implements MediaReader {
    videoTrack: InputVideoTrack | null = null;
    videoSink: EncodedPacketSink | null = null;
    numberOfPackets: number = 0;
    duration: number = 0;

    #currentPacket: EncodedPacket | null = null;

    packetCache: Array<EncodedPacket>;

    constructor(file: string) {
        this.packetCache = new Array();
        this.loadFile(file);
    }

    async loadFile(file: string) {
        const input = new Input({
            source: new FilePathSource(file),
            formats: ALL_FORMATS,
        });

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error("video track is null!");
        const duration = await videoTrack.getDurationFromMetadata();
        if (!duration) throw new Error("can't get duration from video!½");

        this.videoTrack = videoTrack;
        this.numberOfPackets = (
            await videoTrack.computePacketStats()
        ).packetCount;
        this.videoSink = new EncodedPacketSink(videoTrack);
        this.duration = duration;
    }

    async #getPacket(packetNumber: number) {
        if (this.packetCache.at(packetNumber))
            return this.packetCache.at(packetNumber)!;

        let packet;
        if (!this.#currentPacket) {
            packet = await this.videoSink?.getFirstKeyPacket();
        } else {
            packet = await this.videoSink?.getNextPacket(this.#currentPacket);
        }

        if (packet) {
            this.#currentPacket = packet;
            this.packetCache.push(packet);
            return packet;
        }

        return null;
    }

    async createMediaPacketFromRange(
        start: number,
        end: number,
        timestamp: number,
    ) {
        const chunks: EncodedPacket[] = new Array(end - start);

        for (let i = 0; i < end - start; i++) {
            const packet = await this.#getPacket(start + i);
            if (packet) chunks[i] = packet;
        }

        if (chunks !== null) {
            const packet: VideoPacket = {
                EncodedPackets: chunks,
                PacketStart: start,
                PacketEnd: end,
                Timestamp: chunks[0].timestamp,
                TotalDuration: this.getTotalDuration(),
                ServerTime: timestamp,
            };
            return packet;
        } else {
            return null;
        }
    }

    async getChunkAtTime(timestamp: number, numberOfPages: number) {
        const packet = await this.videoSink?.getKeyPacket(timestamp, {
            metadataOnly: true,
        });

        if (!packet) return { data: null, status: ReadCode.INVALID };

        const data = await this.createMediaPacketFromRange(
            packet.sequenceNumber,
            packet.sequenceNumber + numberOfPages,
            timestamp,
        );
        return { data: data, status: ReadCode.CONTINUATION };
    }
    async getNextChunk(
        pageNumber: number,
        numberOfPages: number,
        timestamp: number,
    ) {
        const data = await this.createMediaPacketFromRange(
            pageNumber,
            pageNumber + numberOfPages,
            timestamp,
        );
        return { data: data, status: ReadCode.CONTINUATION };
    }
    getTotalDuration() {
        return this.duration;
    }
}
