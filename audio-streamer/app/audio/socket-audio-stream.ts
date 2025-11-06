import { Socket } from "socket.io-client";
import { Chunk } from "./chunk";
import { TimeKeeper } from "./timeKeeper";

export class SocketAudioStream {
  _socket: Socket;
  _timeKeeper: TimeKeeper;
  _fetchTimer: NodeJS.Timeout;
  _isFetching = false;
  _isFlushed = false;
  _needsResync = false;
  currentChunk: Chunk;
  lastChunkPage = 0;
  _minDuration;

  onFetch;
  onFlush;

  constructor(socket: Socket, timeKeeper: TimeKeeper, minDuration) {
    this._socket = socket;
    this._timeKeeper = timeKeeper;
    this._minDuration = minDuration;

    socket.on("fetch", async (chunk: Chunk) => {
      console.log(
        "playing at",
        chunk.currentTime / 1000 - this._timeKeeper.getCurrentPlayPosition(),
      );
      if (
        this._timeKeeper.getCurrentPlayPosition() <
        chunk.currentTime / 1000 - 5
      ) {
        this._needsResync = true;
      }
      this.handleChunk(chunk);
    });

    socket.on("sync", async (chunk: Chunk) => {
      console.log("syncing!");
      this._needsResync = false;
      this._timeKeeper.setStartPosition(chunk.chunkPlayPosition);
      this._timeKeeper.setTotalDuration(chunk.totalDuration);
      this._timeKeeper.addDelay(
        chunk.chunkPlayPosition -
          chunk.currentTime / 1000 -
          this._timeKeeper.audioContext.currentTime,
      );
      this.handleChunk(chunk);
    });
  }

  handleChunk(chunk: Chunk) {
    console.log("Received package!", chunk.pageEnd);
    this._isFetching = false;
    this.lastChunkPage = chunk.pageEnd;
    this.onFetch(chunk.buffer);
  }

  async getMinimalNumberOfChunks() {
    if (this._timeKeeper.getRemainingTime() < this._minDuration) {
      this.fetch();
    }
  }

  async fetchCurrent() {
    this._isFetching = true;
    this._socket.emit("fetchCurrent", (response) => {
      console.log("Status code:", response.status);
    });
  }

  fetch() {
    if (this._isFetching) return;
    this._isFetching = true;

    console.log("trying to fetch!");
    this._socket.emit(
      "fetchChunks",
      { lastPage: this.lastChunkPage },
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
    this._fetchTimer?.close();
    this._fetchTimer = setInterval(async () => {
      if (this._needsResync) {
        this._needsResync = false;
        this.fetchCurrent();
        return;
      }
      console.log("has buffered", this._timeKeeper.getRemainingTime());
      if (this._isFetching) return;
      this.getMinimalNumberOfChunks();
    }, 200);
  }

  async reset() {
    this.lastChunkPage = 0;
    this.currentChunk = null;
    clearTimeout(this._fetchTimer);
  }
}
