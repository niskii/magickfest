import { Socket } from "socket.io-client";
import { Chunk } from "./chunk";
import { TimeKeeper } from "./timeKeeper";

export class SocketAudioStream {
  #socket: Socket;
  #timeKeeper: TimeKeeper;
  #fetchTimer: NodeJS.Timeout;
  #isFetching = false;
  #needsResync = false;
  #lastChunkPage = 0;
  #minDuration;

  onFetch;
  onFlush;

  constructor(socket: Socket, timeKeeper: TimeKeeper, minDuration) {
    this.#socket = socket;
    this.#timeKeeper = timeKeeper;
    this.#minDuration = minDuration;

    socket.on("fetch", async (chunk: Chunk) => {
      console.log(
        "playing at",
        chunk.currentTime / 1000 - this.#timeKeeper.getCurrentPlayPosition(),
      );
      if (
        this.#timeKeeper.getCurrentPlayPosition() <
        chunk.currentTime / 1000 - 5
      ) {
        this.#needsResync = true;
      }
      this.handleChunk(chunk);
    });

    socket.on("sync", async (chunk: Chunk) => {
      console.log("syncing!");
      this.#needsResync = false;
      this.#timeKeeper.setStartPosition(chunk.chunkPlayPosition);
      this.#timeKeeper.setTotalDuration(chunk.totalDuration);
      this.#timeKeeper.addDelay(
        chunk.chunkPlayPosition -
          chunk.currentTime / 1000 -
          this.#timeKeeper.getCurrentTime(),
      );
      this.handleChunk(chunk);
    });
  }

  handleChunk(chunk: Chunk) {
    console.log("Received package!", chunk.pageEnd);
    this.#isFetching = false;
    this.#lastChunkPage = chunk.pageEnd;
    this.onFetch(chunk.buffer);
  }

  async getMinimalNumberOfChunks() {
    if (this.#timeKeeper.getRemainingTime() < this.#minDuration) {
      this.fetch();
    }
  }

  async fetchCurrent() {
    this.#isFetching = true;
    this.#socket.emit("fetchCurrent", (response) => {
      console.log("Status code:", response.status);
    });
  }

  fetch() {
    if (this.#isFetching) return;
    this.#isFetching = true;

    console.log("trying to fetch!");
    this.#socket.emit(
      "fetchChunks",
      { lastPage: this.#lastChunkPage },
      (response) => {
        if (response.status == 1) {
          this.onFlush();
          this.reset();
          return;
        }
      },
    );
  }

  async start() {
    this.fetchCurrent();
    this.#fetchTimer?.close();
    this.#fetchTimer = setInterval(async () => {
      if (this.#needsResync) {
        this.#needsResync = false;
        this.onFlush();
        this.fetchCurrent();
        return;
      }
      console.log("has buffered", this.#timeKeeper.getRemainingTime());
      if (this.#isFetching) return;
      this.getMinimalNumberOfChunks();
    }, 200);
  }

  async reset() {
    this.#lastChunkPage = 0;
    this.#isFetching = false;
    this.#needsResync = false;
    clearTimeout(this.#fetchTimer);
  }
}
