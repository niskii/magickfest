import { Socket } from "socket.io-client";
import { type AudioPacket } from "./chunk";
import { TimeKeeper } from "./time-keeper";

import config from "../../config/client.json";

export class SocketAudioStream {
  #socket: Socket;
  #timeKeeper: TimeKeeper;
  #fetchTimer: NodeJS.Timeout;
  #isFetching = false;
  #needsResync = false;
  #lastChunkPage = 0;
  #bitrate;

  onFetch: (buffer: Uint8Array<ArrayBufferLike>) => void;
  onFlush: () => void;

  constructor(socket: Socket, timeKeeper: TimeKeeper, bitrate: number) {
    this.#socket = socket;
    this.#timeKeeper = timeKeeper;
    this.#bitrate = bitrate;
  }

  setBitrate(bitrate: number) {
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
      (response: any) => {
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
          data.ServerTime / 1000 -
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
      { bitrate: this.#bitrate, lastPage: this.#lastChunkPage },
      (response: any) => {
        if (response.status == 1) {
          this.onFlush();
          this.reset();
          return;
        }
      },
    );

    this.#socket.once("chunkFromPage", (chunk: AudioPacket) => {
      console.log(
        "Delay of:",
        chunk.ServerTime / 1000 - this.#timeKeeper.getCurrentPlayPosition(),
      );
      if (
        this.#timeKeeper.getCurrentPlayPosition() <
        chunk.ServerTime / 1000 - config.MaxOutOfSync
      ) {
        this.#needsResync = true;
      }
      this.handleChunk(chunk);
    });
  }

  async start() {
    this.fetchCurrent();
    this.#fetchTimer?.close();
    this.#fetchTimer = setInterval(async () => {
      if (this.#needsResync) {
        this.#needsResync = false;
        this.#socket.removeListener("chunkFromPage");
        this.#socket.removeListener("syncedChunk");
        this.onFlush();
        this.fetchCurrent();
        return;
      }
      if (this.#isFetching) return;
      this.getMinimalNumberOfChunks();
    }, config.FetchInterval);
  }

  async reset() {
    this.#lastChunkPage = 0;
    this.#isFetching = false;
    this.#needsResync = false;
    clearTimeout(this.#fetchTimer);
  }
}
