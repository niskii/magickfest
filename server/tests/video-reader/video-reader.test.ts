import { BSON } from "bson";
import { EncodedPacket } from "mediabunny";
import { VideoReader } from "src/player/formats/video/video-reader";
import sleep from "tests/test-functions";
import { beforeEach, expect, test } from "vitest";

let videoReader: VideoReader;

async function readAllPackets() {
    const packets = new Array<EncodedPacket>();
    for (let i = 0; i < videoReader.numberOfPackets; i++) {
        const chunk = await videoReader.getNextChunk(i, 1, 0);
        if (chunk.data) {
            const deserialized = BSON.deserialize(chunk.data?.EncodedPackets).chunks as EncodedPacket[]
            packets.push(deserialized[0]);
        } 
    }

    return packets;
}

beforeEach(async () => {
    videoReader = new VideoReader(
        "./tests/data/spbtv_sample_bipbop_av1_960x540_25fps.mp4",
    );
    await sleep(20);
});

test("loads correctly", () => {
    expect(videoReader.numberOfPackets).toBe(375);
    expect(Math.floor(videoReader.totalDuration)).toBe(15);
});

test("can iterate through all packets", async () => {
    const packets = await readAllPackets();

    expect(packets.length).toBe(videoReader.numberOfPackets);
    const sortedPackets = packets.sort();

    let dupeFound = false;

    for (let i = 1; i < sortedPackets.length; i++) {
        const a = sortedPackets[i];
        const b = sortedPackets[i - 1];
        if (a == b) {
            console.log(a, b)
            dupeFound = true;
        } 
    }

    expect(packets.length).toEqual(videoReader.numberOfPackets)
    expect(dupeFound).toBeFalsy();
});

test("packets are ordered", async () => {
    const packets = await readAllPackets();

    let isUnordered = false;
    for (let i = 1; i < packets.length; i++) {
        const a = packets[i];
        const b = packets[i - 1];
        if (a.timestamp < b.timestamp) {
            isUnordered = true;
        }
    }

    expect(isUnordered).toBeFalsy();
});

test("can sync to stream", async () => {
    for (let i = 0; i <= 200; i++) {
        await videoReader.getNextChunk(i, 1, 0);
    }

    const chunk = await videoReader.getChunkAtTime(5.0, 1);
    const deserialized = BSON.deserialize(chunk.data!.EncodedPackets).chunks as EncodedPacket[]

    expect(deserialized[0].type).toBe("key");
    expect(chunk.data?.Timestamp).closeTo(5.0, 1.0);
});

test("chunk has 5 ordered packets", async () => {
    const chunk = await videoReader.getChunkAtTime(5.0, 5);
    const deserialized = BSON.deserialize(chunk.data!.EncodedPackets).chunks as EncodedPacket[]

    let previous: EncodedPacket | null = null;
    let isUnordered = false;
    deserialized.forEach((packet) => {
        if (previous && packet.timestamp < previous.timestamp)
            isUnordered = true;
        previous = packet;
    });

    expect(deserialized.length).toBe(5);
    expect(isUnordered).toBeFalsy();
});

test("cache gets pruned up to timestamp", async () => {
    await readAllPackets();

    await videoReader.evictCache(5.0)
    const packet = videoReader.packetCache.get(1)
    const packet2 = videoReader.packetCache.get(140);
    expect(packet).toBeUndefined()
    expect(packet2).toBeTruthy();
    await videoReader.evictCache(10.0)
    const packet3 = await videoReader.packetCache.get(140);
    expect(packet3).toBeUndefined();
})

test("get a key packet that hasn't been read yet", async () => {
    const chunk = await videoReader.getChunkAtTime(8.0, 1);
    const deserialized = BSON.deserialize(chunk.data!.EncodedPackets).chunks as EncodedPacket[]
    expect(deserialized[0].timestamp).closeTo(8.0, 2.0)
})
