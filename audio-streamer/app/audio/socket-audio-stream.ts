import { Socket } from "socket.io-client";
import { Chunk } from "./chunk";
import { TimeKeeper } from "./timeKeeper";

export class SocketAudioStream {
  _socket: Socket;
  _timeKeeper: TimeKeeper;
  _fetchTimer: NodeJS.Timeout;
  _isFetching = false;
  _isFlushed = false;
  currentChunk: Chunk;
  lastChunkPage = 0;
  _currentDuration = 0;
  _minDuration;
  _blob;
  onFetch;
  onFlush;

  constructor(socket: Socket, timeKeeper: TimeKeeper, minDuration) {
    this._socket = socket;
    this._timeKeeper = timeKeeper;
    this._minDuration = minDuration;

    socket.on("chunk", async (chunk: Chunk) => {
      this._isFetching = false;
      this.lastChunkPage = chunk.pageEnd;

      console.log("Received package!", chunk.pageEnd);
      this.onFetch(chunk.buffer);
    });

    // let bytes = new Uint8Array(chunk.buffer);

    // const link = document.createElement("a");
    // const file = new Blob([bytes], { type: 'audio/ogg; code=opus' });
    // link.href = URL.createObjectURL(file);
    // link.download = "sample.opus";
    // link.click();
    // URL.revokeObjectURL(link.href);
  }

  async getMinimalNumberOfChunks() {
    if (this._timeKeeper.getRemainingTime() < this._minDuration) {
      this.fetch();
    }
  }

  currentLength(length) {
    this._currentDuration = length;
  }

  async fetchCurrent() {
    this._isFetching = true;
    this._socket.emit("fetchCurrent", (response) => {
      console.log(response.status);
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
      // console.log("has buffered", this._timeKeeper.getRemainingTime());
      if (this._isFetching) return;
      this.getMinimalNumberOfChunks();
    }, 200);
  }

  async reset() {
    this.lastChunkPage = 0;
    this._currentDuration = 0;
    this.currentChunk = null;
    clearTimeout(this._fetchTimer);
  }
}
