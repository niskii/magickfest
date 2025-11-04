// import { OpusStreamDecoder } from 'opus-stream-decoder';
import { OggOpusDecoder } from "ogg-opus-decoder";
import { DecodedAudioPlaybackBuffer } from "./components/decoded-audio-playback-buffer";
import { WorkerStates } from "./worker-messages";

const decoder = new OggOpusDecoder({ forceStereo: true });
const playbackBuffer = new DecodedAudioPlaybackBuffer({ onFlush });
let sessionId, flushTimeoutId, decoderFlushTimeoutId;

function evalSessionId(newSessionId) {
  // detect new session and reset decoder
  if (sessionId && sessionId === newSessionId) {
    return;
  }

  sessionId = newSessionId;
  playbackBuffer.reset();
}

self.onmessage = async (evt) => {
  switch (evt.data.action) {
    case WorkerStates.DECODE:
      evalSessionId(evt.data.sessionId);
      await decoder.ready;
      const buffer = new Uint8Array(evt.data.decode);
      decoder
        .decode(buffer)
        .then((decoded) =>
          onDecode({
            left: decoded.channelData[0],
            right: decoded.channelData[1],
            samplesDecoded: decoded.samplesDecoded,
            sampleRate: 48000,
          }),
        )
        .catch((err) => {
          console.log("decode error", err, buffer);
        });
      break;

    case WorkerStates.FLUSH:
      decoder.flush().then((decoded) =>
        onDecode({
          left: decoded.channelData[0],
          right: decoded.channelData[1],
          samplesDecoded: decoded.samplesDecoded,
          sampleRate: 48000,
        }),
      );
      break;
  }

  // decoderLastFlush();
};

function onDecode({ left, right, samplesDecoded, sampleRate }) {
  // Decoder recovers when it receives new files, and samplesDecoded is negative.
  // For cause, see https://github.com/AnthumChris/opus-stream-decoder/issues/7
  if (samplesDecoded < 0) {
    return;
  }

  playbackBuffer.add({ left, right });
  scheduleLastFlush();
}

function onFlush({ left, right }) {
  const decoded = {
    channelData: [left, right],
    length: left.length,
    numberOfChannels: 2,
    sampleRate: 48000,
  };

  self.postMessage({ decoded, sessionId }, [
    decoded.channelData[0].buffer,
    decoded.channelData[1].buffer,
  ]);
}

// function decoderLastFlush() {
//   clearTimeout(decoderFlushTimeoutId)
//   decoderFlushTimeoutId = setTimeout(_ => {
//     decoder.flush().then(decoded => onDecode( {
//       left: decoded.channelData[0],
//       right: decoded.channelData[1],
//       samplesDecoded: decoded.samplesDecoded,
//       sampleRate: 48000})
//     )
//   }, 1000)
// }

// No End of file is signaled from decoder. This ensures last bytes always flush
function scheduleLastFlush() {
  clearTimeout(flushTimeoutId);
  flushTimeoutId = setTimeout((_) => {
    playbackBuffer.flush();
  }, 100);
}
