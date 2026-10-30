import { EncodedPacket } from "mediabunny";
import { VideoReader } from "src/player/formats/video/video-reader";
import sleep from "tests/test-functions";
import { beforeEach, expect, test } from "vitest";

let videoReader: VideoReader;

async function readAllPackets() {
    const packets = new Array<EncodedPacket>();
    for (let i = 0; i < videoReader.numberOfPackets; i++) {
        const packet = await videoReader.getNextChunk(i, 1, 0);
        if (packet.data) packets.push(packet.data.EncodedPackets[0]);
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
    expect(Math.floor(videoReader.duration)).toBe(15);
});

test("can iterate through all packets", async () => {
    const packets = await readAllPackets();

    expect(packets.length).toBe(videoReader.numberOfPackets);
    const sortedPackets = packets.sort();

    let dupeFound = false;

    for (let i = 1; i < sortedPackets.length; i++) {
        const a = sortedPackets[i];
        const b = sortedPackets[i - 1];
        if (a == b) dupeFound = true;
    }

    expect(dupeFound).toBeFalsy();
});

test("packets are ordered", async () => {
    const packets = await readAllPackets();

    let isUnordered = false;
    for (let i = 1; i < packets.length; i++) {
        const a = packets[i];
        const b = packets[i - 1];
        if (a.timestamp < b.timestamp) {
            console.log(a.timestamp, b.timestamp);
            isUnordered = true;
        }
    }

    expect(isUnordered).toBeFalsy();
});

test("can sync to stream", async () => {
    for (let i = 0; i <= 200; i++) {
        await videoReader.getNextChunk(i, 1, 0);
    }

    const packet = await videoReader.getChunkAtTime(5.0, 1);

    expect(packet.data?.Timestamp).closeTo(5.0, 1.0);
});

test("chunk has 5 ordered packets", async () => {
    const chunks = await videoReader.getChunkAtTime(5.0, 5);
    let previous: EncodedPacket | null = null;
    let isUnordered = false;
    chunks.data?.EncodedPackets.forEach((packet) => {
        if (previous && packet.timestamp < previous.timestamp)
            isUnordered = true;
        previous = packet;
    });

    expect(chunks.data?.EncodedPackets.length).toBe(5);
    expect(isUnordered).toBeFalsy();
});
