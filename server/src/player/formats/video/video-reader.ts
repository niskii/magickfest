import {
    ALL_FORMATS,
    EncodedPacket,
    EncodedPacketSink,
    FilePathSource,
    Input,
    InputVideoTrack,
} from "mediabunny";
import { MediaReader } from "src/player/media-reader";

export class VideoReader implements MediaReader {
    videoTrack: InputVideoTrack | null = null;
    videoSink: EncodedPacketSink | null = null;
    numberOfPackets: number = 0;
    duration: number = 0;

    #currentPacket: EncodedPacket | null = null;

    packetCache: Array<EncodedPacket>;

    constructor(file: string) {
        const input = new Input({
            source: new FilePathSource(file),
            formats: ALL_FORMATS,
        });

        this.packetCache = new Array();

        input
            .getPrimaryVideoTrack()
            .then(async (videoTrack) => {
                if (!videoTrack) throw new Error("video track is null!");
                const duration = await videoTrack.getDurationFromMetadata();
                if (!duration)
                    throw new Error("can't get duration from video!½");

                this.videoTrack = videoTrack;
                (await videoTrack.computePacketStats()).packetCount;
                this.videoSink = new EncodedPacketSink(videoTrack);
                this.duration = duration;
            })
            .catch((reason) => {
                throw new Error(reason);
            });
    }

    async #getPacket(packetNumber: number) {
        if (this.packetCache.at(packetNumber))
            return this.packetCache.at(packetNumber);

        let packet;
        if (!this.#currentPacket) {
            packet = await this.videoSink?.getFirstKeyPacket();
        } else {
            packet = await this.videoSink?.getNextPacket(this.#currentPacket);
        }

        if (packet) {
            this.#currentPacket = packet;
            this.packetCache.push(packet);
        }

        return packet;
    }

    async getChunkAtTime(start: number, numberOfPages: number) {
        return await this.#getPacket(start);
    }
    async getNextChunk(
        pageNumber: number,
        numberOfPages: number,
        timeOverride: number,
    ) {
        return {};
    }
    getTotalDuration() {
        return this.duration;
    }
}
