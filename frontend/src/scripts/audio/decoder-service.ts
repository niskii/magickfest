import type {
    OggOpusDecodedAudio,
    OggOpusDecoderWebWorker,
} from "ogg-opus-decoder";
import logger from "../../logger";
import type { ChanneledAudioBuffer, DecodedAudioBuffer } from "./AudioTypes";
import { DecodedAudioPlaybackBuffer } from "./decoded-audio-playback-buffer";

let module: any = null;

let decoder: OggOpusDecoderWebWorker = null;

let loaded: boolean = false;

async function load() {
    if (module == null) {
        module = await import("ogg-opus-decoder");
        decoder = new module.OggOpusDecoderWebWorker({
            forceStereo: true,
            speechQualityEnhancement: "none",
        });

        await decoder.ready;

        loaded = true;
    }
}

// Mutable handlers object that consumers can import and reassign properties on.
// Example usage from another module:
// import { handlers } from './decoding';
// handlers.onDecode = (event, transfer) => { ... };

// Let me note this handler was written by copilot. Couldn't find anything about handlers online at the moment.
export const handlers: {
    onDecode: (event: any) => void;
} = {
    onDecode: (_event: any) => {},
};

const playbackBuffer = new DecodedAudioPlaybackBuffer(onFlush);
let sessionId: number, flushTimeoutId: NodeJS.Timeout;

export { clear, decodeAudio, flushAudio, load };

async function evalSessionId(newSessionId: number) {
    // detect new session and reset decoder
    if (sessionId && sessionId === newSessionId) {
        return;
    }

    sessionId = newSessionId;
    playbackBuffer.reset();
    await decoder.reset();
}

async function decodeAudio(
    arrayBuffer: Uint8Array<ArrayBufferLike>,
    sessionId: number,
) {
    if (!loaded) return;
    await evalSessionId(sessionId);
    const buffer = new Uint8Array(arrayBuffer);
    decoder
        .decode(buffer)
        .then((decodedAudio: OggOpusDecodedAudio) =>
            onDecodeInternal(toDecodedFormat(decodedAudio)),
        )
        .catch((err: any) => {
            logger.warn("decode error", err, buffer);
        });
}

function flushAudio() {
    if (!loaded) return;
    decoder
        .flush()
        .then((decodedAudio: OggOpusDecodedAudio) =>
            onDecodeInternal(toDecodedFormat(decodedAudio)),
        )
        .catch((err: any) => {
            logger.warn("decode error", err);
        });
}

async function clear() {
    if (!loaded) return;
    await decoder.reset();
}

function toDecodedFormat(decodedAudio: any): DecodedAudioBuffer {
    return {
        left: decodedAudio.channelData[0],
        right: decodedAudio.channelData[1],
        samplesDecoded: decodedAudio.samplesDecoded,
        sampleRate: 48000,
    };
}

function onDecodeInternal(buffer: DecodedAudioBuffer) {
    // Decoder recovers when it receives new files, and samplesDecoded is negative.
    // For cause, see https://github.com/AnthumChris/opus-stream-decoder/issues/7
    if (buffer.samplesDecoded <= 0) {
        return;
    }

    playbackBuffer.add(buffer);
    scheduleLastFlush();
}

function onFlush({
    left,
    right,
    samplesDecoded,
    sampleRate,
}: DecodedAudioBuffer) {
    const decoded: ChanneledAudioBuffer = {
        channelData: [new Float32Array(left), new Float32Array(right)],
        length: samplesDecoded,
        numberOfChannels: 2,
        sampleRate: sampleRate,
    };

    // Forward to the externally-bindable handler. Consumers can replace
    // `handlers.onDecode` by importing `handlers` and assigning a new function.
    handlers.onDecode({ decoded, sessionId });
}

// No End of file is signaled from decoder. This ensures last bytes always flush
function scheduleLastFlush() {
    clearTimeout(flushTimeoutId);
    flushTimeoutId = setTimeout(() => {
        playbackBuffer.flush();
    }, 100);
}
