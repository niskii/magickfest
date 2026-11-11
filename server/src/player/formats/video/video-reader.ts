import {
    ALL_FORMATS,
    EncodedPacket,
    EncodedPacketSink,
    FilePathSource,
    Input,
    InputVideoTrack,
} from "mediabunny";
import { MediaReader } from "src/player/media-reader";
import { VideoPacket } from "shared/types/audio-transfer";
import { ReadCode } from "shared/types/read-codes";
import rbtree, { Tree } from "functional-red-black-tree"
import { BSON } from "bson";

export class VideoReader implements MediaReader {
    videoTrack?: InputVideoTrack;
    videoSink?: EncodedPacketSink;
    numberOfPackets: number = 0;
    totalDuration: number = 0;

    #currentPacket?: EncodedPacket;
    #latestKeyPacket?: EncodedPacket;

    packetCache: Tree<number, EncodedPacket>;

    constructor(file: string) {
        this.packetCache = rbtree();
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
        if (!duration) throw new Error("can't get duration from video!");

        this.videoTrack = videoTrack;
        this.numberOfPackets = (
            await videoTrack.computePacketStats()
        ).packetCount;
        this.videoSink = new EncodedPacketSink(videoTrack);
        this.totalDuration = duration;
    }

    async evictCache(timestamp: number) {
        const packet = await this.videoSink?.getPacket(timestamp, {metadataOnly: true});
        if (!packet) return;
        const iter = this.packetCache.ge(packet.sequenceNumber);
        while (iter.hasPrev) {
            iter.prev()
            if (iter.key) {
                this.packetCache = this.packetCache.remove(iter.key)
            }
        }
    }

    async getPacket(packetNumber: number) {
        if (packetNumber < 0) return null

        const cached = this.packetCache.get(packetNumber + 1)
        if (cached) {
            console.log("cache hit!", packetNumber)
            return cached;
        }

        let packet: EncodedPacket | undefined | null;
        let cursor: EncodedPacket;
        if (this.#latestKeyPacket) {
            cursor = this.#latestKeyPacket
        } else {
            cursor = (await this.videoSink?.getFirstKeyPacket())!;
        }

        if (this.#currentPacket && this.#currentPacket.sequenceNumber > cursor.sequenceNumber && this.#currentPacket.sequenceNumber < packetNumber)
            cursor = this.#currentPacket;

        packet = cursor;

        while (packet && packet.sequenceNumber < packetNumber) {
            this.packetCache = this.packetCache.insert(packet.sequenceNumber + 1, packet);
            packet = await this.videoSink?.getNextPacket(packet);
        }

        if (packet) {
            this.packetCache = this.packetCache.insert(packet.sequenceNumber + 1, packet);
            if (!this.#currentPacket || packet.sequenceNumber > this.#currentPacket.sequenceNumber)
                this.#currentPacket = packet; 
            return packet;
        }

        return null;
    }

    async getLatestKeyPacket(timestamp: number) {
        const packet = await this.videoSink?.getKeyPacket(timestamp);
        if (this.#latestKeyPacket) {
            if (packet && packet.timestamp > this.#latestKeyPacket.timestamp) {
                this.#latestKeyPacket = packet;
                this.packetCache = this.packetCache.insert(packet.sequenceNumber + 1, packet);
            }
            return this.#latestKeyPacket;
        }
        return packet;
    }

    async createMediaPacketFromRange(
        start: number,
        end: number,
        timestamp: number,
    ) {
        const chunks: EncodedPacket[] = new Array(end - start);
        for (let i = 0; i < end - start; i++) {
            const packet = await this.getPacket(start + i);
            if (packet) chunks[i] = packet;            
        }

        const serializedChunks = BSON.serialize({chunks})

        if (chunks !== null) {
            const packet: VideoPacket = {
                EncodedPackets: serializedChunks,
                PacketStart: start,
                PacketEnd: end,
                Timestamp: chunks[0].timestamp,
                TotalDuration: this.getTotalDuration(),
                ServerTime: timestamp,
            };
            return packet;
        } else {
            console.log("sumtin wong!")
            return null;
        }
    }

    async getChunkAtTime(timestamp: number, numberOfPages: number) {
        const packet = await this.getLatestKeyPacket(timestamp);

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
        return this.totalDuration;
    }
}
