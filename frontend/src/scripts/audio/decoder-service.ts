// import { OpusStreamDecoder } from 'opus-stream-decoder';
import { type OggOpusDecodedAudio, OggOpusDecoderWebWorker } from "ogg-opus-decoder";
import { DecodedAudioPlaybackBuffer } from "./decoded-audio-playback-buffer";

const decoder = new OggOpusDecoderWebWorker({
    forceStereo: true,
    speechQualityEnhancement: "none",
});

// Mutable handlers object that consumers can import and reassign properties on.
// Example usage from another module:
// import { handlers } from './decoding';
// handlers.onDecode = (event, transfer) => { ... };

// Let me note this handler was written by copilot. Couldn't find anything about handlers online at the moment.
export const handlers: {
    onDecode: (event: any, transfer?: any[]) => void;
} = {
    onDecode: (_event: any, _transfer?: any[]) => { },
};

const playbackBuffer = new DecodedAudioPlaybackBuffer({ onFlush });
let sessionId: number, flushTimeoutId: number;

export { decodeAudio, flushAudio };

function evalSessionId(newSessionId: number) {
    // detect new session and reset decoder
    if (sessionId && sessionId === newSessionId) {
        return;
    }

    sessionId = newSessionId;
    playbackBuffer.reset();
}

async function decodeAudio(arrayBuffer: Uint8Array<ArrayBufferLike>, sessionId: number) {
    evalSessionId(sessionId);
    await decoder.ready;
    const buffer = new Uint8Array(arrayBuffer);
    decoder
        .decode(buffer)
        .then((decodedAudio) => onDecodeInternal(toDecodedFormat(decodedAudio)))
        .catch((err) => {
            console.log("decode error", err, buffer);
        });
}

function flushAudio() {
    decoder
        .flush()
        .then((decodedAudio) => onDecodeInternal(toDecodedFormat(decodedAudio)))
        .catch((err) => {
            console.log("decode error", err);
        });
}

function toDecodedFormat(decodedAudio: OggOpusDecodedAudio) {
    return {
        left: decodedAudio.channelData[0],
        right: decodedAudio.channelData[1],
        samplesDecoded: decodedAudio.samplesDecoded,
        sampleRate: 48000,
    };
}

function onDecodeInternal({ left, right, samplesDecoded, sampleRate }: any) {
    // Decoder recovers when it receives new files, and samplesDecoded is negative.
    // For cause, see https://github.com/AnthumChris/opus-stream-decoder/issues/7
    if (samplesDecoded <= 0) {
        return;
    }

    playbackBuffer.add({ left, right });
    scheduleLastFlush();
}

function onFlush({ left, right }: any) {
    const decoded = {
        channelData: [left, right],
        length: left.length,
        numberOfChannels: 2,
        sampleRate: 48000,
    };

    // Forward to the externally-bindable handler. Consumers can replace
    // `handlers.onDecode` by importing `handlers` and assigning a new function.
    handlers.onDecode({ decoded: decoded, sessionId: sessionId });
}

// No End of file is signaled from decoder. This ensures last bytes always flush
function scheduleLastFlush() {
    clearTimeout(flushTimeoutId);
    flushTimeoutId = setTimeout((_) => {
        playbackBuffer.flush();
    }, 100);
}
