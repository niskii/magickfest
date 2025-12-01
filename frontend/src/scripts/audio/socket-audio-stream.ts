import { Socket } from "socket.io-client";
import { type AudioPacket, Bitrate } from "@shared/types/audio-transfer";
import { TimeKeeper } from "./time-keeper";
import { ReadCode } from "@shared/types/read-codes";
import config from "../../config/client.json";

export class SocketAudioStream {
  #socket: Socket;
  #timeKeeper: TimeKeeper;
  #fetchTimer: NodeJS.Timeout;
  #isFetching = false;
  #needsResync = false;
  #lastChunkPage = 0;
  #bitrate: Bitrate;

  onFetch: (buffer: Uint8Array<ArrayBufferLike>) => void;
  onFlush: () => void;

  constructor(socket: Socket, timeKeeper: TimeKeeper, bitrate: Bitrate) {
    this.#socket = socket;
    this.#timeKeeper = timeKeeper;
    this.#bitrate = bitrate;
  }

  setBitrate(bitrate: Bitrate) {
    this.#bitrate = bitrate;
  }

  async getMinimalNumberOfChunks() {
    if (this.#timeKeeper.getDownloadedAudioDuration() < config.FetchThreshold) {
      this.fetch();
    }
  }

  handleChunk(data: AudioPacket) {
    this.#isFetching = false;
    this.#lastChunkPage = data.PageEnd;
    this.onFetch(data.Buffer);
  }

  async fetchCurrent() {
    this.#isFetching = true;
    this.#socket.emit(
      "fetchSyncedChunk",
      { bitrate: this.#bitrate },
      (response: { status: ReadCode }) => {
        console.log("Status code:", response.status);
      },
    );

    this.#socket.once("syncedChunk", async (data: AudioPacket) => {
      console.log("syncing!", this.#lastChunkPage);
      this.#needsResync = false;
      this.#timeKeeper.setStartPosition(data.ChunkPlayPosition);
      this.#timeKeeper.setTotalDuration(data.TotalDuration);
      this.#timeKeeper.addDelay(
        data.ChunkPlayPosition -
          data.ServerTime -
          this.#timeKeeper.getCurrentTime(),
      );
      this.handleChunk(data);
    });
  }

  fetch() {
    if (this.#isFetching) return;
    this.#isFetching = true;

    console.log("trying to fetch!", this.#lastChunkPage);
    this.#socket.emit(
      "fetchChunkFromPage",
      { bitrate: this.#bitrate, pageStart: this.#lastChunkPage },
      (response: { status: ReadCode }) => {
        if (response.status == ReadCode.EOF) {
          this.onFlush();
          this.reset();
          return;
        }
      },
    );

    this.#socket.once("chunkFromPage", (chunk: AudioPacket) => {
      console.log(
        "Delay of:",
        chunk.ServerTime - this.#timeKeeper.getCurrentPlayPosition(),
        this.#timeKeeper.getDownloadedAudioDuration(),
      );
      if (
        this.#timeKeeper.getCurrentPlayPosition() <
        chunk.ServerTime - config.MaxOutOfSync
      ) {
        this.#needsResync = true;
      }
      this.handleChunk(chunk);
    });
  }

  start() {
    this.fetchCurrent();
    clearTimeout(this.#fetchTimer);
    this.#fetchTimer = setInterval(async () => {
      if (this.#needsResync) {
        this.reset();
        this.onFlush();
        this.fetchCurrent();
        return;
      }
      if (this.#isFetching) return;
      this.getMinimalNumberOfChunks();
    }, config.FetchInterval);
  }

  reset() {
    this.#needsResync = false;
    this.#isFetching = false;
    this.#lastChunkPage = 0;
    this.#socket.removeListener("chunkFromPage");
    this.#socket.removeListener("syncedChunk");
    clearTimeout(this.#fetchTimer);
  }
}
